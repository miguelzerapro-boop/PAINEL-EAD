import 'server-only'

import crypto from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { paymentClient } from './client'

/**
 * Valida a assinatura x-signature do Mercado Pago.
 * Formato: "ts=1704908010,v1=<hmac>"
 * Manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
export function verifySignature(params: {
  signature: string | null
  requestId: string | null
  dataId: string | null
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[mercadopago] MERCADOPAGO_WEBHOOK_SECRET ausente: webhook recusado.')
    return false
  }
  if (!params.signature || !params.dataId) return false

  const parts = Object.fromEntries(
    params.signature.split(',').map((chunk) => {
      const [k, v] = chunk.split('=')
      return [k?.trim() ?? '', v?.trim() ?? '']
    }),
  )

  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId ?? ''};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(v1, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const STATUS_MAP: Record<string, string> = {
  approved: 'paid',
  authorized: 'paid',
  pending: 'pending',
  in_process: 'in_process',
  in_mediation: 'in_process',
  rejected: 'failed',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'chargeback',
}

/**
 * Processa a notificacao. Idempotente: a unique key em
 * payment_webhook_events impede matricular duas vezes quando o Mercado Pago
 * reenvia o mesmo evento.
 */
export async function handlePaymentNotification(params: {
  paymentId: string
  eventKey: string
  eventType: string
  payload: unknown
  signatureOk: boolean
}) {
  const db = createAdminClient()

  const { error: insertError } = await db.from('payment_webhook_events').insert({
    provider: 'mercadopago',
    event_key: params.eventKey,
    event_type: params.eventType,
    signature_ok: params.signatureOk,
    payload: params.payload as Record<string, unknown>,
  })

  // Violacao de unique => evento ja recebido. Nada a fazer.
  if (insertError?.code === '23505') {
    return { status: 'duplicate' as const }
  }

  const detail = await paymentClient().get({ id: params.paymentId })
  const reference = detail.external_reference
  if (!reference) {
    await markProcessed(db, params.eventKey, 'pedido sem external_reference')
    return { status: 'ignored' as const }
  }

  const { data: order } = await db
    .from('orders')
    .select('id, user_id, product_id, status, buyer_email')
    .eq('reference', reference)
    .maybeSingle()

  if (!order) {
    await markProcessed(db, params.eventKey, `pedido ${reference} nao encontrado`)
    return { status: 'ignored' as const }
  }

  const mappedStatus = STATUS_MAP[detail.status ?? ''] ?? 'pending'

  await db.from('payments').upsert(
    {
      order_id: order.id,
      provider: 'mercadopago',
      provider_payment_id: String(detail.id),
      status: mappedStatus as never,
      status_detail: detail.status_detail ?? null,
      method: detail.payment_method_id ?? null,
      installments: detail.installments ?? null,
      amount_cents: Math.round((detail.transaction_amount ?? 0) * 100),
      fee_cents: Math.round((detail.fee_details?.[0]?.amount ?? 0) * 100),
      payer: (detail.payer ?? {}) as Record<string, unknown>,
      raw: detail as unknown as Record<string, unknown>,
      approved_at: detail.date_approved ?? null,
    },
    { onConflict: 'provider,provider_payment_id' },
  )

  await db
    .from('orders')
    .update({
      status: mappedStatus as never,
      paid_at: mappedStatus === 'paid' ? (detail.date_approved ?? new Date().toISOString()) : null,
    })
    .eq('id', order.id)

  if (mappedStatus === 'paid') {
    await grantAccess(db, order.id, order.product_id, order.user_id)
  }

  await markProcessed(db, params.eventKey, null)
  return { status: 'processed' as const, orderStatus: mappedStatus }
}

/**
 * Libera os cursos do produto comprado.
 * Se ainda nao houver conta (compra sem login), a matricula fica pendente e e
 * criada no primeiro acesso pelo e-mail do pedido.
 */
async function grantAccess(
  db: ReturnType<typeof createAdminClient>,
  orderId: string,
  productId: string | null,
  userId: string | null,
) {
  if (!productId || !userId) return

  const { data: links } = await db
    .from('product_courses')
    .select('course_id')
    .eq('product_id', productId)

  for (const link of links ?? []) {
    await db.from('enrollments').upsert(
      {
        user_id: userId,
        course_id: link.course_id,
        status: 'active',
        source: 'order',
        order_id: orderId,
      },
      { onConflict: 'user_id,course_id', ignoreDuplicates: true },
    )
  }
}

async function markProcessed(
  db: ReturnType<typeof createAdminClient>,
  eventKey: string,
  error: string | null,
) {
  await db
    .from('payment_webhook_events')
    .update({ processed_at: new Date().toISOString(), error })
    .eq('event_key', eventKey)
}
