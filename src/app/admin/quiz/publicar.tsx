'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Publica ou tira do ar o diagnóstico.
 *
 * Publicar incrementa a versão e grava uma fotografia completa (perguntas,
 * alternativas e resultados) no histórico — é o que permite auditar o que
 * estava no ar em cada momento.
 */
export function PublicarQuiz({ quizId, publicado }: { quizId: string; publicado: boolean }) {
  const router = useRouter()
  const [nota, setNota] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  async function publicar() {
    setEstado('enviando')
    setErro(null)
    const { error } = await getBrowserClient().rpc('publish_quiz', {
      p_quiz_id: quizId,
      p_nota: nota || null,
    })
    setEstado('idle')
    if (error) {
      setErro(error.message)
      return
    }
    setNota('')
    router.refresh()
  }

  async function despublicar() {
    setEstado('enviando')
    setErro(null)
    const { error } = await getBrowserClient().rpc('unpublish_quiz', { p_quiz_id: quizId })
    setEstado('idle')
    if (error) {
      setErro(error.message)
      return
    }
    router.refresh()
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--space-3)',
        padding: 'var(--space-5)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--surface-soft)',
        maxWidth: '40rem',
      }}
    >
      <label className="campo">
        <span className="campo__rotulo">O que mudou nesta versão?</span>
        <input
          className="entrada"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ex.: ajustei os pesos da pergunta 3"
        />
        <span className="campo__dica">Fica registrado no histórico.</span>
      </label>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="botao botao--primario" onClick={publicar} disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Publicando…' : publicado ? 'Publicar nova versão' : 'Publicar diagnóstico'}
        </button>
        {publicado ? (
          <button className="botao botao--secundario" onClick={despublicar} disabled={estado === 'enviando'}>
            Tirar do ar
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
