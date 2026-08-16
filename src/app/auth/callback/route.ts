import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Troca o código do link mágico por uma sessão e liga matrículas pendentes.
 *
 * Compra sem login: o pedido guarda apenas o e-mail. Quando a pessoa entra
 * pela primeira vez, ligamos os pedidos pagos daquele e-mail à conta e
 * criamos as matrículas.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const proximo = url.searchParams.get('proximo') ?? '/aluna'

  if (!code) {
    return NextResponse.redirect(new URL('/entrar?erro=link', url.origin))
  }

  const db = await createClient()
  const { error } = await db.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/entrar?erro=expirado', url.origin))
  }

  const {
    data: { user },
  } = await db.auth.getUser()

  if (user?.email) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    const { data: pedidos } = await admin
      .from('orders')
      .select('id, product_id')
      .eq('status', 'paid')
      .is('user_id', null)
      .ilike('buyer_email', user.email)

    for (const pedido of pedidos ?? []) {
      await admin.from('orders').update({ user_id: user.id }).eq('id', pedido.id)

      if (!pedido.product_id) continue
      const { data: cursos } = await admin
        .from('product_courses')
        .select('course_id')
        .eq('product_id', pedido.product_id)

      for (const curso of cursos ?? []) {
        await admin.from('enrollments').upsert(
          {
            user_id: user.id,
            course_id: curso.course_id,
            status: 'active',
            source: 'order',
            order_id: pedido.id,
          },
          { onConflict: 'user_id,course_id', ignoreDuplicates: true },
        )
      }
    }
  }

  return NextResponse.redirect(new URL(proximo, url.origin))
}
