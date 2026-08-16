import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { Foto } from '@/components/foto-pendente'
import { getCourseBySlug, getCourseOutline } from '@/lib/content/catalog'
import { formatDuration, formatWorkload } from '@/lib/format'
import { um, varios } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'
import { motivoDaTrava } from '@/lib/content/gating'

export const metadata: Metadata = { title: 'Curso', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Página do curso na área da aluna.
 *
 * Uma ação principal: continuar. Tudo o mais é apoio. Os módulos viraram lista
 * simples — a palheta com cúpula, haste e entalhe repetida vinte vezes virava
 * ornamento, não informação.
 */
export default async function CursoDaAlunaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/curso/${slug}`)

  const curso = await getCourseBySlug(slug)
  if (!curso) notFound()

  const { data: matricula } = await db
    .from('enrollments')
    .select('id, status, progress_pct, expires_at')
    .eq('user_id', user.id)
    .eq('course_id', curso.id)
    .maybeSingle()

  if (!matricula) {
    return (
      <main id="conteudo" className="area">
        <EstadoVazio
          titulo="Você ainda não tem acesso a este curso"
          texto="Se você já se inscreveu, verifique se entrou com o mesmo e-mail usado na compra."
          acao={{ label: 'Ver a página do curso', href: `/cursos/${slug}` }}
        />
      </main>
    )
  }

  const outline = await getCourseOutline(curso.id, user.id)
  const todas = outline.flatMap((m) => m.lessons)
  const concluidas = todas.filter((l) => l.status === 'completed').length
  const proxima = todas.find((l) => l.released && l.status !== 'completed') ?? null

  const instrutoras = varios<{ instructors: unknown }>(curso.course_instructors)
    .map((linha) => um<{ name: string }>(linha.instructors))
    .filter(Boolean)

  const capa = um<{ path?: string; alt?: string }>(curso.cover)
  const pct = Number(matricula.progress_pct)

  const [materiais, canalDoCurso] = await Promise.all([
    db
      .from('library_materials')
      .select('id, title, slug, kind, page_count')
      .eq('course_id', curso.id)
      .eq('status', 'published')
      .order('position')
      .limit(6),
    db
      .from('community_channels')
      .select('slug, name')
      .eq('course_id', curso.id)
      .eq('status', 'published')
      .maybeSingle(),
  ])

  return (
    <main id="conteudo" className="area">
      <p className="aula-foco__migalha">
        <Link href="/aluna/cursos">Meus cursos</Link>
      </p>

      {/* Capa + identidade do curso */}
      <div
        style={{
          display: 'grid',
          gap: 'var(--space-5)',
          gridTemplateColumns: 'minmax(0, 1fr)',
          marginBlockEnd: 'var(--space-6)',
        }}
      >
        <div style={{ maxWidth: '22rem' }}>
          <Foto
            slot={{
              key: 'curso.capa',
              name: 'Capa do curso',
              recommendedWidth: 1600,
              recommendedHeight: 900,
              aspectRatio: '16:9',
            }}
            mediaPath={capa?.path}
            alt={capa?.alt ?? curso.name}
            sizes="22rem"
          />
        </div>

        <div>
          <h1 className="titulo-pagina">{curso.name}</h1>
          <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
            {[
              instrutoras.map((i) => i?.name).filter(Boolean).join(', '),
              formatWorkload(curso.workload_minutes),
              todas.length > 0 ? `${todas.length} aulas` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {curso.short_description ? (
            <p className="lead" style={{ marginBlockStart: 'var(--space-3)', maxWidth: 'var(--measure-study)' }}>
              {curso.short_description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="pilha pilha--solta">
        {/* Ação principal */}
        {proxima ? (
          <section className="continuar">
            <div>
              <p className="continuar__rotulo">
                {concluidas === 0 ? 'Começar o curso' : 'Continuar de onde parou'}
              </p>
              <p className="continuar__curso">{proxima.title}</p>
              <div className="continuar__progresso">
                <span className="continuar__trilha" aria-hidden="true">
                  <span className="continuar__feito" style={{ width: `${Math.round(pct)}%` }} />
                </span>
                <span className="continuar__valor">
                  {concluidas} de {todas.length}
                </span>
              </div>
            </div>
            <Link className="botao botao--primario" href={`/aluna/curso/${slug}/${proxima.id}`}>
              {concluidas === 0 ? 'Começar' : 'Continuar'}
            </Link>
          </section>
        ) : todas.length > 0 ? (
          <section className="proximo-passo">
            <div className="proximo-passo__texto">
              <strong>Você concluiu todas as aulas disponíveis</strong>
              <span className="lista__meta">
                {curso.certificate_enabled
                  ? 'Seu certificado já pode ser emitido.'
                  : 'Novas aulas aparecem aqui quando forem publicadas.'}
              </span>
            </div>
            {curso.certificate_enabled ? (
              <Link className="botao botao--primario" href="/aluna/certificados">
                Ver certificado
              </Link>
            ) : null}
          </section>
        ) : null}

        {curso.welcome_message ? (
          <div className="cartao">
            <p className="titulo-apoio">Boas-vindas</p>
            <p style={{ marginBlockStart: 'var(--space-3)' }}>{curso.welcome_message}</p>
          </div>
        ) : null}

        {/* Conteúdo */}
        {outline.length === 0 ? (
          <EstadoVazio
            titulo="As aulas ainda não foram publicadas"
            texto="Este curso já é seu. Assim que os módulos forem publicados, eles aparecem aqui."
          />
        ) : (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Conteúdo</h2>

            {outline.map((modulo, i) => {
              const totalDoCapitulo = modulo.lessons.length
              const feitasNoCapitulo = modulo.lessons.filter((l) => l.status === 'completed').length

              /*
               * Estado do capítulo. "vazio" existe separado de "não iniciado"
               * porque as duas situações pedem frases opostas: uma convida a
               * começar, a outra avisa que ainda não há o que começar.
               */
              const estadoCapitulo = !modulo.released
                ? 'bloqueado'
                : totalDoCapitulo === 0
                  ? 'vazio'
                  : feitasNoCapitulo === totalDoCapitulo
                    ? 'concluido'
                    : feitasNoCapitulo > 0
                      ? 'andamento'
                      : 'nao-iniciado'

              const rotuloDoEstado = {
                bloqueado: 'bloqueado',
                vazio: 'em preparação',
                concluido: 'concluído',
                andamento: 'em andamento',
                'nao-iniciado': 'não iniciado',
              }[estadoCapitulo]

              return (
              <details
                key={modulo.id}
                className="aula-indice"
                data-estado={estadoCapitulo}
                open={i === 0 && estadoCapitulo !== 'vazio'}
              >
                <summary>
                  <span>
                    <span className="mono" style={{ marginInlineEnd: 'var(--space-3)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {modulo.name}
                  </span>
                  <span className="capitulo-aluna__estado">
                    {/*
                      A contagem só aparece quando há aulas de verdade. Um
                      capítulo sem aula nunca mostra "0 de 0".
                    */}
                    {totalDoCapitulo > 0 ? (
                      <span className="lista__meta mono">
                        {feitasNoCapitulo} de {totalDoCapitulo}{' '}
                        {totalDoCapitulo === 1 ? 'aula' : 'aulas'}
                      </span>
                    ) : null}
                    <span className="etiqueta" data-estado={estadoCapitulo}>
                      {rotuloDoEstado}
                    </span>
                  </span>
                </summary>

                <div className="aula-indice__modulo">
                  {!modulo.released ? (
                    <p className="lista__meta" style={{ paddingBlockEnd: 'var(--space-3)' }}>
                      {motivoDaTrava('modulo')}
                    </p>
                  ) : null}

                  {/*
                    Capítulo publicado e ainda sem aula. Não se inventa aula,
                    não se mostra duração zerada, não se finge progresso.
                  */}
                  {modulo.released && totalDoCapitulo === 0 ? (
                    <p className="capitulo-aluna__vazio">
                      As aulas deste capítulo ainda serão disponibilizadas.
                    </p>
                  ) : null}

                  <div className="lista" style={{ border: 0, background: 'none' }}>
                    {modulo.lessons.map((aula) => {
                      const estado = !aula.released
                        ? 'locked'
                        : aula.status === 'completed'
                          ? 'done'
                          : aula.status === 'in_progress'
                            ? 'current'
                            : 'available'

                      if (!aula.released) {
                        return (
                          <div key={aula.id} className="lista__item" data-state="locked">
                            <span className="lista__marca" aria-hidden="true" />
                            <span className="lista__texto">
                              <span className="lista__titulo">{aula.title}</span>
                              <span className="lista__meta">{motivoDaTrava('aula')}</span>
                            </span>
                          </div>
                        )
                      }

                      return (
                        <Link
                          key={aula.id}
                          className="lista__item"
                          href={`/aluna/curso/${slug}/${aula.id}`}
                          data-state={estado}
                        >
                          <span className="lista__marca" aria-hidden="true" />
                          <span className="lista__texto">
                            <span className="lista__titulo">{aula.title}</span>
                          </span>
                          {formatDuration(aula.durationSeconds) ? (
                            <span className="lista__fim mono">
                              {formatDuration(aula.durationSeconds)}
                            </span>
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </details>
              )
            })}
          </section>
        )}

        {/* Materiais do curso */}
        {materiais.data && materiais.data.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Materiais incluídos</h2>
            <div className="lista">
              {materiais.data.map((m) => (
                <Link key={m.id} className="lista__item" href={`/aluna/biblioteca/${m.slug}`}>
                  <span className="lista__texto">
                    <span className="lista__titulo">{m.title}</span>
                    <span className="lista__meta">
                      {m.kind}
                      {m.page_count ? ` · ${m.page_count} páginas` : ''}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Comunidade do curso */}
        <div className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>Comunidade</strong>
            <span className="lista__meta">
              Tire dúvidas, mostre seus trabalhos e veja o que as outras alunas estão fazendo.
            </span>
          </div>
          <Link
            className="botao botao--secundario"
            href={
              canalDoCurso.data
                ? `/aluna/comunidade?canal=${canalDoCurso.data.slug}`
                : '/aluna/comunidade'
            }
          >
            Abrir comunidade
          </Link>
        </div>

        {/* Certificado */}
        {curso.certificate_enabled ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Certificado</h2>
            <div className="cartao">
              <p>
                {pct >= 100
                  ? 'Você concluiu o curso. Seu certificado já pode ser emitido.'
                  : `Disponível ao concluir o curso. Você está em ${Math.round(pct)}%.`}
              </p>
              {pct >= 100 ? (
                <Link
                  className="botao botao--primario"
                  href="/aluna/certificados"
                  style={{ marginBlockStart: 'var(--space-4)' }}
                >
                  Ver certificado
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
