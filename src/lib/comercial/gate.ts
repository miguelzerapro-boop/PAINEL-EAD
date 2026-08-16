import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCheckoutConfigured } from '@/lib/mercadopago/client'

/**
 * O PORTÃO DA VENDA
 *
 * Uma função decide se é possível cobrar. Espalhar essa decisão por vários
 * componentes é como se cria a falha em que a tela some o aviso mas a rota
 * ainda cobra — ou o contrário.
 *
 * Cobrar exige TODAS as condições. Qualquer uma falha, não se cria pagamento:
 *
 *   1. a formação está publicada;
 *   2. a oferta está publicada;
 *   3. a oferta tem preço;
 *   4. existe produto válido;
 *   5. o Mercado Pago está configurado;
 *   6. o gate de venda está habilitado por ambiente.
 *
 * Enquanto qualquer uma faltar, o checkout continua NAVEGÁVEL — dá para
 * revisar layout, preço e capítulos — mas o botão de pagar fica bloqueado e
 * a rota recusa. Nada de Pix falso, QR fake ou matrícula sem pagamento.
 */

export type MotivoBloqueio =
  | 'curso_nao_publicado'
  | 'oferta_nao_publicada'
  | 'sem_preco'
  | 'sem_produto'
  | 'pagamento_nao_configurado'
  | 'venda_desligada'

export type EstadoDaVenda =
  | { podeCobrar: true }
  | { podeCobrar: false; motivos: MotivoBloqueio[]; mensagem: string; paraEquipe: string }

/**
 * Interruptor de ambiente.
 *
 * `VENDAS_HABILITADAS=1` liga. Ausente ou qualquer outro valor mantém
 * desligado — o padrão seguro é não cobrar. Serve para deixar um ambiente de
 * demonstração navegável sem risco de alguém ser cobrado de verdade.
 */
export function vendasHabilitadas(): boolean {
  return process.env.VENDAS_HABILITADAS === '1'
}

const EXPLICACAO: Record<MotivoBloqueio, string> = {
  curso_nao_publicado: 'a formação ainda está em rascunho',
  oferta_nao_publicada: 'esta oferta não está publicada',
  sem_preco: 'esta oferta ainda não tem preço definido',
  sem_produto: 'esta oferta não está ligada a um produto',
  pagamento_nao_configurado: 'o Mercado Pago não está configurado neste ambiente',
  venda_desligada: 'as vendas estão desligadas neste ambiente (VENDAS_HABILITADAS)',
}

/**
 * Pode cobrar por esta oferta?
 *
 * A resposta serve tanto para a tela (esconder/bloquear o botão) quanto para
 * a rota `/api/checkout` (recusar). As duas perguntam a mesma coisa ao mesmo
 * lugar.
 */
export async function estadoDaVenda(ofertaSlug: string): Promise<EstadoDaVenda> {
  const motivos: MotivoBloqueio[] = []
  const admin = createAdminClient()

  const { data: oferta } = await admin
    .from('offers')
    .select('id, slug, status, price_cents, product_id, products:product_id (id, status)')
    .eq('slug', ofertaSlug)
    .maybeSingle()

  if (!oferta) {
    return {
      podeCobrar: false,
      motivos: ['oferta_nao_publicada'],
      mensagem: 'Esta oferta não está disponível.',
      paraEquipe: 'Oferta não encontrada.',
    }
  }

  if (oferta.status !== 'published') motivos.push('oferta_nao_publicada')
  if (oferta.price_cents === null) motivos.push('sem_preco')
  if (!oferta.product_id) motivos.push('sem_produto')

  // A formação precisa estar no ar. Vender acesso a curso em rascunho é
  // vender o que ninguém consegue assistir.
  if (oferta.product_id) {
    const { data: cursos } = await admin
      .from('courses')
      .select('id, status')
      .eq('product_id', oferta.product_id)

    const algumPublicado = (cursos ?? []).some((c) => c.status === 'published')
    if (!algumPublicado) motivos.push('curso_nao_publicado')
  }

  if (!isCheckoutConfigured()) motivos.push('pagamento_nao_configurado')
  if (!vendasHabilitadas()) motivos.push('venda_desligada')

  if (motivos.length === 0) return { podeCobrar: true }

  /*
   * A visitante recebe uma frase curta e honesta. O detalhe do porquê fica em
   * `paraEquipe`, que só a tela de revisão e o log usam — dizer "o curso está
   * em rascunho" para quem quer comprar não ajuda ninguém.
   */
  return {
    podeCobrar: false,
    motivos,
    mensagem:
      motivos.includes('pagamento_nao_configurado') || motivos.includes('venda_desligada')
        ? 'As inscrições ainda não estão abertas.'
        : 'Esta oferta ainda não está disponível.',
    paraEquipe: motivos.map((m) => EXPLICACAO[m]).join(' · '),
  }
}
