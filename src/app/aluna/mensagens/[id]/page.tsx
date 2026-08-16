import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { Responder } from './responder'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Conversa' }
export const dynamic = 'force-dynamic'

export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/mensagens/${id}`)

  // A RLS só devolve a conversa se a pessoa for participante.
  const { data: conversa } = await db
    .from('conversations')
    .select('id, subject, kind, status, created_at, curso:courses (name, slug)')
    .eq('id', id)
    .maybeSingle()

  if (!conversa) notFound()

  const { data: mensagens } = await db
    .from('messages')
    .select('id, body, created_at, author_id, autora:profiles!messages_author_id_fkey (display_name, full_name, role)')
    .eq('conversation_id', id)
    .order('created_at')

  // Marca como lida — a RLS permite atualizar só a própria participação.
  await db
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .eq('user_id', user.id)

  const curso = um<{ name: string; slug: string }>(conversa.curso)

  return (
    <main id="conteudo" className="area">
      <p className="aula-foco__migalha">
        <Link href="/aluna/mensagens">Mensagens</Link>
        <span aria-hidden="true">·</span>
        <span>{conversa.status === 'resolved' ? 'resolvida' : 'aberta'}</span>
      </p>

      <div className="area__topo">
        <div>
          <h1 className="titulo-pagina">{conversa.subject ?? 'Conversa'}</h1>
          {curso ? <p className="lista__meta">{curso.name}</p> : null}
        </div>
      </div>

      <div className="pilha">
        <div className="mensagens">
          {(mensagens ?? []).length === 0 ? (
            <p className="lista__meta">Nenhuma mensagem ainda.</p>
          ) : (
            (mensagens ?? []).map((m) => {
              const autora = um<{ display_name: string; full_name: string; role: string }>(m.autora)
              const minha = m.author_id === user.id
              return (
                <div key={m.id} className="mensagem" data-minha={minha}>
                  <span className="post__nome">
                    {minha ? 'Você' : (autora?.display_name ?? autora?.full_name ?? 'Equipe')}
                  </span>
                  <span>{m.body}</span>
                  <span className="mensagem__quando">
                    {new Date(m.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {conversa.status === 'resolved' ? (
          <div className="proximo-passo">
            <div className="proximo-passo__texto">
              <strong>Esta conversa foi marcada como resolvida</strong>
              <span className="lista__meta">Responder aqui reabre o atendimento.</span>
            </div>
          </div>
        ) : null}

        <Responder conversaId={id} />
      </div>
    </main>
  )
}
