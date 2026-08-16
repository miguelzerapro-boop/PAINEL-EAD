import Link from 'next/link'

import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminPaginasPage() {
  const db = createAdminClient()
  const { data: paginas } = await db
    .from('cms_pages')
    .select('id, key, name, path, status, updated_at, cms_sections (id, missing_fields, status)')
    .order('key')

  return (
    <>
      <h1 className="admin__titulo">Páginas</h1>
      <p className="lead" style={{ marginBlockEnd: 'var(--space-5)' }}>
        Um bloco só pode ir ao ar com todos os campos obrigatórios preenchidos. Enquanto faltar
        algo, ele fica em rascunho e não aparece no site.
      </p>

      <div className="lista-admin">
        {(paginas ?? []).map((pagina) => {
          const blocos = pagina.cms_sections ?? []
          const incompletos = blocos.filter((b) => (b.missing_fields ?? []).length > 0).length
          const publicados = blocos.filter((b) => b.status === 'published').length

          return (
            <div key={pagina.id} className="lista-admin__linha">
              <div>
                <Link href={`/admin/paginas/${pagina.key}`} style={{ fontWeight: 600 }}>
                  {pagina.name}
                </Link>
                <p className="palheta__meta">
                  {pagina.path} · {blocos.length} blocos · {publicados} publicados
                  {incompletos > 0 ? ` · ${incompletos} incompletos` : ''}
                </p>
              </div>
              <span className="mono">
                {pagina.status} · {formatDate(pagina.updated_at, 'short')}
              </span>
            </div>
          )
        })}

        {(paginas ?? []).length === 0 ? (
          <p className="lista-admin__vazia">Nenhuma página cadastrada.</p>
        ) : null}
      </div>
    </>
  )
}
