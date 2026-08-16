import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ipDaRequisicao, limitar } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const schema = z.object({
  subject: z.string().trim().min(3).max(140),
  body: z.string().trim().min(5).max(5000),
  courseId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
})

/**
 * Abre uma conversa.
 *
 * Usa service role por um motivo específico: além de criar a conversa, precisa
 * inscrever a EQUIPE como participante — e a aluna não tem (nem deve ter)
 * permissão para inserir outra pessoa em `conversation_participants`.
 *
 * Tudo que vem do cliente é validado, e o autor é sempre o da sessão.
 */
export async function POST(request: Request) {
  const limite = limitar(`mensagens:${ipDaRequisicao(request)}`, { limite: 10, janelaSegundos: 600 })
  if (!limite.permitido) {
    return NextResponse.json(
      { message: 'Muitas conversas abertas em pouco tempo. Aguarde um instante.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    )
  }

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  const { data: conversa, error } = await admin
    .from('conversations')
    .insert({
      subject: parsed.data.subject,
      kind: parsed.data.activityId ? 'activity' : parsed.data.courseId ? 'course' : 'support',
      course_id: parsed.data.courseId ?? null,
      activity_id: parsed.data.activityId ?? null,
      created_by: user.id,
      status: 'open',
    })
    .select('id')
    .single()

  if (error || !conversa) {
    console.error('[mensagens] falha ao criar conversa', error?.message)
    return NextResponse.json({ message: 'Não foi possível abrir a conversa.' }, { status: 500 })
  }

  await admin.from('conversation_participants').insert({
    conversation_id: conversa.id,
    user_id: user.id,
    papel: 'aluna',
    last_read_at: new Date().toISOString(),
  })

  // A equipe entra como participante para poder responder.
  const { data: equipe } = await admin
    .from('profiles')
    .select('id, role')
    .in('role', ['admin', 'owner', 'instructor'])
    .limit(5)

  for (const pessoa of equipe ?? []) {
    await admin.from('conversation_participants').insert({
      conversation_id: conversa.id,
      user_id: pessoa.id,
      papel: pessoa.role === 'instructor' ? 'instrutora' : 'suporte',
    })
  }

  await admin.from('messages').insert({
    conversation_id: conversa.id,
    author_id: user.id,
    body: parsed.data.body,
  })

  return NextResponse.json({ id: conversa.id })
}
