'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { pegarSpec } from '@/lib/admin/specs'
import type { ResultadoAcao } from './tipos'

/**
 * Ações do painel.
 *
 * Toda gravação passa por aqui para (1) checar que quem chama é admin,
 * (2) validar, (3) registrar revisão com autor. Nenhuma tela do admin escreve
 * direto na tabela.
 */

async function exigirAdmin() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data: perfil } = await db
    .from('profiles')
    .select('role, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil || !['admin', 'owner'].includes(perfil.role)) {
    throw new Error('Sem permissão.')
  }

  return { userId: user.id, nome: perfil.display_name ?? perfil.full_name ?? user.email ?? 'admin' }
}

async function registrarRevisao(params: {
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'publish' | 'unpublish' | 'schedule' | 'rollback' | 'delete'
  snapshot: Record<string, unknown>
  changedFields?: string[]
  actorId: string
  actorName: string
  note?: string
}) {
  const admin = createAdminClient()
  const { data: ultima } = await admin
    .from('cms_revisions')
    .select('version')
    .eq('entity_type', params.entityType)
    .eq('entity_id', params.entityId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  await admin.from('cms_revisions').insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    version: (ultima?.version ?? 0) + 1,
    action: params.action,
    snapshot: params.snapshot,
    changed_fields: params.changedFields ?? [],
    actor_id: params.actorId,
    actor_name: params.actorName,
    note: params.note,
  })
}

/* -------------------------------------------------------------------------- */
/* Cursos                                                                      */
/* -------------------------------------------------------------------------- */

const cursoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'Informe o nome do curso.'),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.'),
  short_description: z.string().trim().max(280).optional().or(z.literal('')),
  full_description: z.string().trim().optional().or(z.literal('')),
  category_id: z.string().uuid().optional().or(z.literal('')),
  level_id: z.string().uuid().optional().or(z.literal('')),
  workload_minutes: z.coerce.number().int().positive().optional().or(z.literal('')),
  access_mode: z.enum(['lifetime', 'days', 'until_date']),
  access_days: z.coerce.number().int().positive().optional().or(z.literal('')),
  access_until: z.string().optional().or(z.literal('')),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  published_at: z.string().optional().or(z.literal('')),
  certificate_enabled: z.coerce.boolean(),
  min_progress_pct: z.coerce.number().min(0).max(100).default(100),
  require_all_assessments: z.coerce.boolean().default(false),
  require_all_activities: z.coerce.boolean().default(false),
  audience: z.string().trim().optional().or(z.literal('')),
  prerequisites: z.string().trim().optional().or(z.literal('')),
  required_materials: z.string().trim().optional().or(z.literal('')),
  welcome_message: z.string().trim().optional().or(z.literal('')),
  seo_title: z.string().trim().optional().or(z.literal('')),
  seo_description: z.string().trim().optional().or(z.literal('')),
})

export async function salvarCurso(_estado: unknown, formData: FormData): Promise<ResultadoAcao> {
  let sessao: Awaited<ReturnType<typeof exigirAdmin>>
  try {
    sessao = await exigirAdmin()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sem permissão.' }
  }

  const parsed = cursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const d = parsed.data
  const vazio = (v: unknown) => (v === '' || v === undefined ? null : v)

  const registro = {
    name: d.name,
    slug: d.slug,
    short_description: vazio(d.short_description),
    full_description: vazio(d.full_description),
    category_id: vazio(d.category_id),
    level_id: vazio(d.level_id),
    workload_minutes: vazio(d.workload_minutes),
    access_mode: d.access_mode,
    access_days: vazio(d.access_days),
    access_until: vazio(d.access_until),
    status: d.status,
    published_at: vazio(d.published_at),
    certificate_enabled: d.certificate_enabled,
    completion_criteria: {
      min_progress_pct: d.min_progress_pct,
      require_all_assessments: d.require_all_assessments,
      require_all_activities: d.require_all_activities,
      min_score: null,
    },
    audience: vazio(d.audience),
    prerequisites: vazio(d.prerequisites),
    required_materials: vazio(d.required_materials),
    welcome_message: vazio(d.welcome_message),
    seo: { title: vazio(d.seo_title), description: vazio(d.seo_description) },
    updated_by: sessao.userId,
  }

  const admin = createAdminClient()

  const { data, error } = d.id
    ? await admin.from('courses').update(registro).eq('id', d.id).select('id').single()
    : await admin
        .from('courses')
        .insert({ ...registro, created_by: sessao.userId })
        .select('id')
        .single()

  if (error) {
    // Constraints do banco viram mensagem legível em vez de erro cru.
    if (error.message.includes('courses_publish_requires_description')) {
      return { ok: false, message: 'Para publicar, preencha a descrição curta.' }
    }
    if (error.message.includes('courses_scheduled_requires_date')) {
      return { ok: false, message: 'Para agendar, informe a data de publicação.' }
    }
    if (error.code === '23505') {
      return { ok: false, message: 'Já existe um curso com este endereço (slug).' }
    }
    return { ok: false, message: 'Não foi possível salvar. Verifique os campos.' }
  }

  await registrarRevisao({
    entityType: 'courses',
    entityId: data.id,
    action: d.id ? 'update' : 'create',
    snapshot: registro,
    actorId: sessao.userId,
    actorName: sessao.nome,
  })

  revalidatePath('/admin/cursos')
  revalidatePath('/cursos')
  return { ok: true, id: data.id }
}

