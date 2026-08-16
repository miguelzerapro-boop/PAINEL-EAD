import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { NovaConversa } from './nova-conversa'
import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mensagens' }
export const dynamic = 'force-dynamic'

const ROTULO_ESTADO: Record<string, { texto: string; tom: string }> = {
  open: { texto: 'aberta', tom: 'acao' },
  waiting: { texto: 'aguardando você', tom: 'atencao' },
  resolved: { texto: 'resolvida', tom: 'ok' },
}

export default async function MensagensPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/mensagens')

  const { data: participacoes } = await db
    .from('conversation_participants')
    .select(
      `last_read_at,
       conversa:conversations (
         id, subject, kind, status, last_message_at, created_at,
         curso:courses (name)
       )`,
    )
    .eq('user_id', user.id)

  const conversas = (participacoes ?? [])
    .map((p) => ({
      lidoEm: p.last_read_at as string | null,
      conversa: um<{
        id: string
        subject: string | null
        kind: string
        status: string
        last_message_at: string
        curso: unknown
      }>(p.conversa),
    }))
    .filter((c) => c.conversa)
    .sort(
      (a, b) =>
        new Date(b.conversa!.last_message_at).getTime() -
        new Date(a.conversa!.last_message_at).getTime(),
    )

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Atendimento</p>
          <h1 className="titulo-pagina">Mensagens</h1>
          <p className="lead">
            Fale direto com a instrutora ou com o suporte. Cada assunto vira uma conversa.
          </p>
        </div>
        <NovaConversa />
      </div>

      {conversas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma conversa ainda"
          texto="Quando você abrir um assunto com a instrutora ou com o suporte, ele aparece aqui com todo o histórico."
        />
      ) : (
        <div className="lista">
          {conversas.map(({ conversa, lidoEm }) => {
            if (!conversa) return null
            const curso = um<{ name: string }>(conversa.curso)
            const naoLida = !lidoEm || new Date(conversa.last_message_at) > new Date(lidoEm)
            const estado = ROTULO_ESTADO[conversa.status] ?? ROTULO_ESTADO.open!

            return (
              <Link
                key={conversa.id}
                className="lista__item"
                href={`/aluna/mensagens/${conversa.id}`}
                data-state={naoLida ? 'current' : undefined}
              >
                <span className="lista__marca" aria-hidden="true" />
                <span className="lista__texto">
                  <span className="lista__titulo">
                    {conversa.subject ?? 'Conversa com o suporte'}
                  </span>
                  <span className="lista__meta">
                    {[curso?.name, formatDate(conversa.last_message_at, 'short')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="lista__fim">
                  {naoLida ? <span className="selo" data-tom="acao">nova</span> : null}
                  <span className="selo" data-tom={estado.tom}>
                    {estado.texto}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
