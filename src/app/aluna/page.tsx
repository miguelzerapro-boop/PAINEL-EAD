import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FormacaoDaPrevia } from '@/components/aluna/formacao-da-previa'
import { EstadoVazio } from '@/components/estados'
import { previaAtiva } from '@/lib/admin/previa'
import { listMyEnrollments } from '@/lib/content/catalog'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Início' }
export const dynamic = 'force-dynamic'

/**
 * Início da área da aluna.
 *
 * Hierarquia deliberada, de cima para baixo:
 *   1. Continuar estudando — o único bloco grande e escuro da tela.
 *   2. Próximo passo — uma faixa curta, se houver pendência.
 *   3. Meus cursos — lista, não grade de cartões.
 *   4. Avisos — só se existirem, e discretos.
 *
 * A versão anterior tinha cinco seções com títulos do mesmo tamanho e nenhuma
 * prioridade. Aqui só a primeira coisa é grande.
 */
export default async function AlunaPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna')

  const [perfil, matriculas] = await Promise.all([
    db.from('profiles').select('full_name, display_name').eq('id', user.id).maybeSingle(),
    listMyEnrollments(user.id),
  ])

  const primeiroNome = (perfil.data?.display_name ?? perfil.data?.full_name ?? '').split(' ')[0]

  /*
   * Modo de conferência (ver `src/lib/admin/previa.ts`): a formação do plano
   * escolhido ocupa o lugar da matrícula. Nada é criado no banco.
   */
  const previa = await previaAtiva()
  if (previa) {
    return (
      <main id="conteudo" className="page section">
        <FormacaoDaPrevia previa={previa} />
      </main>
    )
  }

  if (matriculas.length === 0) {
    return (
      <main id="conteudo" className="area">
        <div className="area__topo">
          <div>
            <p className="titulo-apoio">Sua área</p>
            <h1 className="titulo-pagina">{primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}</h1>
          </div>
        </div>
        <EstadoVazio
          titulo="Você ainda não possui nenhum curso disponível"
          texto="Quando sua matrícula for liberada, ele aparecerá aqui e você recebe um aviso."
          acao={{ label: 'Ver o catálogo', href: '/cursos' }}
        />
      </main>
    )
  }

  const [atual, ...outros] = matriculas
  const cursoAtual = um<{ name: string; slug: string }>(atual?.course)
  const ultimaAula = um<{ id: string; title: string }>(atual?.last_lesson)
  const pct = Number(atual?.progress_pct ?? 0)

  const [pendencias, avisos] = await Promise.all([
    db
      .from('activity_submissions')
      .select('id, status, activities (title)')
      .eq('user_id', user.id)
      .in('status', ['changes_requested', 'draft'])
      .limit(3),
    db
      .from('notices')
      .select('id, title, body, link_url, link_label')
      .eq('status', 'published')
      .order('starts_at', { ascending: false })
      .limit(2),
  ])

  const temPendencia = (pendencias.data ?? []).length > 0

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Sua área</p>
          <h1 className="titulo-pagina">{primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}</h1>
        </div>
      </div>

      <div className="pilha pilha--solta">
        {/* 1 — a única coisa grande da tela */}
        {cursoAtual ? (
          <section className="continuar">
            <div>
              <p className="continuar__rotulo">Continuar estudando</p>
              <p className="continuar__curso">{cursoAtual.name}</p>
              {ultimaAula ? <p className="continuar__aula">{ultimaAula.title}</p> : null}

              <div className="continuar__progresso">
                <span className="continuar__trilha" aria-hidden="true">
                  <span className="continuar__feito" style={{ width: `${Math.round(pct)}%` }} />
                </span>
                <span className="continuar__valor">{Math.round(pct)}%</span>
              </div>
            </div>

            <Link className="botao botao--primario" href={`/aluna/curso/${cursoAtual.slug}`}>
              {pct > 0 ? 'Retomar' : 'Começar'}
            </Link>
          </section>
        ) : null}

        {/* 2 — próximo passo, só se houver */}
        {temPendencia ? (
          <section className="proximo-passo">
            <div className="proximo-passo__texto">
              <strong>
                {pendencias.data!.length === 1
                  ? '1 atividade esperando por você'
                  : `${pendencias.data!.length} atividades esperando por você`}
              </strong>
              <span className="lista__meta">
                {um<{ title: string }>(pendencias.data![0]?.activities)?.title ?? 'Atividade'}
              </span>
            </div>
            <Link className="botao botao--secundario" href="/aluna/atividades">
              Ver atividades
            </Link>
          </section>
        ) : null}

        {/* 3 — cursos, em lista */}
        {outros.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Meus cursos</h2>
            <div className="lista">
              {outros.map((matricula) => {
                const curso = um<{ name: string; slug: string }>(matricula.course)
                if (!curso) return null
                const p = Number(matricula.progress_pct)
                return (
                  <Link
                    key={matricula.id}
                    className="lista__item"
                    href={`/aluna/curso/${curso.slug}`}
                    data-state={p >= 100 ? 'done' : p > 0 ? 'current' : 'available'}
                  >
                    <span className="lista__marca" aria-hidden="true" />
                    <span className="lista__texto">
                      <span className="lista__titulo">{curso.name}</span>
                      <span className="lista__meta">
                        {p >= 100 ? 'concluído' : `${Math.round(p)}% concluído`}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* 4 — avisos, discretos e só se existirem */}
        {avisos.data && avisos.data.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Avisos</h2>
            <div className="lista">
              {avisos.data.map((aviso) => (
                <div key={aviso.id} className="lista__item">
                  <span className="lista__texto">
                    <span className="lista__titulo">{aviso.title}</span>
                    <span className="lista__meta">{aviso.body}</span>
                  </span>
                  {aviso.link_url ? (
                    <a className="lista__fim" href={aviso.link_url}>
                      {aviso.link_label ?? 'Abrir'}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

