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
  }),
})

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

  const resultado = await createCheckout({
    offerSlug: parsed.data.offerSlug,
    buyer: parsed.data.buyer,
    couponCode: parsed.data.couponCode,
    idempotencyKey: parsed.data.idempotencyKey,
    userId: user?.id,
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
