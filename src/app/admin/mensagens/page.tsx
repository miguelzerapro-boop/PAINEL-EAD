import Link from 'next/link'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Mensagens' }
export const dynamic = 'force-dynamic'

const FILTROS = [
  { valor: 'abertas', rotulo: 'Abertas' },
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'resolvidas', rotulo: 'Resolvidas' },
] as const

const TIPO: Record<string, string> = {
  support: 'suporte',
  course: 'curso',
  activity: 'atividade',
}

export default async function AdminMensagensPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro = 'abertas' } = await searchParams
  const db = createAdminClient()

  let consulta = db
    .from('conversations')
    .select(
      `id, subject, kind, status, last_message_at, created_at,
       autora:profiles!conversations_created_by_fkey (display_name, full_name, email),
       curso:courses (name)`,
    )
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (filtro === 'abertas') consulta = consulta.in('status', ['open', 'waiting'])
  if (filtro === 'resolvidas') consulta = consulta.eq('status', 'resolved')

  const { data: conversas } = await consulta

  return (
    <div className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Atendimento</p>
          <h1 className="titulo-pagina">Mensagens</h1>
          <p className="lead">Conversas abertas pelas alunas com a instrutora ou com o suporte.</p>
        </div>
      </div>

      <div className="pilha">
        <div className="chips">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              className="chip"
              data-ativo={filtro === f.valor}
              href={`/admin/mensagens?filtro=${f.valor}`}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>

        {(conversas ?? []).length === 0 ? (
          <EstadoVazio
            titulo={filtro === 'abertas' ? 'Nenhuma conversa aberta' : 'Nenhuma conversa'}
            texto="Quando uma aluna abrir um assunto, ele aparece aqui com todo o histórico."
          />
        ) : (
          <div className="lista">
            {(conversas ?? []).map((c) => {
              const autora = um<{ display_name: string; full_name: string; email: string }>(c.autora)
              const curso = um<{ name: string }>(c.curso)

              return (
                <Link key={c.id} className="lista__item" href={`/admin/mensagens/${c.id}`}>
                  <span
                    className="lista__marca"
                    aria-hidden="true"
                    style={
                      c.status === 'resolved'
                        ? undefined
                        : { background: 'var(--brand-accent)', borderColor: 'var(--brand-accent)' }
                    }
                  />
                  <span className="lista__texto">
                    <span className="lista__titulo">{c.subject ?? 'Sem assunto'}</span>
                    <span className="lista__meta">
                      {autora?.display_name ?? autora?.full_name ?? autora?.email ?? 'aluna'} ·{' '}
                      {TIPO[c.kind] ?? c.kind}
                      {curso ? ` · ${curso.name}` : ''} · {formatDate(c.last_message_at, 'short')}
                    </span>
                  </span>
                  <span className="lista__fim">
                    <span className="selo" data-tom={c.status === 'resolved' ? 'ok' : 'acao'}>
                      {c.status === 'resolved' ? 'resolvida' : 'aberta'}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
