'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

type Post = {
  id: string
  body: string
  pinned: boolean
  createdAt: string
  editedAt: string | null
  comentarios: number
  reacoes: number
  autoraId: string
  autora: string
  canal: { name: string; slug: string } | null
  aula: string | null
}

type Comentario = {
  id: string
  body: string
  created_at: string
  author_id: string
  autora: { display_name: string | null; full_name: string | null } | null
}

/**
 * Uma publicação do feed.
 *
 * Comentários carregam sob demanda: o feed inicial traz só a contagem, então
 * abrir a comunidade não custa dezenas de consultas.
 */
export function Publicacao({
  post,
  souEu,
  reagi: reagiInicial,
  mostrarCanal,
}: {
  post: Post
  souEu: boolean
  reagi: boolean
  mostrarCanal: boolean
}) {
  const router = useRouter()
  const [reagi, setReagi] = useState(reagiInicial)
  const [reacoes, setReacoes] = useState(post.reacoes)
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [novoComentario, setNovoComentario] = useState('')
  const [editando, setEditando] = useState(false)
  const [corpo, setCorpo] = useState(post.body)
  const [erro, setErro] = useState<string | null>(null)

  async function alternarReacao() {
    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return

    const proximo = !reagi
    setReagi(proximo)
    setReacoes((n) => n + (proximo ? 1 : -1))

    const { error } = proximo
      ? await db.from('community_reactions').insert({ post_id: post.id, user_id: user.id })
      : await db
          .from('community_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id)

    if (error) {
      setReagi(!proximo)
      setReacoes((n) => n + (proximo ? -1 : 1))
    }
  }

  async function abrirComentarios() {
    if (comentarios) {
      setComentarios(null)
      return
    }
    setCarregando(true)
    const { data } = await getBrowserClient()
      .from('community_comments')
      .select('id, body, created_at, author_id, autora:profiles!community_comments_author_id_fkey (display_name, full_name)')
      .eq('post_id', post.id)
      .eq('status', 'published')
      .order('created_at')
    setComentarios((data ?? []) as unknown as Comentario[])
    setCarregando(false)
  }

  async function comentar() {
    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return

    const texto = novoComentario.trim()
    if (texto.length < 2) return

    const { error } = await db
      .from('community_comments')
      .insert({ post_id: post.id, author_id: user.id, body: texto })

    if (error) {
      setErro('Não foi possível comentar agora.')
      return
    }
    setNovoComentario('')
    setComentarios(null)
    await abrirComentarios()
    router.refresh()
  }

  async function salvarEdicao() {
    const { error } = await getBrowserClient()
      .from('community_posts')
      .update({ body: corpo.trim(), edited_at: new Date().toISOString() })
      .eq('id', post.id)

    if (error) {
      setErro('Não foi possível salvar a edição.')
      return
    }
    setEditando(false)
    router.refresh()
  }

  async function apagar() {
    if (!confirm('Apagar esta publicação? Não dá para desfazer.')) return
    const { error } = await getBrowserClient().from('community_posts').delete().eq('id', post.id)
    if (error) {
      setErro('Não foi possível apagar.')
      return
    }
    router.refresh()
  }

  async function denunciar() {
    const motivo = prompt(
      'Por que você está denunciando?\n\nspam · ofensivo · fora_do_tema · dado_pessoal · outro',
      'ofensivo',
    )
    if (!motivo) return

    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return

    const { error } = await db.from('community_reports').insert({
      target_type: 'post',
      post_id: post.id,
      reporter_id: user.id,
      reason: ['spam', 'ofensivo', 'fora_do_tema', 'dado_pessoal', 'outro'].includes(motivo)
        ? motivo
        : 'outro',
    })
    setErro(error ? 'Não foi possível enviar a denúncia.' : 'Denúncia enviada. Obrigada.')
  }

  return (
    <article className="post" data-fixada={post.pinned}>
      <header className="post__topo">
        <span className="avatar" aria-hidden="true">
          {post.autora.slice(0, 1).toUpperCase()}
        </span>
        <span className="post__autora">
          <span className="post__nome">{post.autora}</span>
          <span className="post__quando">
            {formatarQuando(post.createdAt)}
            {post.editedAt ? ' · editado' : ''}
            {mostrarCanal && post.canal ? ` · ${post.canal.name}` : ''}
          </span>
        </span>
        {post.pinned ? <span className="selo" data-tom="acao">fixada</span> : null}
      </header>

      {post.aula ? (
        <p className="lista__meta" style={{ marginBlockStart: 'var(--space-3)' }}>
          Sobre a aula: {post.aula}
        </p>
      ) : null}

      {editando ? (
        <div className="pilha pilha--junta" style={{ marginBlockStart: 'var(--space-4)' }}>
          <textarea className="entrada" rows={4} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="botao botao--primario" onClick={salvarEdicao}>
              Salvar
            </button>
            <button className="botao botao--discreto" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="post__corpo">{post.body}</p>
      )}

      <footer className="post__acoes">
        <button type="button" className="post__acao" data-ativo={reagi} onClick={alternarReacao}>
          {reagi ? '♥' : '♡'} {reacoes > 0 ? reacoes : ''}
        </button>

        <button type="button" className="post__acao" onClick={abrirComentarios}>
          Comentários {post.comentarios > 0 ? post.comentarios : ''}
        </button>

        {souEu ? (
          <>
            <button type="button" className="post__acao" onClick={() => setEditando(true)}>
              Editar
            </button>
            <button type="button" className="post__acao" onClick={apagar}>
              Apagar
            </button>
          </>
        ) : (
          <button type="button" className="post__acao" onClick={denunciar}>
            Denunciar
          </button>
        )}
      </footer>

      {erro ? (
        <p className="campo__erro" role="alert" style={{ marginBlockStart: 'var(--space-3)' }}>
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="lista__meta" style={{ marginBlockStart: 'var(--space-4)' }} aria-live="polite">
          Carregando comentários…
        </p>
      ) : null}

      {comentarios ? (
        <div className="comentarios">
          {comentarios.length === 0 ? (
            <p className="lista__meta">Ainda sem comentários. Seja a primeira a responder.</p>
          ) : (
            comentarios.map((c) => {
              const nome = c.autora?.display_name ?? c.autora?.full_name ?? 'Aluna'
              return (
                <div className="comentario" key={c.id}>
                  <span className="avatar" aria-hidden="true">
                    {nome.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="comentario__corpo">
                    <span className="post__nome">{nome}</span>
                    <span className="post__quando"> · {formatarQuando(c.created_at)}</span>
                    <p className="comentario__texto">{c.body}</p>
                  </div>
                </div>
              )
            })
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <input
              className="entrada"
              style={{ flex: 1 }}
              value={novoComentario}
              placeholder="Escrever um comentário"
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && comentar()}
            />
            <button
              className="botao botao--secundario"
              onClick={comentar}
              disabled={novoComentario.trim().length < 2}
            >
              Enviar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

/** "há 3 h", "ontem", "12/03" — o relógio exato raramente importa num feed. */
function formatarQuando(iso: string) {
  const data = new Date(iso)
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  if (minutos < 60 * 24) return `há ${Math.floor(minutos / 60)} h`
  if (minutos < 60 * 48) return 'ontem'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
