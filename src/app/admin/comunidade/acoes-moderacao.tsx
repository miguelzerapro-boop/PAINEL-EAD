'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Ações de moderação.
 *
 * A policy `community_posts_staff` já restringe estas escritas à equipe — não
 * é o botão que protege, é o banco.
 */
export function AcoesModeracao({
  postId,
  denunciaId,
  fixada = false,
  oculta = false,
}: {
  postId: string | null
  denunciaId?: string
  fixada?: boolean
  oculta?: boolean
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)

  // O construtor do PostgREST é "thenable", não uma Promise — daí o await
  // dentro da função em vez de exigir Promise no tipo do parâmetro.
  async function agir(fn: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true)
    const { error } = await fn()
    setOcupado(false)
    if (!error) router.refresh()
  }

  const db = () => getBrowserClient()

  return (
    <span style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      {postId ? (
        <>
          <button
            className="botao botao--discreto"
            disabled={ocupado}
            onClick={() =>
              agir(() =>
                db()
                  .from('community_posts')
                  .update({ status: oculta ? 'published' : 'hidden' })
                  .eq('id', postId),
              )
            }
          >
            {oculta ? 'Republicar' : 'Ocultar'}
          </button>

          <button
            className="botao botao--discreto"
            disabled={ocupado}
            onClick={() =>
              agir(() => db().from('community_posts').update({ pinned: !fixada }).eq('id', postId))
            }
          >
            {fixada ? 'Desafixar' : 'Fixar'}
          </button>
        </>
      ) : null}

      {denunciaId ? (
        <>
          <button
            className="botao botao--discreto"
            disabled={ocupado}
            onClick={() =>
              agir(() =>
                db()
                  .from('community_reports')
                  .update({ status: 'resolved', handled_at: new Date().toISOString() })
                  .eq('id', denunciaId),
              )
            }
          >
            Resolver
          </button>
          <button
            className="botao botao--discreto"
            disabled={ocupado}
            onClick={() =>
              agir(() =>
                db()
                  .from('community_reports')
                  .update({ status: 'rejected', handled_at: new Date().toISOString() })
                  .eq('id', denunciaId),
              )
            }
          >
            Descartar
          </button>
        </>
      ) : null}
    </span>
  )
}
