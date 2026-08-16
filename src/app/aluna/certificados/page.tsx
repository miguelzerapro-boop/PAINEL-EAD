import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { formatDate, formatWorkload } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Certificados' }
export const dynamic = 'force-dynamic'

/**
 * Certificados.
 *
 * A listagem é uma LISTA, não uma parede de molduras — a moldura de diploma
 * só faz sentido quando o certificado é aberto. Abaixo dos conquistados vêm
 * os cursos em andamento, com o que ainda falta para emitir.
 */
export default async function CertificadosPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/certificados')

  const [{ data: certificados }, { data: matriculas }] = await Promise.all([
    db
      .from('certificates')
      .select('id, code, course_name, student_name, workload_minutes, issued_at, revoked_at')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false }),
    db
      .from('enrollments')
      .select(
        'id, progress_pct, status, curso:courses (id, name, slug, certificate_enabled, completion_criteria)',
      )
      .eq('user_id', user.id)
      .in('status', ['active', 'completed']),
  ])

  const emitidos = (certificados ?? []).filter((c) => !c.revoked_at)
  const jaTem = new Set(emitidos.map((c) => c.course_name))

  // Cursos que ainda podem gerar certificado.
  const emAndamento = (matriculas ?? [])
    .map((m) => ({ ...m, curso: um<{
      id: string
      name: string
      slug: string
      certificate_enabled: boolean
      completion_criteria: { min_progress_pct?: number } | null
    }>(m.curso) }))
    .filter((m) => m.curso?.certificate_enabled && !jaTem.has(m.curso.name))

  const vazio = emitidos.length === 0 && emAndamento.length === 0

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Conquistas</p>
          <h1 className="titulo-pagina">Certificados</h1>
        </div>
      </div>

      {vazio ? (
        <EstadoVazio
          titulo="Você ainda não tem certificados"
          texto="Eles aparecem aqui quando você concluir um curso que ofereça certificado, cumprindo os critérios definidos."
          acao={{ label: 'Ir para meus cursos', href: '/aluna/cursos' }}
        />
      ) : (
        <div className="pilha pilha--solta">
          {emitidos.length > 0 ? (
            <section className="pilha pilha--junta">
              <h2 className="titulo-secao">Conquistados</h2>
              <div className="lista">
                {emitidos.map((c) => (
                  <div key={c.id} className="lista__item" data-state="done">
                    <span className="lista__marca" aria-hidden="true" />
                    <span className="lista__texto">
                      <span className="lista__titulo">{c.course_name}</span>
                      <span className="lista__meta">
                        {[
                          `emitido em ${formatDate(c.issued_at, 'short')}`,
                          formatWorkload(c.workload_minutes),
                          `código ${c.code}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="lista__fim">
                      <Link className="botao botao--secundario" href={`/aluna/certificados/${c.id}`}>
                        Ver
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {emAndamento.length > 0 ? (
            <section className="pilha pilha--junta">
              <h2 className="titulo-secao">Em andamento</h2>
              <div className="lista">
                {emAndamento.map((m) => {
                  const pct = Number(m.progress_pct)
                  const minimo = m.curso?.completion_criteria?.min_progress_pct ?? 100
                  const falta = Math.max(0, minimo - pct)

                  return (
                    <Link
                      key={m.id}
                      className="lista__item"
                      href={`/aluna/curso/${m.curso!.slug}`}
                      data-state={pct > 0 ? 'current' : 'available'}
                    >
                      <span className="lista__marca" aria-hidden="true" />
                      <span className="lista__texto">
                        <span className="lista__titulo">{m.curso!.name}</span>
                        <span className="lista__meta">
                          {falta > 0
                            ? `faltam ${Math.round(falta)}% para emitir · você está em ${Math.round(pct)}%`
                            : 'requisitos cumpridos — o certificado será emitido'}
                        </span>
                      </span>
                      <span className="lista__fim mono">{Math.round(pct)}%</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  )
}
