import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { FormacaoDaPrevia } from '@/components/aluna/formacao-da-previa'
import { EstadoVazio } from '@/components/estados'
import { previaAtiva } from '@/lib/admin/previa'
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

  /*
   * Modo de conferência: quem está olhando é da equipe e escolheu um plano.
   * A tela mostra a formação daquele plano em vez da matrícula real — sem
   * criar matrícula nenhuma. Ver `src/lib/admin/previa.ts`.
   */
  const previa = await previaAtiva()
  if (previa) {
    return (
      <main id="conteudo" className="page section">
        <FormacaoDaPrevia previa={previa} />
      </main>
    )
  }

  const matriculas = await listMyEnrollments(user.id)

  return (
    <main id="conteudo" className="page section">
      <p className="eyebrow">Mostruário</p>
      <h1>Minha Formação</h1>

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
