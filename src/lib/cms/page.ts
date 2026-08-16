import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Leitura de paginas do CMS.
 *
 * Site publico  -> getPublishedPage(): so blocos publicados e completos.
 * Pre-visualizacao -> getDraftPage(): usa draft_content e marca o que falta.
 *
 * A RLS ja filtra blocos com missing_fields no acesso publico; o filtro aqui
 * e uma segunda barreira para o caso de a leitura vir por service role.
 */

export type CmsBlock = {
  id: string
  type: string
  position: number
  content: Record<string, unknown>
  missingFields: string[]
}

export type CmsPage = {
  id: string
  key: string
  name: string
  path: string
  seo: Record<string, unknown>
  blocks: CmsBlock[]
  /** Preenchido apenas em pre-visualizacao. */
  pendingBlocks?: CmsBlock[]
}

export async function getPublishedPage(key: string): Promise<CmsPage | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('cms_pages')
    .select('id, key, name, path, seo, cms_sections (id, block_type, position, content, status, missing_fields)')
    .eq('key', key)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !data) return null

  const blocks = (data.cms_sections ?? [])
    .filter((s) => s.status === 'published' && (s.missing_fields ?? []).length === 0)
    .sort((a, b) => a.position - b.position)
    .map(toBlock)

  return { id: data.id, key: data.key, name: data.name, path: data.path, seo: data.seo ?? {}, blocks }
}

/** Pre-visualizacao autenticada por token. Mostra rascunho e pendencias. */
export async function getDraftPage(key: string): Promise<CmsPage | null> {
  const db = createAdminClient()

  const { data, error } = await db
    .from('cms_pages')
    .select('id, key, name, path, seo, cms_sections (id, block_type, position, draft_content, status, missing_fields)')
    .eq('key', key)
    .maybeSingle()

  if (error || !data) return null

  const all = (data.cms_sections ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      type: s.block_type,
      position: s.position,
      content: (s.draft_content ?? {}) as Record<string, unknown>,
      missingFields: (s.missing_fields ?? []) as string[],
    }))

  return {
    id: data.id,
    key: data.key,
    name: data.name,
    path: data.path,
    seo: data.seo ?? {},
    blocks: all.filter((b) => b.missingFields.length === 0),
    pendingBlocks: all.filter((b) => b.missingFields.length > 0),
  }
}

/** Configuracoes publicas (nome do site, contato, dados legais). */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const db = await createClient()
  const { data } = await db
    .from('settings')
    .select('key, value')
    .in('group_key', ['site', 'contact', 'legal', 'seo'])

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]))
}

/**
 * Relatorio de pendencias para o painel: o que ainda impede o site de ir ao ar.
 */
export async function getContentGaps() {
  const db = createAdminClient()

  const [settings, sections, slots, courses] = await Promise.all([
    db.from('settings').select('key, label, group_key').is('value', null).eq('is_required', true),
    db.from('cms_sections').select('id, block_type, page_id, missing_fields').not('missing_fields', 'eq', '{}'),
    db.from('image_slots').select('key, name, group_key').eq('status', 'pending').eq('is_required', true),
    db.from('courses').select('id, name, status, is_demo').eq('status', 'published'),
  ])

  return {
    missingSettings: settings.data ?? [],
    incompleteBlocks: sections.data ?? [],
    missingPhotos: slots.data ?? [],
    hasPublishedCourse: (courses.data ?? []).some((c) => !c.is_demo),
    demoStillPublished: (courses.data ?? []).some((c) => c.is_demo),
  }
}

type SectionRow = {
  id: string
  block_type: string
  position: number
  content: unknown
  missing_fields: string[] | null
}

function toBlock(s: SectionRow): CmsBlock {
  return {
    id: s.id,
    type: s.block_type,
    position: s.position,
    content: (s.content ?? {}) as Record<string, unknown>,
    missingFields: s.missing_fields ?? [],
  }
}
