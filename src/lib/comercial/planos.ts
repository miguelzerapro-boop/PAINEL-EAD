import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * OS PLANOS — lidos do banco, sempre.
 *
 * Nome, preço e capítulos incluídos saem de `offers` e `offer_module_access`.
 * Nada disso é escrito no JSX: trocar um capítulo de pacote, ajustar um preço
 * ou criar um quarto plano é mexer no banco, não em componente.
 *
 * O preço que a página mostra e o que o checkout cobra vêm da MESMA linha —
 * é o que impede a vitrine de divergir da cobrança.
 *
 * POR QUE O CLIENTE ADMIN
 *
 * A Formação fica em `draft` por decisão do escopo, e a RLS esconde curso e
 * módulos de quem não está matriculado — medido: o anônimo enxerga 0 módulos.
 * Com o cliente normal, a vitrine mostrava "0 de 0 capítulos" nos três planos.
 *
 * O que atravessa a RLS aqui é estreito e deliberado: NOME e POSIÇÃO dos
 * capítulos, que é exatamente o que a página de vendas precisa dizer antes da
 * compra. Nenhuma aula, nenhum vídeo, nenhum conteúdo — esses continuam
 * fechados pela `lesson_is_released()`, que é quem manda de verdade. O arquivo
 * é `server-only`: nada disso chega ao navegador além do que o JSX imprime.
 */

export type CapituloDoPlano = {
  id: string
  nome: string
  posicao: number
  incluido: boolean
}

export type Plano = {
  id: string
  slug: string
  nome: string
  precoCents: number
  precoFormatado: string
  chamada: string | null
  cta: string
  /** Quantos capítulos este plano libera. */
  capitulos: number
  /** Ids dos módulos incluídos. */
  modulos: string[]
}

export type VitrineDePlanos = {
  planos: Plano[]
  /** Todos os capítulos da formação, na ordem, para montar a comparação. */
  capitulos: Array<{ id: string; nome: string; posicao: number }>
  /** Total de capítulos da formação. */
  totalDeCapitulos: number
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * A vitrine inteira: planos, capítulos e quem inclui o quê.
 *
 * Devolve `null` quando não há plano publicado com preço — a página então diz
 * isso honestamente em vez de renderizar uma tabela vazia.
 */
export async function getVitrine(): Promise<VitrineDePlanos | null> {
  const db = createAdminClient()

  const { data: ofertas } = await db
    .from('offers')
    .select('id, slug, name, price_cents, headline, cta_label, status')
    .eq('status', 'published')
    .not('price_cents', 'is', null)
    .order('price_cents')

  if (!ofertas || ofertas.length === 0) return null

  const { data: acessos } = await db
    .from('offer_module_access')
    .select('offer_id, module_id')

  const { data: modulos } = await db
    .from('modules')
    .select('id, name, position, course_id, courses:course_id (slug)')
    .order('position')

  // Só os capítulos da formação principal entram na comparação.
  const capitulos = (modulos ?? [])
    .filter((m) => (m.courses as { slug?: string } | null)?.slug === 'formacao')
    .map((m) => ({ id: m.id, nome: m.name, posicao: m.position }))

  const porOferta = new Map<string, string[]>()
  for (const a of acessos ?? []) {
    const lista = porOferta.get(a.offer_id) ?? []
    lista.push(a.module_id)
    porOferta.set(a.offer_id, lista)
  }

  const planos: Plano[] = ofertas.map((o) => {
    const modulosDaOferta = porOferta.get(o.id) ?? []
    // Conta apenas capítulos da formação — uma oferta que inclua módulo de
    // outro curso não pode inflar o número mostrado.
    const daFormacao = modulosDaOferta.filter((id) => capitulos.some((c) => c.id === id))

    return {
      id: o.id,
      slug: o.slug,
      nome: o.name,
      precoCents: o.price_cents as number,
      precoFormatado: brl.format((o.price_cents as number) / 100),
      chamada: o.headline,
      cta: o.cta_label ?? `Quero o ${o.name}`,
      capitulos: daFormacao.length,
      modulos: daFormacao,
    }
  })

  return { planos, capitulos, totalDeCapitulos: capitulos.length }
}

/** Marca, para um plano, quais capítulos entram e quais não. */
export function comparar(plano: Plano, capitulos: VitrineDePlanos['capitulos']): CapituloDoPlano[] {
  return capitulos.map((c) => ({
    id: c.id,
    nome: c.nome,
    posicao: c.posicao,
    incluido: plano.modulos.includes(c.id),
  }))
}

/**
 * Etiqueta editorial do plano.
 *
 * Derivada da POSIÇÃO na lista de preços, não de dado de venda: ainda não
 * existe venda nenhuma, então "mais vendido" seria invenção. O plano do meio
 * recebe "mais equilíbrio"; o mais caro, "acesso completo".
 */
export function etiquetaDoPlano(plano: Plano, todos: Plano[]): string | null {
  if (todos.length < 3) return null
  const indice = todos.findIndex((p) => p.id === plano.id)
  if (indice === 1) return 'Mais equilíbrio'
  if (indice === todos.length - 1) return 'Acesso completo'
  return null
}