/* -------------------------------------------------------------------------- */
/* CMS: rascunho, publicação, agendamento                                      */
/* -------------------------------------------------------------------------- */

export async function salvarRascunhoBloco(
  _estado: unknown,
  formData: FormData,
): Promise<ResultadoAcao> {
  let sessao: Awaited<ReturnType<typeof exigirAdmin>>
  try {
    sessao = await exigirAdmin()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sem permissão.' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Bloco inválido.' }

  // Os campos do bloco chegam com prefixo "campo." para não colidir.
  const conteudo: Record<string, string> = {}
  for (const [chave, valor] of formData.entries()) {
    if (chave.startsWith('campo.')) conteudo[chave.slice(6)] = String(valor)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('cms_sections')
    .update({ draft_content: conteudo, updated_by: sessao.userId })
    .eq('id', id)

  if (error) return { ok: false, message: 'Não foi possível salvar o rascunho.' }

  await registrarRevisao({
    entityType: 'cms_sections',
    entityId: id,
    action: 'update',
    snapshot: conteudo,
    changedFields: Object.keys(conteudo),
    actorId: sessao.userId,
    actorName: sessao.nome,
    note: 'rascunho salvo',
  })

  revalidatePath('/admin/paginas')
  return { ok: true, id }
}

export async function publicarBloco(id: string, quando?: string): Promise<ResultadoAcao> {
  let sessao: Awaited<ReturnType<typeof exigirAdmin>>
  try {
    sessao = await exigirAdmin()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sem permissão.' }
  }

  const admin = createAdminClient()
  const { data: atual } = await admin
    .from('cms_sections')
    .select('draft_content, page_id')
    .eq('id', id)
    .single()

  const agendado = Boolean(quando)

  const { error } = await admin
    .from('cms_sections')
    .update({
      content: agendado ? undefined : atual?.draft_content,
      status: agendado ? 'scheduled' : 'published',
      scheduled_for: quando ?? null,
      updated_by: sessao.userId,
    })
    .eq('id', id)

  if (error) {
    // O trigger do banco bloqueia bloco incompleto e devolve a lista de campos.
    return { ok: false, message: traduzirErroDeBloco(error.message) }
  }

  await registrarRevisao({
    entityType: 'cms_sections',
    entityId: id,
    action: agendado ? 'schedule' : 'publish',
    snapshot: (atual?.draft_content ?? {}) as Record<string, unknown>,
    actorId: sessao.userId,
    actorName: sessao.nome,
  })

  revalidatePath('/')
  revalidatePath('/admin/paginas')
  return { ok: true, id }
}

function traduzirErroDeBloco(mensagem: string) {
  const match = mensagem.match(/campos obrigatórios vazios \(([^)]+)\)/)
    ?? mensagem.match(/campos obrigatorios vazios \(([^)]+)\)/)
  if (match) {
    return `Este bloco não pode ir ao ar: falta preencher ${match[1]}.`
  }
  return 'Não foi possível publicar este bloco.'
}

/* -------------------------------------------------------------------------- */
/* Registro genérico (módulos, aulas, instrutoras, ofertas, FAQ, avisos…)      */
/* -------------------------------------------------------------------------- */

