import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatPhone } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const db = createAdminClient()

  const { data: leads } = await db
    .from('leads')
    .select('id, name, email, phone, stage, source, created_at, quiz_responses (outcome_id, resolved_action, quiz_outcomes (name))')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <h1 className="admin__titulo">Leads do diagnóstico</h1>

      <div className="lista-admin">
        {leads && leads.length > 0 ? (
          leads.map((lead) => {
            const resposta = (lead.quiz_responses ?? [])[0] as
              | { resolved_action: { action?: string }; quiz_outcomes: { name: string } | null }
              | undefined

            return (
              <div key={lead.id} className="lista-admin__linha">
                <div>
                  <strong>{lead.name ?? 'Sem nome'}</strong>
                  <p className="palheta__meta">
                    {formatPhone(lead.phone) ?? '—'}
                    {lead.email ? ` · ${lead.email}` : ''}
                  </p>
                  {resposta?.quiz_outcomes ? (
                    <p className="palheta__meta">
                      Momento: {resposta.quiz_outcomes.name}
                      {resposta.resolved_action?.action === 'whatsapp'
                        ? ' · encaminhada para WhatsApp'
                        : ''}
                    </p>
                  ) : null}
                </div>
                <span className="mono">
                  {lead.stage} · {formatDate(lead.created_at, 'short')}
                </span>
              </div>
            )
          })
        ) : (
          <p className="lista-admin__vazia">
            Nenhum diagnóstico respondido ainda. Publique o quiz e cadastre as perguntas para
            começar a receber leads.
          </p>
        )}
      </div>
    </>
  )
}
