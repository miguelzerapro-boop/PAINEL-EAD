import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Rotina agendada.
 *  - publica conteúdo com data marcada (cursos, módulos, aulas, blocos, ofertas)
 *  - expira matrículas vencidas
 *
 * Configurar no vercel.json:
 *   { "crons": [{ "path": "/api/cron/publicar", "schedule": "*\/15 * * * *" }] }
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  }

  const db = createAdminClient()

  const [publicados, expirados] = await Promise.all([
    db.rpc('publish_scheduled_content'),
    db.rpc('expire_enrollments'),
  ])

  if (publicados.error || expirados.error) {
    console.error('[cron] falha', publicados.error ?? expirados.error)
    return NextResponse.json({ message: 'Falha na rotina.' }, { status: 500 })
  }

  return NextResponse.json({ publicados: publicados.data, matriculasExpiradas: expirados.data })
}
