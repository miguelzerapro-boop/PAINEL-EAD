import { Aviso } from '@/components/estados'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const TIPOS: Record<string, string> = {
  access: 'acesso aos dados',
  rectify: 'correção',
  delete: 'exclusão',
  portability: 'portabilidade',
  revoke_consent: 'revogação de consentimento',
}

export default async function LgpdPage() {
  const db = createAdminClient()

  const [pedidos, retencao, consentimentos] = await Promise.all([
    db.from('data_requests').select('*').order('due_at', { ascending: true }).limit(50),
    db.from('retention_policies').select('*').order('entity'),
    db.from('consents').select('id', { count: 'exact', head: true }).eq('granted', true),
  ])

  const abertos = (pedidos.data ?? []).filter((p) => p.status !== 'done' && p.status !== 'rejected')
  const atrasados = abertos.filter((p) => new Date(p.due_at) < new Date())

  return (
    <>
      <h1 className="admin__titulo">LGPD</h1>

      {atrasados.length > 0 ? (
        <Aviso tone="error" titulo={`${atrasados.length} pedido(s) fora do prazo`}>
          A lei dá 15 dias para responder ao titular. Priorize estes.
        </Aviso>
      ) : (
        <Aviso tone="success">Nenhum pedido de titular fora do prazo.</Aviso>
      )}

      <section style={{ marginBlockStart: 'var(--space-7)' }}>
        <h2>Pedidos de titular</h2>
        <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
          {pedidos.data && pedidos.data.length > 0 ? (
            pedidos.data.map((p) => (
              <div key={p.id} className="lista-admin__linha">
                <div>
                  <strong>{TIPOS[p.type] ?? p.type}</strong>
                  <p className="palheta__meta">{p.subject_email}</p>
                  {p.message ? <p className="palheta__meta">{p.message}</p> : null}
                </div>
                <span className="mono">
                  {p.status} · prazo {formatDate(p.due_at, 'short')}
                </span>
              </div>
            ))
          ) : (
            <p className="lista-admin__vazia">Nenhum pedido recebido.</p>
          )}
        </div>
      </section>

      <section style={{ marginBlockStart: 'var(--space-7)' }}>
        <h2>Política de retenção</h2>
        <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
          {(retencao.data ?? []).map((r) => (
            <div key={r.entity} className="lista-admin__linha">
              <div>
                <strong>{r.label}</strong>
                {r.note ? <p className="palheta__meta">{r.note}</p> : null}
              </div>
              <span className="mono">
                {r.retention_days} dias · {r.legal_basis}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-6)' }}>
        Consentimentos registrados: {consentimentos.count ?? 0}. Cada registro guarda o texto
        exato aceito, o canal e o momento — não apenas um marcador de “aceitou”.
      </p>
    </>
  )
}