export async function salvarRegistro(_estado: unknown, formData: FormData): Promise<ResultadoAcao> {
  let sessao: Awaited<ReturnType<typeof exigirAdmin>>
  try {
    sessao = await exigirAdmin()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sem permissão.' }
  }

  const entidade = String(formData.get('__entidade') ?? '')
  const spec = pegarSpec(entidade)
  if (!spec) return { ok: false, message: 'Entidade desconhecida.' }

  const id = String(formData.get('__id') ?? '')
  const paiId = String(formData.get('__pai') ?? '')

  const registro: Record<string, unknown> = {}

  for (const campo of spec.campos) {
    const bruto = formData.get(campo.nome)

    if (campo.tipo === 'checkbox') {
      registro[campo.nome] = bruto === 'on' || bruto === 'true'
      continue
    }

    const texto = bruto === null ? '' : String(bruto).trim()

    if (texto === '') {
      if (campo.obrigatorio) {
        return { ok: false, message: `Preencha o campo "${campo.rotulo}".` }
      }
      registro[campo.nome] = null
      continue
    }

    if (campo.tipo === 'number') {
      const numero = Number(texto)
      if (Number.isNaN(numero)) {
        return { ok: false, message: `"${campo.rotulo}" precisa ser um número.` }
      }
      registro[campo.nome] = numero
      continue
    }

    if (campo.tipo === 'select' && campo.opcoes) {
      const permitido = campo.opcoes.some((o) => o.value === texto)
      if (!permitido) return { ok: false, message: `Valor inválido em "${campo.rotulo}".` }
    }

    registro[campo.nome] = texto
  }

  if (spec.pai && paiId) {
    registro[spec.pai.coluna] = paiId
  }

  const admin = createAdminClient()
  const { data, error } = id
    ? await admin.from(spec.tabela).update(registro).eq('id', id).select('id').single()
    : await admin.from(spec.tabela).insert(registro).select('id').single()

  if (error) {
    return { ok: false, message: traduzirErroDeBanco(error.message, error.code) }
  }

  await registrarRevisao({
    entityType: spec.tabela,
    entityId: data.id,
    action: id ? 'update' : 'create',
    snapshot: registro,
    actorId: sessao.userId,
    actorName: sessao.nome,
  })

  revalidatePath(`/admin/${entidade}`)
  revalidatePath('/')
  revalidatePath('/cursos')
  return { ok: true, id: data.id }
}

function traduzirErroDeBanco(mensagem: string, codigo?: string) {
  if (codigo === '23505') return 'Já existe um registro com este endereço (slug).'
  if (mensagem.includes('offers_publish_requires_price')) {
    return 'Para publicar a oferta, informe o preço.'
  }
  if (mensagem.includes('testimonials_publish_requires_proof')) {
    return 'Para publicar, marque como verificado e registre a autorização de uso.'
  }
  if (mensagem.includes('modules_release_date_required') || mensagem.includes('lessons_release_date_required')) {
    return 'A liberação "em uma data" exige a data de liberação.'
  }
  if (mensagem.includes('release_days_required')) {
    return 'A liberação "N dias após a matrícula" exige o número de dias.'
  }
  if (mensagem.includes('lessons_live_requires_start')) {
    return 'Aula ao vivo exige o horário de início.'
  }
  if (mensagem.includes('notices_audience_target')) {
    return 'Escolha o destino do aviso (curso, turma ou aluna) de acordo com o público selecionado.'
  }
  return 'Não foi possível salvar. Revise os campos.'
}

/* -------------------------------------------------------------------------- */
/* Ajustes                                                                     */
/* -------------------------------------------------------------------------- */

export async function salvarAjustes(_estado: unknown, formData: FormData): Promise<ResultadoAcao> {
  let sessao: Awaited<ReturnType<typeof exigirAdmin>>
  try {
    sessao = await exigirAdmin()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sem permissão.' }
  }

  const admin = createAdminClient()

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith('ajuste.')) continue
    const key = chave.slice(7)
    const texto = String(valor).trim()

    await admin
      .from('settings')
      .update({ value: texto === '' ? null : texto, updated_by: sessao.userId })
      .eq('key', key)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/ajustes')
  revalidatePath('/')
  return { ok: true }
}
