'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

const LIMITE = 5000

/**
 * Caixa de publicação.
 *
 * Escreve direto na tabela: a policy `community_posts_insert` já exige que o
 * `author_id` seja o próprio usuário e que ele enxergue o canal. Não há o que
 * um cliente malicioso ganhe aqui.
 */
export function Publicar({
  canais,
  canalPadrao,
}: {
  canais: Array<{ id: string; name: string; slug: string }>
  canalPadrao: string | null
}) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [canal, setCanal] = useState(canalPadrao ?? canais[0]?.id ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState(false)

  const valido = texto.trim().length >= 2 && texto.length <= LIMITE && Boolean(canal)

  async function publicar() {
    setEnviando(true)
    setErro(null)

    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      setErro('Sua sessão expirou. Entre de novo.')
      setEnviando(false)
      return
    }

    const { error } = await db.from('community_posts').insert({
      channel_id: canal,
      author_id: user.id,
      body: texto.trim(),
    })

    setEnviando(false)

    if (error) {
      setErro('Não foi possível publicar agora. Tente de novo.')
      return
    }

    setTexto('')
    setAberta(false)
    router.refresh()
  }

  if (!aberta) {
    return (
      <button type="button" className="cartao" onClick={() => setAberta(true)}>
        <span className="lista__meta">Escrever para a comunidade…</span>
      </button>
    )
  }

  return (
    <div className="cartao">
      <div className="pilha pilha--junta">
        <label className="campo">
          <span className="visually-hidden">Sua publicação</span>
          <textarea
            className="entrada"
            rows={4}
            autoFocus
            value={texto}
            maxLength={LIMITE}
            placeholder="Uma dúvida, um trabalho seu, uma inspiração…"
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <label className="campo" style={{ flex: '1 1 12rem' }}>
            <span className="visually-hidden">Canal</span>
            <select className="entrada" value={canal} onChange={(e) => setCanal(e.target.value)}>
              {canais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <span className="lista__meta mono">
            {texto.length}/{LIMITE}
          </span>
        </div>

        {erro ? (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="botao botao--primario" onClick={publicar} disabled={!valido || enviando}>
            {enviando ? 'Publicando…' : 'Publicar'}
          </button>
          <button
            className="botao botao--discreto"
            onClick={() => {
              setAberta(false)
              setTexto('')
              setErro(null)
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
