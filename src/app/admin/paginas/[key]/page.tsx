import { notFound } from 'next/navigation'

import { EditorDePagina } from './editor'
import { createAdminClient } from '@/lib/supabase/admin'
import { signToken } from '@/lib/token'

export const dynamic = 'force-dynamic'

export default async function EditarPaginaPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const db = createAdminClient()

  const { data: pagina } = await db
    .from('cms_pages')
    .select('id, key, name, path, status, cms_sections (id, block_type, name, position, draft_content, content, status, missing_fields)')
    .eq('key', key)
    .maybeSingle()

  if (!pagina) notFound()

  const { data: tipos } = await db
    .from('cms_block_types')
    .select('key, name, description, field_schema, required_fields, needs_real_data')

  // Token curto para a pré-visualização do rascunho.
  const token = signToken({ page: key }, 60 * 60 * 2)

  const blocos = (pagina.cms_sections ?? []).sort((a, b) => a.position - b.position)

  return (
    <>
      <h1 className="admin__titulo">{pagina.name}</h1>
      <EditorDePagina
        pageKey={pagina.key}
        blocos={blocos}
        tipos={tipos ?? []}
        previewToken={token}
      />
    </>
  )
}
