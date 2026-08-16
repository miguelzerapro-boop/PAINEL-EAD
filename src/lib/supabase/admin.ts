import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com service role. IGNORA RLS.
 *
 * Usar somente em:
 *  - webhook do Mercado Pago
 *  - gravacao de leads e respostas do quiz (o funil publico nao tem policy de
 *    insert para anon de proposito)
 *  - rotinas de cron (publicacao agendada, expiracao de matricula)
 *  - painel administrativo em operacoes que precisam atravessar varias tabelas
 *
 * Nunca importar em componente de cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente. Necessario para webhooks e rotinas de servidor.',
    )
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
