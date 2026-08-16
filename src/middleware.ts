import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieParaGravar = { name: string; value: string; options?: CookieOptions }

/**
 * Renova a sessão do Supabase e protege as áreas fechadas.
 *
 * A autorização real é da RLS no banco. Este middleware só evita que uma
 * pessoa deslogada chegue a uma tela que ela não veria de qualquer forma.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieParaGravar[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const areaFechada = path.startsWith('/aluna') || path.startsWith('/admin')

  if (areaFechada && !user) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    destino.searchParams.set('proximo', path)
    return NextResponse.redirect(destino)
  }

  if (path.startsWith('/admin') && user) {
    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!perfil || !['admin', 'owner'].includes(perfil.role)) {
      const destino = request.nextUrl.clone()
      destino.pathname = '/aluna'
      return NextResponse.redirect(destino)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|woff2)$).*)'],
}
