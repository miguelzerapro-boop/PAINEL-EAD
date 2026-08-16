import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Aviso } from '@/components/estados'
import { pegarSpec } from '@/lib/admin/specs'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Listagem genérica das entidades editáveis.
 * As rotas estáticas (/admin/cursos, /admin/paginas…) têm precedência.
 */
export default async function ListaGenerica({
  params,
  searchParams,
}: {
  params: Promise<{ entidade: string }>
  searchParams: Promise<{ pai?: string }>
}) {
  const [{ entidade }, { pai }] = await Promise.all([params, searchParams])
  const spec = pegarSpec(entidade)
  if (!spec) notFound()

  const db = createAdminClient()
  let query = db
    .from(spec.tabela)
    .select(`id, ${spec.colunaTitulo}, status, updated_at`)
    .order(spec.ordem, { ascending: true })

  if (spec.pai && pai) {
    query = query.eq(spec.pai.coluna, pai)
  }

  const { data: registros } = await query

  const novoHref = `/admin/${entidade}/novo${pai ? `?pai=${pai}` : ''}`

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h1 className="admin__titulo" style={{ marginBlockEnd: 0 }}>{spec.titulo}</h1>
        <Link className="botao botao--primario" href={novoHref}>
          Novo {spec.singular.toLowerCase()}
        </Link>
      </div>

      {spec.aviso ? (
        <div style={{ marginBlock: 'var(--space-5)' }}>
          <Aviso tone="warning">{spec.aviso}</Aviso>
        </div>
      ) : null}

      {spec.pai && !pai ? (
        <div style={{ marginBlock: 'var(--space-5)' }}>
          <Aviso>
            Esta lista pertence a um {spec.pai.entidade === 'cursos' ? 'curso' : 'módulo'}. Abra
            a partir dele para ver apenas os registros daquele contexto.
          </Aviso>
        </div>
      ) : null}

      <div className="lista-admin" style={{ marginBlockStart: 'var(--space-5)' }}>
        {registros && registros.length > 0 ? (
          registros.map((registro) => {
            const r = registro as unknown as Record<string, string>
            return (
              <div key={r.id} className="lista-admin__linha">
                <Link href={`/admin/${entidade}/${r.id}`} style={{ fontWeight: 600 }}>
                  {r[spec.colunaTitulo] || '(sem título)'}
                </Link>
                <span className="mono">
                  {r.status ?? '—'} · {formatDate(r.updated_at, 'short') ?? ''}
                </span>
              </div>
            )
          })
        ) : (
          <p className="lista-admin__vazia">
            Nada cadastrado ainda. Use “Novo {spec.singular.toLowerCase()}” para começar.
          </p>
        )}
      </div>
    </>
  )
}
