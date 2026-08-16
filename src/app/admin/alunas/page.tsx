import { um, varios } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatPhone, formatProgress } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AlunasPage() {
  const db = createAdminClient()

  const { data: alunas } = await db
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at, enrollments (progress_pct, status, courses (name))')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <h1 className="admin__titulo">Alunas</h1>

      <div className="lista-admin">
        {alunas && alunas.length > 0 ? (
          alunas.map((aluna) => {
            const matriculas = varios<{ progress_pct: number; status: string; courses: unknown }>(
              aluna.enrollments,
            ).map((m) => ({ ...m, curso: um<{ name: string }>(m.courses) }))

            return (
              <div key={aluna.id} className="lista-admin__linha">
                <div>
                  <strong>{aluna.full_name ?? 'Sem nome'}</strong>
                  <p className="palheta__meta">
                    {aluna.email}
                    {aluna.phone ? ` · ${formatPhone(aluna.phone)}` : ''}
                  </p>
                  {matriculas.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, marginBlockStart: 'var(--space-2)' }}>
                      {matriculas.map((m, i) => (
                        <li key={i} className="palheta__meta">
                          {m.curso?.name ?? 'curso removido'} · {formatProgress(m.progress_pct)} · {m.status}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="palheta__motivo">Sem matrícula</p>
                  )}
                </div>
                <span className="mono">{formatDate(aluna.created_at, 'short')}</span>
              </div>
            )
          })
        ) : (
          /*
           * Estado vazio EXPLICADO. "Nenhuma aluna cadastrada ainda." sozinho
           * deixa quem abre a tela sem saber se falta configurar alguma coisa
           * ou se é só o começo. A segunda linha responde isso.
           */
          <div className="vazio-explicado">
            <p className="vazio-explicado__titulo">Nenhuma aluna matriculada ainda.</p>
            <p className="vazio-explicado__texto">
              As alunas aparecem aqui depois que uma compra for aprovada pelo Mercado Pago
              ou que uma matrícula for criada manualmente no painel.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
