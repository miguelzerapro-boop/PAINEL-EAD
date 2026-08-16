import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieParaGravar = { name: string; value: string; options?: CookieOptions }

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Respeita RLS: enxerga apenas o que a sessao da pessoa permite.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieParaGravar[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Chamado a partir de um Server Component: o middleware ja renova
            // a sessao, entao ignorar aqui e seguro.
          }
        },
      },
    },
  )
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha.`,
    )
  }
  return value
}
