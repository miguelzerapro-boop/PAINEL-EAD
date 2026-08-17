import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * O PLANO DE UMA ALUNA REAL — quais capítulos ela abre, e como se chama isso.
 *
 * Existia só o caminho da prévia (`src/lib/admin/previa.ts`), que parte do
 * plano escolhido e deriva os capítulos. Aqui o caminho é o inverso, porque é
 * assim que a realidade chega: existe uma matrícula, e daí sai o direito.
 *
 * QUEM DECIDE O ACESSO É O BANCO. A lista de capítulos abertos vem de
 * `user_has_module_access()` — a mesmíssima função que a RLS usa para liberar
 * aula. Nada é reimplementado aqui, e por isso não há como esta tela mostrar
 * um capítulo que a aluna não conseguiria abrir (nem o contrário).
 *
 * COMO O PLANO GANHA NOME
 *
 * Compra tem nome: o pedido pago aponta para a oferta. Matrícula concedida à
 * mão não tem — não houve pedido. Nesse caso o nome sai da MATRIZ: procura-se
 * a oferta cujo conjunto de capítulos é exatamente o que ela abre. Quem abre
 * os oito capítulos está, em direitos, no Completo — e isso é lido de
 * `offer_module_access`, não escrito no código nem preso a um e-mail.
 *
 * Se nenhuma oferta corresponder, o nome vem nulo e a tela diz o que sabe
 * ("acesso concedido pela escola") em vez de chutar um plano.
 */

export type PlanoDaAluna = {
  /** Slug da oferta equivalente, quando existe uma. */
  slug: string | null
  /** Nome da oferta equivalente. Nulo quando o conjunto não bate com nenhuma. */
  nome: string | null
  /** Ids dos módulos que ela realmente abre, segundo o banco. */
  modulosAbertos: string[]
  /** Total de capítulos do curso, para compor "N de M". */
  totalDeModulos: number
  /** `order` (comprou), `manual`, `gift`, `import`, `demo`. */
  origem: string | null
  /** Houve pedido pago por trás desta matrícula? */
  deCompra: boolean
}

/**
 * Devolve `null` quando não há matrícula na formação — a tela então mostra o
 * estado de quem ainda não comprou, que já existe.
 */
export async function planoDaAluna(userId: string): Promise<PlanoDaAluna | null> {
  const db = createAdminClient()

  const { data: curso } = await db
    .from('courses')
    .select('id')
    .eq('slug', 'formacao')
    .maybeSingle()

  if (!curso) return null

  const { data: matricula } = await db
    .from('enrollments')
    .select('source, status')
    .eq('user_id', userId)
    .eq('course_id', curso.id)
    .maybeSingle()

  if (!matricula) return null

  const { data: modulos } = await db
    .from('modules')
    .select('id, name, position')
    .eq('course_id', curso.id)
    .order('position')

  const todos = modulos ?? []

  /*
   * Uma chamada por capítulo, em paralelo. Poderia ser mais barato replicar a
   * regra num único SELECT — e seria a forma errada de economizar: no dia em
   * que a regra mudar, a cópia continuaria respondendo a versão antiga.
   */
  const respostas = await Promise.all(
    todos.map((m) =>
      db
        .rpc('user_has_module_access', { p_user_id: userId, p_module_id: m.id })
        .then(({ data }) => data === true),
    ),
  )

  const modulosAbertos = todos.filter((_, i) => respostas[i]).map((m) => m.id)

  /* --- O nome ------------------------------------------------------------- */

  const { data: pedidoPago } = await db
    .from('orders')
    .select('offers:offer_id (name, slug)')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ofertaComprada = um<{ name: string; slug: string }>(pedidoPago?.offers)

  let nome = ofertaComprada?.name ?? null
  let slug = ofertaComprada?.slug ?? null

  if (!nome) {
    // Sem compra: a oferta equivalente é a que abre exatamente estes capítulos.
    const { data: ofertas } = await db
      .from('offers')
      .select('id, name, slug, price_cents, offer_module_access (module_id)')
      .eq('status', 'published')
      .order('price_cents')

    const abertos = new Set(modulosAbertos)
    const equivalente = (ofertas ?? []).find((o) => {
      const doPlano = (o.offer_module_access ?? []) as Array<{ module_id: string }>
      return (
        doPlano.length === abertos.size && doPlano.every((a) => abertos.has(a.module_id))
      )
    })

    nome = equivalente?.name ?? null
    slug = equivalente?.slug ?? null
  }

  return {
    slug,
    nome,
    modulosAbertos,
    totalDeModulos: todos.length,
    origem: matricula.source,
    deCompra: Boolean(ofertaComprada),
  }
}

/** PostgREST devolve o relacionamento como objeto ou array conforme o caso. */
function um<T>(valor: unknown): T | null {
  if (!valor) return null
  return (Array.isArray(valor) ? (valor[0] ?? null) : valor) as T | null
}
