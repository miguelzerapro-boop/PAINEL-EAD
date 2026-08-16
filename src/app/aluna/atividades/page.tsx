import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Atividades' }
export const dynamic = 'force-dynamic'

const ESTADO: Record<string, { texto: string; tom: string; ordem: number }> = {
  changes_requested: { texto: 'ajuste solicitado', tom: 'atencao', ordem: 0 },
  draft: { texto: 'rascunho', tom: 'atencao', ordem: 1 },
  submitted: { texto: 'aguardando correção', tom: 'ok', ordem: 2 },
  in_review: { texto: 'em correção', tom: 'ok', ordem: 3 },
  approved: { texto: 'aprovada', tom: 'ok', ordem: 4 },
}

/**
 * Atividades da aluna.
 *
 * Cada entrega vira uma LINHA DO TEMPO: disponibilizada → enviada → corrigida
 * → devolutiva → reenvio → conclusão. A devolutiva da instrutora ganha bloco
 * próprio, em destaque — antes era um texto solto dentro de um card, fácil de
 * não ver.
 */
export default async function AtividadesPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/atividades')

  const { data: entregas } = await db
    .from('activity_submissions')
    .select(
      `id, status, grade, feedback, content, attempt, submitted_at, reviewed_at,
       atividade:activities (id, title, instructions, allow_resubmit,
         aula:lessons (title, course_id, courses (name, slug)))`,
    )
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  const lista = entregas ?? []
  const pendentes = lista.filter(
    (e) => e.status === 'changes_requested' || e.status === 'draft',
  )

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Prática</p>
          <h1 className="titulo-pagina">Atividades</h1>
          <p className="lead">
            O que você enviou, o que a instrutora devolveu e o que ainda falta.
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma atividade ainda"
          texto="As atividades práticas dos seus cursos aparecem aqui, junto com a devolutiva da instrutora."
          acao={{ label: 'Ir para meus cursos', href: '/aluna/cursos' }}
        />
      ) : (
        <div className="pilha pilha--solta">
          {pendentes.length > 0 ? (
            <section className="proximo-passo">
              <div className="proximo-passo__texto">
                <strong>
                  {pendentes.length === 1
                    ? '1 atividade esperando por você'
                    : `${pendentes.length} atividades esperando por você`}
                </strong>
                <span className="lista__meta">
                  Role até ela abaixo — está marcada em destaque.
                </span>
              </div>
            </section>
          ) : null}

          {lista.map((entrega) => {
            const atividade = um<{
              id: string
              title: string
              instructions: string | null
              allow_resubmit: boolean
              aula: unknown
            }>(entrega.atividade)
            const aula = um<{ title: string; courses: unknown }>(atividade?.aula)
            const curso = um<{ name: string; slug: string }>(aula?.courses)
            const estado = ESTADO[entrega.status] ?? { texto: entrega.status, tom: 'ok', ordem: 9 }

            const enviou = Boolean(entrega.submitted_at)
            const corrigiu = Boolean(entrega.reviewed_at)
            const precisaAjuste = entrega.status === 'changes_requested'
            const concluida = entrega.status === 'approved'

            return (
              <section className="pilha pilha--junta" key={entrega.id}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <h2 className="titulo-secao" style={{ flex: '1 1 16rem' }}>
                    {atividade?.title ?? 'Atividade'}
                  </h2>
                  <span className="selo" data-tom={estado.tom}>
                    {estado.texto}
                  </span>
                </div>

                {curso ? (
                  <p className="lista__meta">
                    <Link href={`/aluna/curso/${curso.slug}`}>{curso.name}</Link>
                    {aula?.title ? ` · ${aula.title}` : ''}
                    {entrega.attempt > 1 ? ` · ${entrega.attempt}ª tentativa` : ''}
                  </p>
                ) : null}

                <div className="linha-tempo">
                  <div className="etapa" data-feito="true">
                    <p className="etapa__rotulo">Atividade disponibilizada</p>
                    {atividade?.instructions ? (
                      <p className="lista__meta">{atividade.instructions}</p>
                    ) : null}
                  </div>

                  <div className="etapa" data-feito={enviou} data-atual={!enviou}>
                    <p className="etapa__rotulo">Você enviou</p>
                    {enviou ? (
                      <>
                        <p className="etapa__quando">{formatDate(entrega.submitted_at, 'short')}</p>
                        {entrega.content ? (
                          <div className="etapa__conteudo">
                            <p>{entrega.content}</p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="lista__meta">Ainda não enviada.</p>
                    )}
                  </div>

                  <div className="etapa" data-feito={corrigiu} data-atual={enviou && !corrigiu}>
                    <p className="etapa__rotulo">Instrutora corrigiu</p>
                    {corrigiu ? (
                      <p className="etapa__quando">{formatDate(entrega.reviewed_at, 'short')}</p>
                    ) : (
                      <p className="lista__meta">
                        {enviou ? 'Sua entrega está na fila de correção.' : 'Aguardando o envio.'}
                      </p>
                    )}
                  </div>

                  {entrega.feedback ? (
                    <div className="etapa" data-feito="true">
                      <p className="etapa__rotulo">Devolutiva</p>
                      <div className="etapa__conteudo">
                        <p>{entrega.feedback}</p>
                        {entrega.grade !== null ? (
                          <p className="lista__meta mono" style={{ marginBlockStart: 'var(--space-3)' }}>
                            Nota {Number(entrega.grade).toLocaleString('pt-BR')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {precisaAjuste ? (
                    <div className="etapa" data-atual="true">
                      <p className="etapa__rotulo">Reenvio</p>
                      <div className="etapa__conteudo">
                        <p>A instrutora pediu um ajuste. Você pode enviar de novo.</p>
                        <button
                          className="botao botao--primario"
                          style={{ marginBlockStart: 'var(--space-4)' }}
                          disabled
                          title="Envio de arquivo depende do Storage configurado"
                        >
                          Reenviar prática
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="etapa" data-feito={concluida}>
                    <p className="etapa__rotulo">Concluída</p>
                    {concluida ? (
                      <p className="lista__meta">Aprovada pela instrutora.</p>
                    ) : (
                      <p className="lista__meta">Ainda não.</p>
                    )}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
