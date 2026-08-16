import Link from 'next/link'

import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatWorkload } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminCursosPage() {
  const db = createAdminClient()
  const { data: cursos } = await db
    .from('courses')
    .select('id, name, slug, status, position, workload_minutes, is_demo, updated_at')
    .order('position')

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h1 className="admin__titulo" style={{ marginBlockEnd: 0 }}>Cursos</h1>
        <Link className="botao botao--primario" href="/admin/cursos/novo">
          Novo curso
        </Link>
      </div>

      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-5)' }}>
        Nenhuma grade curricular foi definida neste projeto. Cadastre aqui os cursos reais quando
        eles forem aprovados.
      </p>

      <div className="lista-admin">
        {cursos && cursos.length > 0 ? (
          cursos.map((curso) => (
            <div key={curso.id} className="lista-admin__linha">
              <div>
                <Link href={`/admin/cursos/${curso.id}`} style={{ fontWeight: 600 }}>
                  {curso.name}
                </Link>
                {curso.is_demo ? (
                  <span className="etiqueta" data-tone="demo" style={{ marginInlineStart: 'var(--space-3)' }}>
                    Demonstração
                  </span>
                ) : null}
                <p className="palheta__meta">
                  /{curso.slug}
                  {formatWorkload(curso.workload_minutes) ? ` · ${formatWorkload(curso.workload_minutes)}` : ' · carga horária não definida'}
                </p>
              </div>
              <span className="mono">
                {rotuloStatus(curso.status)} · {formatDate(curso.updated_at, 'short')}
              </span>
            </div>
          ))
        ) : (
          <p className="lista-admin__vazia">
            Nenhum curso cadastrado. Use “Novo curso” para começar.
          </p>
        )}
      </div>
    </>
  )
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    draft: 'rascunho',
    scheduled: 'agendado',
    published: 'publicado',
    archived: 'arquivado',
  }
  return mapa[status] ?? status
}
