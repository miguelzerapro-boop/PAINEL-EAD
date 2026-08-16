import { NextResponse } from 'next/server'

import { handlePaymentNotification, verifySignature } from '@/lib/mercadopago/webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Webhook do Mercado Pago.
 *
 * Sempre responde 200 quando o evento foi aceito, mesmo se não houver nada a
 * fazer — reenvio em loop é pior do que evento ignorado. A idempotência fica
 * na unique key de payment_webhook_events.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ message: 'Payload inválido.' }, { status: 400 })
  }

  const dataId = String(payload?.data?.id ?? '')
  const tipo = String(payload?.type ?? payload?.action ?? '')

  const assinaturaOk = verifySignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
  })

  if (!assinaturaOk) {
    console.warn('[mercadopago] assinatura inválida', { dataId, tipo })
    return NextResponse.json({ message: 'Assinatura inválida.' }, { status: 401 })
  }

  if (!tipo.includes('payment') || !dataId) {
    return NextResponse.json({ status: 'ignored' })
  }

  try {
    const resultado = await handlePaymentNotification({
      paymentId: dataId,
      eventKey: `${dataId}:${payload?.action ?? tipo}`,
      eventType: tipo,
      payload,
      signatureOk: true,
    })
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[mercadopago] falha ao processar webhook', error)
    // 500 faz o Mercado Pago reenviar — desejado quando a falha é nossa.
    return NextResponse.json({ message: 'Falha ao processar.' }, { status: 500 })
  }
}
