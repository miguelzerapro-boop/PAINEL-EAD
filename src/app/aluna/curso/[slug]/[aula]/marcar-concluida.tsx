'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Marca a aula como concluída.
 *
 * A escrita vai direto na tabela via RLS (a aluna só escreve o próprio
 * progresso). O recálculo do percentual do curso é feito por trigger no banco.
 */
export function MarcarConcluida({
  lessonId,
  concluida,
  proximaHref,
}: {
  lessonId: string
  concluida: boolean
  proximaHref: string | null
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  async function concluir() {
    setErro(null)
    const db = getBrowserClient()

    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return

    const { data: aula } = await db.from('lessons').select('course_id').eq('id', lessonId).single()
    if (!aula) {
      setErro('Não encontramos esta aula.')
      return
    }

    const { data: matricula } = await db
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', aula.course_id)
      .maybeSingle()

    if (!matricula) {
      setErro('Não encontramos sua matrícula neste curso.')
      return
    }

    const { error } = await db.from('lesson_progress').upsert(
      {
        enrollment_id: matricula.id,
        lesson_id: lessonId,
        user_id: user.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,lesson_id' },
    )

    if (error) {
      setErro('Não foi possível salvar agora. Tente de novo.')
      return
    }

    startTransition(() => {
      router.refresh()
      if (proximaHref) router.push(proximaHref)
    })
  }

  if (concluida) {
    return (
      <>
        <span className="etiqueta" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          Concluída
        </span>
        {proximaHref ? (
          <a className="botao botao--primario" href={proximaHref}>
            Próxima aula →
          </a>
        ) : null}
      </>
    )
  }

  return (
    <>
      <button className="botao botao--primario" onClick={concluir} disabled={pendente}>
        {pendente ? 'Salvando…' : 'Marcar como concluída'}
      </button>
      {erro ? (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      ) : null}
    </>
  )
}
