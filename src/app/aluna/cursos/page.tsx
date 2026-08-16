import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { Palheta, Trilho } from '@/components/palheta'
import { listMyEnrollments } from '@/lib/content/catalog'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Meus cursos' }
export const dynamic = 'force-dynamic'

export default async function MeusCursosPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/cursos')

  const matriculas = await listMyEnrollments(user.id)

  return (
    <main id="conteudo" className="page section">
      <p className="eyebrow">Mostruário</p>
      <h1>Meus cursos</h1>

      {matriculas.length === 0 ? (
        <div style={{ marginBlockStart: 'var(--space-6)' }}>
          <EstadoVazio
            titulo="Você ainda não possui nenhum curso disponível"
            texto="Quando sua matrícula for liberada, ele aparecerá aqui."
            acao={{ label: 'Ver o catálogo', href: '/cursos' }}
          />
        </div>
      ) : (
        <div style={{ marginBlockStart: 'var(--space-7)' }}>
          <Trilho rotulo="Cursos matriculados">
            {matriculas.map((matricula, i) => {
              const curso = um<{ name: string; slug: string }>(matricula.course)
              if (!curso) return null
              const pct = Number(matricula.progress_pct)
              const expira = formatDate(matricula.expires_at, 'short')

              return (
                <Palheta
                  key={matricula.id}
                  codigo={`N.${String(i + 1).padStart(2, '0')}`}
                  titulo={curso.name}
                  meta={
                    [
                      `${Math.round(pct)}% concluído`,
                      expira ? `acesso até ${expira}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  state={pct >= 100 ? 'done' : pct > 0 ? 'current' : 'available'}
                  href={`/aluna/curso/${curso.slug}`}
                  destaque={i === 0}
                />
              )
            })}
          </Trilho>
        </div>
      )}
    </main>
  )
}
