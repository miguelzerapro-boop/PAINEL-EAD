import 'server-only'

import { cookies } from 'next/headers'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * MODO "VER COMO ALUNA"
 *
 * A responsável precisa conferir como a formação aparece para quem comprou —
 * antes de existir qualquer compra, e sem inventar uma.
 *
 * COMO FUNCIONA: um cookie guarda qual plano está sendo visualizado. As telas
 * da aluna, ao encontrar esse cookie, montam a formação com os capítulos
 * daquele plano em vez da matrícula real.
 *
 * POR QUE O COOKIE SOZINHO NÃO ABRE NADA
 *
 * Cookie é escrito pelo navegador, então qualquer pessoa pode forjar um. Por
 * isso `previaAtiva()` confere o PAPEL de quem está pedindo, no servidor, a
 * cada requisição: se não for admin ou dona, o cookie é ignorado por completo
 * e a tela volta a ser a da aluna comum. O cookie escolhe QUAL plano ver; quem
 * decide SE pode ver é a tabela `profiles`.
 *
 * O QUE ESTE MODO NUNCA FAZ:
 *   · criar matrícula, pedido ou pagamento;
 *   · alterar o papel ou o plano de quem está olhando;
 *   · gravar progresso;
 *   · liberar conteúdo de forma permanente.
 *
 * É leitura. A lista de capítulos abertos sai de `offer_module_access` — a
 * mesma tabela que `user_has_module_access()` consulta para liberar acesso de
 * verdade. Nenhuma regra é duplicada aqui.
 */

export const COOKIE_PREVIA = 'previa-plano'

export type PreviaAtiva = {
  /** Slug da oferta sendo visualizada. */
  slug: string
  nome: string
  /** Ids dos módulos que este plano abre. */
  modulosAbertos: string[]
}

/**
 * A prévia está ligada para quem está pedindo esta página?
 *
 * Devolve `null` quando não há cookie OU quando quem pede não é da equipe —
 * nos dois casos a tela deve se comportar como a área normal da aluna.
 */
export async function previaAtiva(): Promise<PreviaAtiva | null> {
  const jar = await cookies()
  const slug = jar.get(COOKIE_PREVIA)?.value
  if (!slug) return null

  /* --- Quem está pedindo? ------------------------------------------------- */
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: perfil } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // A checagem que vale. Cookie de quem não é da equipe não abre nada.
  if (!perfil || !['admin', 'owner'].includes(perfil.role)) return null

  /* --- Qual plano, e o que ele abre --------------------------------------- */
  const { data: oferta } = await admin
    .from('offers')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!oferta) return null

  const { data: acessos } = await admin
    .from('offer_module_access')
    .select('module_id')
    .eq('offer_id', oferta.id)

  return {
    slug: oferta.slug,
    nome: oferta.name,
    modulosAbertos: (acessos ?? []).map((a) => a.module_id),
  }
}

export type CapituloDaPrevia = {
  id: string
  nome: string
  posicao: number
  aberto: boolean
  aulas: number
}

/**
 * A formação como a aluna deste plano veria: capítulos na ordem, com o que
 * abre e o que fica fechado.
 */
export async function capitulosDaPrevia(previa: PreviaAtiva): Promise<CapituloDaPrevia[]> {
  const admin = createAdminClient()

  const { data: curso } = await admin
    .from('courses')
    .select('id')
    .eq('slug', 'formacao')
    .maybeSingle()

  if (!curso) return []

  const [{ data: modulos }, { data: aulas }] = await Promise.all([
    admin.from('modules').select('id, name, position').eq('course_id', curso.id).order('position'),
    admin.from('lessons').select('id, module_id'),
  ])

  const porModulo = new Map<string, number>()
  for (const a of aulas ?? []) {
    porModulo.set(a.module_id, (porModulo.get(a.module_id) ?? 0) + 1)
  }

  const abertos = new Set(previa.modulosAbertos)

  return (modulos ?? []).map((m) => ({
    id: m.id,
    nome: m.name,
    posicao: m.position,
    aberto: abertos.has(m.id),
    aulas: porModulo.get(m.id) ?? 0,
  }))
}
