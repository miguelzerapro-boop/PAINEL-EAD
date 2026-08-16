'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Responder na conversa.
 *
 * Escreve direto: a policy `mensagens_enviar` exige que o autor seja o próprio
 * usuário E que ele participe da conversa. Nada a validar de novo no servidor.
 */
export function Responder({ conversaId }: { conversaId: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    const corpo = texto.trim()
    if (corpo.length < 1) return

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

    const { error } = await db
      .from('messages')
      .insert({ conversation_id: conversaId, author_id: user.id, body: corpo })

    setEnviando(false)

    if (error) {
      setErro('Não foi possível enviar. Tente de novo.')
      return
    }

    setTexto('')
    router.refresh()
  }

  return (
    <div className="cartao">
      <label className="campo">
        <span className="visually-hidden">Sua mensagem</span>
        <textarea
          className="entrada"
          rows={3}
          value={texto}
          placeholder="Escrever uma mensagem"
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>

      {erro ? (
        <p className="campo__erro" role="alert" style={{ marginBlockStart: 'var(--space-3)' }}>
          {erro}
        </p>
      ) : null}

      <button
        className="botao botao--primario"
        style={{ marginBlockStart: 'var(--space-4)' }}
        onClick={enviar}
        disabled={texto.trim().length < 1 || enviando}
      >
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
    </div>
  )
}
