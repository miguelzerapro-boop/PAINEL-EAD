import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { preferenceClient } from './client'

export type CheckoutBuyer = {
  name: string
  email: string
  document?: string
  phone?: string
}

export type CheckoutResult =
  | {
      ok: true
      orderId: string
      reference: string
      initPoint: string
      preferenceId: string
      /** true quando um pedido idêntico já existia e foi reaproveitado. */
      reaproveitado?: boolean
    }
  | { ok: false; reason: 'offer_unavailable' | 'no_price' | 'provider_error'; message: string }

/**
 * Cria o pedido e a preferencia do Mercado Pago.
 *
 * O preco NUNCA vem do cliente: e lido da oferta publicada no banco. Uma
 * oferta sem preco definido nao pode ser vendida - e a mesma regra que impede
 * a landing exibir valor inventado.
 */
export async function createCheckout(params: {
  offerSlug: string
  buyer: CheckoutBuyer
  couponCode?: string
  leadId?: string
  userId?: string
  idempotencyKey?: string
  utm?: Record<string, string>
}): Promise<CheckoutResult> {
  const db = createAdminClient()

  // Idempotência: duplo clique, aba duplicada ou retry de rede reaproveitam o
  // pedido pendente em vez de criar outro. Só vale para pedido AINDA pendente:
  // um pedido pago ou cancelado nunca é reaberto.
  if (params.idempotencyKey) {
    const { data: existente } = await db
      .from('orders')
      .select('id, reference, status, metadata')
      .eq('status', 'pending')
      .contains('metadata', { idempotency_key: params.idempotencyKey })
      .maybeSingle()

    const preferenciaSalva = (existente?.metadata as { mercadopago_init_point?: string } | null)
      ?.mercadopago_init_point

    if (existente && preferenciaSalva) {
      return {
        ok: true,
        orderId: existente.id,
        reference: existente.reference,
        preferenceId: (existente.metadata as { mercadopago_preference_id?: string }).mercadopago_preference_id ?? '',
        initPoint: preferenciaSalva,
        reaproveitado: true,
      }
    }
  }

  const { data: offer } = await db
    .from('offers')
    .select('id, name, price_cents, currency, max_installments, product_id, status, starts_at, ends_at')
    .eq('slug', params.offerSlug)
    .eq('status', 'published')
    .maybeSingle()

  if (!offer) {
    return { ok: false, reason: 'offer_unavailable', message: 'Esta oferta nao esta disponivel no momento.' }
  }
  if (offer.price_cents === null) {
    return { ok: false, reason: 'no_price', message: 'Esta oferta ainda nao tem preco definido.' }
  }

  const now = Date.now()
  if (
    (offer.starts_at && new Date(offer.starts_at).getTime() > now) ||
    (offer.ends_at && new Date(offer.ends_at).getTime() < now)
  ) {
    return { ok: false, reason: 'offer_unavailable', message: 'Esta oferta nao esta disponivel no momento.' }
  }

  const discountCents = await resolveCoupon(db, offer.id, params.couponCode, offer.price_cents)
  const amountCents = Math.max(0, offer.price_cents - discountCents)

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      user_id: params.userId ?? null,
      lead_id: params.leadId ?? null,
      offer_id: offer.id,
      product_id: offer.product_id,
      status: 'pending',
      amount_cents: amountCents,
      discount_cents: discountCents,
      currency: offer.currency,
      buyer_name: params.buyer.name,
      buyer_email: params.buyer.email,
      buyer_document: params.buyer.document ?? null,
      buyer_phone: params.buyer.phone ?? null,
      utm: params.utm ?? {},
      metadata: params.idempotencyKey ? { idempotency_key: params.idempotencyKey } : {},
    })
    .select('id, reference')
    .single()

  if (orderError || !order) {
    return { ok: false, reason: 'provider_error', message: 'Nao foi possivel iniciar o pagamento.' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  try {
    const preference = await preferenceClient().create({
      body: {
        external_reference: order.reference,
        items: [
          {
            id: offer.id,
            title: offer.name,
            quantity: 1,
            currency_id: offer.currency,
            unit_price: amountCents / 100,
          },
        ],
        payer: {
          name: params.buyer.name,
          email: params.buyer.email,
          ...(params.buyer.document
            ? { identification: { type: 'CPF', number: params.buyer.document.replace(/\D/g, '') } }
            : {}),
        },
        payment_methods: {
          installments: offer.max_installments ?? 12,
        },
        back_urls: {
          success: `${siteUrl}/obrigado?ref=${order.reference}`,
          pending: `${siteUrl}/obrigado?ref=${order.reference}&status=pendente`,
          failure: `${siteUrl}/inscricao?ref=${order.reference}&status=falha`,
        },
        auto_return: 'approved',
        notification_url: process.env.MERCADOPAGO_NOTIFICATION_URL ?? `${siteUrl}/api/webhooks/mercadopago`,
        statement_descriptor: 'CURSO',
      },
      // O próprio Mercado Pago também deduplica por esta chave.
      ...(params.idempotencyKey
        ? { requestOptions: { idempotencyKey: params.idempotencyKey } }
        : {}),
    })

    // A linha em `payments` é criada pelo webhook, quando existe um pagamento
    // de verdade. Aqui guardamos apenas a preferência no pedido, para
    // rastreabilidade — evitando uma linha órfã sem provider_payment_id.
    //
    // O metadata é MESCLADO, não substituído: sobrescrever apagaria a
    // idempotency_key e o reaproveitamento deixaria de funcionar.
    await db
      .from('orders')
      .update({
        metadata: {
          ...(params.idempotencyKey ? { idempotency_key: params.idempotencyKey } : {}),
          mercadopago_preference_id: preference.id,
          mercadopago_init_point: preference.init_point,
        },
      })
      .eq('id', order.id)

    return {
      ok: true,
      orderId: order.id,
      reference: order.reference,
      preferenceId: preference.id!,
      initPoint: preference.init_point!,
      reaproveitado: false,
    }
  } catch (error) {
    await db.from('orders').update({ status: 'failed' }).eq('id', order.id)
    console.error('[mercadopago] falha ao criar preferencia', error)
    return { ok: false, reason: 'provider_error', message: 'Nao foi possivel iniciar o pagamento.' }
  }
}

async function resolveCoupon(
  db: ReturnType<typeof createAdminClient>,
  offerId: string,
  code: string | undefined,
  priceCents: number,
): Promise<number> {
  if (!code) return 0

  const { data: coupon } = await db
    .from('coupons')
    .select('id, discount_type, discount_value, max_uses, uses, starts_at, ends_at, active, offer_id')
    .eq('code', code.trim().toUpperCase())
    .eq('active', true)
    .maybeSingle()

  if (!coupon) return 0
  if (coupon.offer_id && coupon.offer_id !== offerId) return 0
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) return 0

  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return 0
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) return 0

  return coupon.discount_type === 'percent'
    ? Math.round((priceCents * Number(coupon.discount_value)) / 100)
    : Math.round(Number(coupon.discount_value) * 100)
}
