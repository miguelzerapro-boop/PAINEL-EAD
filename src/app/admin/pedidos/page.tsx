import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatPrice } from '@/lib/format'

export const dynamic = 'force-dynamic'

const ROTULOS: Record<string, string> = {
  pending: 'aguardando',
  in_process: 'em análise',
  paid: 'pago',
  failed: 'falhou',
  cancelled: 'cancelado',
  refunded: 'reembolsado',
  chargeback: 'chargeback',
}

export default async function PedidosPage() {
  const db = createAdminClient()
  const { data: pedidos } = await db
    .from('orders')
    .select('id, reference, buyer_name, buyer_email, status, amount_cents, created_at, paid_at, offers (name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <h1 className="admin__titulo">Pedidos</h1>
      <p className="lead" style={{ marginBlockEnd: 'var(--space-5)' }}>
        Somente leitura. O estado de cada pedido é atualizado pelo webhook do Mercado Pago —
        alterar à mão criaria divergência com o provedor.
      </p>

      <div className="lista-admin">
        {pedidos && pedidos.length > 0 ? (
          pedidos.map((pedido) => (
            <div key={pedido.id} className="lista-admin__linha">
              <div>
                <strong>{pedido.buyer_name ?? 'Sem nome'}</strong>
                <p className="palheta__meta">
                  {pedido.buyer_email} · {um<{ name: string }>(pedido.offers)?.name ?? 'oferta removida'}
                </p>
                <p className="mono">{pedido.reference}</p>
              </div>
              <span className="mono">
                {formatPrice(pedido.amount_cents)} · {ROTULOS[pedido.status] ?? pedido.status} ·{' '}
                {formatDate(pedido.paid_at ?? pedido.created_at, 'short')}
              </span>
            </div>
          ))
        ) : (
          <p className="lista-admin__vazia">Nenhum pedido registrado ainda.</p>
        )}
      </div>
    </>
  )
}
