'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Abrir conversa.
 *
 * Passa por rota de servidor porque criar uma conversa envolve três tabelas
 * (conversa, participantes, primeira mensagem) e precisa colocar a equipe como
 * participante — coisa que a aluna não pode fazer sozinha.
 */
export function NovaConversa() {
  const router = useRouter()
  const [aberta, setAberta] = useState(false)
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const valido = assunto.trim().length >= 3 && mensagem.trim().length >= 5

  async function abrir() {
    setEnviando(true)
    setErro(null)

    const resposta = await fetch('/api/mensagens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: assunto.trim(), body: mensagem.trim() }),
    })

    setEnviando(false)

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}))
      setErro(corpo.message ?? 'Não foi possível abrir a conversa.')
      return
    }

    const { id } = await resposta.json()
    router.push(`/aluna/mensagens/${id}`)
  }

  if (!aberta) {
    return (
      <button className="botao botao--primario" onClick={() => setAberta(true)}>
        Nova conversa
      </button>
    )
  }

  return (
    <div className="cartao" style={{ width: 'min(28rem, 100%)' }}>
      <div className="pilha pilha--junta">
        <label className="campo">
          <span className="campo__rotulo">Assunto</span>
          <input
            className="entrada"
            autoFocus
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex.: dúvida sobre o acesso"
          />
        </label>

        <label className="campo">
          <span className="campo__rotulo">Mensagem</span>
          <textarea
            className="entrada"
            rows={4}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
        </label>

        {erro ? (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="botao botao--primario" onClick={abrir} disabled={!valido || enviando}>
            {enviando ? 'Abrindo…' : 'Abrir conversa'}
          </button>
          <button className="botao botao--discreto" onClick={() => setAberta(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
