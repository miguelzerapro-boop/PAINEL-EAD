import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type WhatsAppTarget =
  | { available: true; href: string; number: string }
  | { available: false; reason: 'not_configured' }

/**
 * Monta o link do WhatsApp a partir do numero cadastrado em settings.
 *
 * Se o numero ainda nao foi informado, devolve available:false. Nesse caso a
 * interface esconde o botao em vez de apontar para um numero inventado.
 */
export async function getWhatsAppTarget(message?: string): Promise<WhatsAppTarget> {
  const db = createAdminClient()

  const { data } = await db
    .from('settings')
    .select('value')
    .eq('key', 'contact.whatsapp')
    .maybeSingle()

  const raw = typeof data?.value === 'string' ? data.value : (data?.value as { number?: string })?.number
  const digits = (raw ?? '').replace(/\D/g, '')

  if (digits.length < 12) {
    return { available: false, reason: 'not_configured' }
  }

  const query = message ? `?text=${encodeURIComponent(message)}` : ''
  return { available: true, number: digits, href: `https://wa.me/${digits}${query}` }
}

/** Registra o clique para atribuicao do funil. Falha em silencio: nunca deve travar a navegacao. */
export async function trackWhatsAppClick(params: {
  origin: string
  leadId?: string
  userId?: string
  outcomeKey?: string
  message?: string
  utm?: Record<string, string>
}) {
  try {
    const db = createAdminClient()
    await db.from('whatsapp_clicks').insert({
      origin: params.origin,
      lead_id: params.leadId ?? null,
      user_id: params.userId ?? null,
      outcome_key: params.outcomeKey ?? null,
      message: params.message ?? null,
      utm: params.utm ?? {},
    })
  } catch (error) {
    console.error('[whatsapp] falha ao registrar clique', error)
  }
}
