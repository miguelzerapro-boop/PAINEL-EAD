'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

/**
 * Cliente para o navegador. Usa a chave PÚBLICA e depende de RLS.
 *
 * Aceita os dois nomes de variável: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
 * (formato novo, `sb_publishable_…`) e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * (legado, JWT). Quem não migrar continua funcionando.
 *
 * Estas duas são as ÚNICAS credenciais que podem existir no navegador. A
 * chave de backend nunca é lida aqui — ver src/lib/supabase/credenciais.ts.
 */
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !chave) {
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou a legada NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    )
  }

  client ??= createBrowserClient(url, chave)
  return client
}
