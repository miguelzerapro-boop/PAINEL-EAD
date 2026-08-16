import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createCheckout } from '@/lib/mercadopago/checkout'
import { estadoDaVenda } from '@/lib/comercial/gate'
import { ipDaRequisicao, limitar } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const schema = z.object({
  offerSlug: z.string().min(1).max(120),
  couponCode: z.string().trim().max(40).optional(),
  /**
   * Chave de idempotência gerada pelo navegador. Duplo clique, aba duplicada
   * ou retry de rede reaproveitam o mesmo pedido em vez de criar outro.
   */
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
  buyer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(10).max(20),
    document: z.string().trim().min(11).max(14),
    /**
     * Senha escolhida na compra. Vai direto para o Supabase, que faz o hash —
     * nenhuma tabela nossa guarda senha, e ela nunca é registrada em log.
     */
    password: z.string().min(8).max(72),
  }),
})

/**
 * Garante que existe uma conta com este e-mail e senha.
 *
 * Antes o acesso vinha por link mágico. Trocou para senha porque o link
 * dependia de e-mail chegando na hora, e o limite de envio do provedor
 * deixava quem tentava entrar duas vezes seguidas sem acesso.
 *
 * `email_confirm: true` porque a compra já é a confirmação: quem pagou provou
 * que controla aquele e-mail. Sem isso a conta nasceria travada esperando um
 * e-mail que não vai mais existir neste fluxo.
 *
 * SE O E-MAIL JÁ TEM CONTA, a senha NÃO é trocada. Trocar aqui deixaria
 * qualquer pessoa redefinir a senha de outra só sabendo o e-mail dela.
 */
async function garantirConta(email: string, senha: string, nome: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { display_name: nome },
  })

  if (!error) return { criada: true, id: data.user?.id ?? null }

  // Já existia: segue em frente sem tocar na senha de quem já tem conta.
  if (/already|exists|registered/i.test(error.message)) {
    return { criada: false, id: null }
  }

  console.error('[checkout] não foi possível criar a conta:', error.message)
  return { criada: false, id: null }
}

export async function POST(request: Request) {
  const limite = limitar(`checkout:${ipDaRequisicao(request)}`, { limite: 12, janelaSegundos: 600 })
  if (!limite.permitido) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Aguarde um instante e tente de novo.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    )
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 422 })
  }

  /*
   * O PORTÃO DA VENDA, do lado do servidor.
   *
   * A tela de checkout já bloqueia o botão quando não dá para cobrar — mas
   * botão desabilitado é enfeite: esta rota é pública e aceita POST de
   * qualquer lugar. É aqui que a recusa vale.
   *
   * A visitante recebe a frase curta; o motivo detalhado fica no log, para a
   * equipe saber o que configurar.
   */
  const venda = await estadoDaVenda(parsed.data.offerSlug)
  if (!venda.podeCobrar) {
    console.warn('[checkout] recusado:', parsed.data.offerSlug, '·', venda.paraEquipe)
    return NextResponse.json({ message: venda.mensagem }, { status: 409 })
  }

  // O id do comprador vem SEMPRE da sessão, nunca do corpo da requisição.
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()

  /*
   * A conta é criada DEPOIS do portão e ANTES de cobrar.
   *
   * Depois do portão porque não faz sentido abrir conta para uma venda que
   * não vai acontecer. Antes de cobrar porque a aluna precisa conseguir
   * entrar assim que o pagamento voltar aprovado — sem depender de nenhum
   * e-mail chegar.
   *
   * O `user_id` do pedido continua saindo da SESSÃO, não daqui: quem já
   * estava logado compra com a própria conta, e quem não estava tem o pedido
   * ligado pelo e-mail no /auth/callback, como sempre foi.
   */
  const conta = user
    ? { criada: false, id: user.id }
    : await garantirConta(
        parsed.data.buyer.email.trim().toLowerCase(),
        parsed.data.buyer.password,
        parsed.data.buyer.name,
      )

  const { password: _senha, ...compradorSemSenha } = parsed.data.buyer

  const resultado = await createCheckout({
    offerSlug: parsed.data.offerSlug,
    // A senha NÃO segue para o provedor de pagamento nem para o pedido.
    buyer: compradorSemSenha,
    couponCode: parsed.data.couponCode,
    idempotencyKey: parsed.data.idempotencyKey,
    userId: user?.id ?? conta.id ?? undefined,
  })

  if (!resultado.ok) {
    const status = resultado.reason === 'provider_error' ? 502 : 409
    return NextResponse.json({ message: resultado.message }, { status })
  }

  return NextResponse.json({
    initPoint: resultado.initPoint,
    reference: resultado.reference,
    reaproveitado: resultado.reaproveitado ?? false,
  })
}
