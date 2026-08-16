import { NextResponse } from 'next/server'

import { COOKIE_PREVIA } from '@/lib/admin/previa'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LIGA E DESLIGA O MODO "VER COMO ALUNA".
 *
 *   /admin/previa/entrar?plano=completo   → liga e vai para a área da aluna
 *   /admin/previa/entrar?sair=1           → desliga e volta para o painel
 *
 * A rota vive sob /admin, então o middleware já barra quem não é da equipe
 * antes de chegar aqui. Mesmo assim o papel é conferido de novo: uma rota que
 * escreve cookie de permissão não pode depender só de quem a chamou pelo
 * caminho certo.
 *
 * O cookie guarda apenas o SLUG do plano. Ele não carrega permissão nenhuma —
 * quem decide se a prévia vale é `previaAtiva()`, que confere o papel a cada
 * requisição. Forjar este cookie no navegador não abre conteúdo para ninguém.
 *
 * Nada é gravado no banco: nenhuma matrícula, pedido, pagamento ou progresso.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const sair = url.searchParams.get('sair')
  const plano = url.searchParams.get('plano')

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/entrar?proximo=/admin', url.origin))
  }

  const { data: perfil } = await createAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil || !['admin', 'owner'].includes(perfil.role)) {
    return NextResponse.redirect(new URL('/aluna', url.origin))
  }

  /* --- Sair da prévia ------------------------------------------------------ */
  if (sair) {
    const resposta = NextResponse.redirect(new URL('/admin', url.origin))
    resposta.cookies.delete(COOKIE_PREVIA)
    return resposta
  }

  /* --- Entrar na prévia ---------------------------------------------------- */
  if (!plano) {
    return NextResponse.redirect(new URL('/admin/formacao/previa', url.origin))
  }

  const resposta = NextResponse.redirect(new URL('/aluna', url.origin))
  resposta.cookies.set(COOKIE_PREVIA, plano, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    // Sessão: fechou o navegador, acabou a prévia. Não é um estado que deva
    // sobreviver a dias sem ninguém lembrar que ligou.
  })
  return resposta
}
