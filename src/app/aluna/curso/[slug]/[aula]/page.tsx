import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { MarcarConcluida } from './marcar-concluida'
import { EstadoVazio } from '@/components/estados'
import { getCourseBySlug, getCourseOutline } from '@/lib/content/catalog'
import { formatDuration } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { motivoDaTrava } from '@/lib/content/gating'

export const metadata: Metadata = { title: 'Aula', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Tela da aula.
 *
 * A aula é o foco absoluto: coluna única, largura de leitura, sem segunda
 * navegação permanente. A lista de aulas virou um `<details>` recolhido —
 * antes ela ocupava uma barra lateral inteira e disputava atenção com o menu
 * do lado oposto.
 *
 * A ordem é a de quem está estudando: assistir → concluir → próxima.
 */
export default async function AulaPage({
  params,
}: {
  params: Promise<{ slug: string; aula: string }>
}) {
  const { slug, aula: lessonId } = await params
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/curso/${slug}/${lessonId}`)

  const curso = await getCourseBySlug(slug)
  if (!curso) notFound()

  const { data: liberada } = await db.rpc('lesson_is_released', {
    p_lesson_id: lessonId,
    p_user_id: user.id,
  })

  const { data: aula } = await db
    .from('lessons')
    .select(
      `id, title, description, content_type, body, transcript, duration_seconds, module_id,
       video_provider, video_url, video_asset_id, audio_url,
       live_starts_at, live_url, live_replay_url,
       lesson_captions (language, label, url),
       materials (id, title, description, kind, external_url, status, position),
       lesson_checklist_items (id, text, help_text, position),
       activities (id, title, instructions, submission_type, status)`,
    )
    .eq('id', lessonId)
    .maybeSingle()

  if (!aula) notFound()

  if (!liberada) {
    return (
      <main id="conteudo" className="area">
        <p className="aula-foco__migalha">
          <Link href={`/aluna/curso/${slug}`}>{curso.name}</Link>
        </p>
        <EstadoVazio
          titulo="Esta aula ainda não está liberada"
          texto={motivoDaTrava('aula')}
          acao={{ label: 'Voltar ao curso', href: `/aluna/curso/${slug}` }}
        />
      </main>
    )
  }

  const outline = await getCourseOutline(curso.id, user.id)
  const todas = outline.flatMap((m) => m.lessons)
  const indice = todas.findIndex((l) => l.id === lessonId)
  const anterior = indice > 0 ? todas[indice - 1] : null
  const proxima = todas[indice + 1] ?? null

  const { data: progresso } = await db
    .from('lesson_progress')
    .select('status')
    .eq('lesson_id', lessonId)
    .eq('user_id', user.id)
    .maybeSingle()

  const materiais = (aula.materials ?? []).filter((m) => m.status === 'published')
  const checklist = (aula.lesson_checklist_items ?? []).sort((a, b) => a.position - b.position)
  const atividades = (aula.activities ?? []).filter((a) => a.status === 'published')

  const moduloAtual = outline.find((m) => m.lessons.some((l) => l.id === lessonId))

  return (
    <main id="conteudo" className="aula-foco">
      <p className="aula-foco__migalha">
        <Link href={`/aluna/curso/${slug}`}>{curso.name}</Link>
        {moduloAtual ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{moduloAtual.name}</span>
          </>
        ) : null}
      </p>

      <Reprodutor aula={aula} />

      <h1 className="aula-foco__titulo">{aula.title}</h1>
      {formatDuration(aula.duration_seconds) ? (
        <p className="lista__meta mono" style={{ marginBlockStart: 'var(--space-2)' }}>
          {formatDuration(aula.duration_seconds)}
        </p>
      ) : null}

      {aula.description ? (
        <p className="lead" style={{ marginBlockStart: 'var(--space-4)', maxWidth: 'none' }}>
          {aula.description}
        </p>
      ) : null}

      {aula.body ? (
        <div className="prose" style={{ marginBlockStart: 'var(--space-5)' }}>
          {aula.body.split('\n\n').map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      {/* Anterior · concluir · próxima — o gesto principal da tela */}
      <nav className="aula-nav" aria-label="Navegação entre aulas">
        {anterior ? (
          <Link className="aula-nav__link" href={`/aluna/curso/${slug}/${anterior.id}`}>
            <span>← Anterior</span>
            <strong>{anterior.title}</strong>
          </Link>
        ) : (
          <span />
        )}

        <MarcarConcluida
          lessonId={aula.id}
          concluida={progresso?.status === 'completed'}
          proximaHref={proxima ? `/aluna/curso/${slug}/${proxima.id}` : null}
        />

        {proxima && proxima.released ? (
          <Link
            className="aula-nav__link aula-nav__proxima"
            href={`/aluna/curso/${slug}/${proxima.id}`}
          >
            <span>Próxima →</span>
            <strong>{proxima.title}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <div className="pilha" style={{ marginBlockStart: 'var(--space-6)' }}>
        {materiais.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Materiais da aula</h2>
            <div className="lista">
              {materiais.map((m) => (
                <a
                  key={m.id}
                  className="lista__item"
                  href={m.external_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="lista__texto">
                    <span className="lista__titulo">{m.title}</span>
                    {m.description ? <span className="lista__meta">{m.description}</span> : null}
                  </span>
                  <span className="lista__fim selo">{m.kind}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {checklist.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Checklist da prática</h2>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
              {checklist.map((item) => (
                <li key={item.id} className="consentimento">
                  <input type="checkbox" />
                  <span>
                    {item.text}
                    {item.help_text ? <span className="campo__dica"> — {item.help_text}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {atividades.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Atividade</h2>
            {atividades.map((a) => (
              <div className="cartao" key={a.id}>
                <p style={{ fontWeight: 600 }}>{a.title}</p>
                {a.instructions ? (
                  <p style={{ marginBlockStart: 'var(--space-2)' }}>{a.instructions}</p>
                ) : null}
                <Link
                  className="botao botao--secundario"
                  href="/aluna/atividades"
                  style={{ marginBlockStart: 'var(--space-4)' }}
                >
                  Enviar minha prática
                </Link>
              </div>
            ))}
          </section>
        ) : null}

        {/* Conversar sobre a aula — liga a comunidade ao conteúdo */}
        <div className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>Ficou com dúvida?</strong>
            <span className="lista__meta">
              Pergunte na comunidade e a instrutora responde por lá.
            </span>
          </div>
          <Link
            className="botao botao--secundario"
            href={`/aluna/comunidade?canal=duvidas&aula=${aula.id}`}
          >
            Conversar sobre esta aula
          </Link>
        </div>

        {aula.transcript ? (
          <details className="aula-indice">
            <summary>Transcrição</summary>
            <div className="prose" style={{ padding: 'var(--space-5)' }}>
              {aula.transcript.split('\n\n').map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
        ) : null}

        {/* A lista de aulas: recolhida, não uma segunda navegação */}
        <details className="aula-indice">
          <summary>
            Todas as aulas do curso
            <span className="lista__meta mono">
              {indice + 1} de {todas.length}
            </span>
          </summary>

          {outline.map((modulo) => (
            <div className="aula-indice__modulo" key={modulo.id}>
              <p className="titulo-apoio">{modulo.name}</p>
              <div className="lista" style={{ border: 0, background: 'none' }}>
                {modulo.lessons.map((l) => {
                  const estado =
                    l.id === lessonId
                      ? 'current'
                      : !l.released
                        ? 'locked'
                        : l.status === 'completed'
                          ? 'done'
                          : 'available'

                  if (!l.released) {
                    return (
                      <div key={l.id} className="lista__item" data-state="locked">
                        <span className="lista__marca" aria-hidden="true" />
                        <span className="lista__texto">
                          <span className="lista__titulo">{l.title}</span>
                          <span className="lista__meta">{motivoDaTrava('aula')}</span>
                        </span>
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={l.id}
                      className="lista__item"
                      href={`/aluna/curso/${slug}/${l.id}`}
                      data-state={estado}
                    >
                      <span className="lista__marca" aria-hidden="true" />
                      <span className="lista__texto">
                        <span className="lista__titulo">{l.title}</span>
                      </span>
                      {formatDuration(l.durationSeconds) ? (
                        <span className="lista__fim mono">{formatDuration(l.durationSeconds)}</span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </details>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */

type AulaMinima = {
  id: string
  content_type: string
  video_provider: string | null
  video_url: string | null
  video_asset_id: string | null
  audio_url: string | null
  live_url: string | null
  live_replay_url: string | null
  title: string
  lesson_captions?: Array<{ language: string; label: string; url: string }> | null
}

function Reprodutor({ aula }: { aula: AulaMinima }) {
  if (aula.content_type === 'video') {
    /*
     * Vídeo enviado pelo painel.
     *
     * A fonte NÃO é o arquivo: é a rota `/api/aulas/{id}/video`, que checa a
     * sessão e pergunta ao banco (`lesson_is_released`) antes de redirecionar
     * para uma URL assinada de 15 minutos. Nenhum endereço permanente do
     * bucket chega ao HTML — quem abrir o "ver código-fonte" desta página não
     * encontra um link para o vídeo, só o caminho da rota protegida.
     */
    if (aula.video_asset_id) {
      return (
        <div className="aula-foco__player">
          <video
            controls
            preload="metadata"
            playsInline
            controlsList="nodownload"
            style={{ width: '100%', height: '100%' }}
          >
            <source src={`/api/aulas/${aula.id}/video`} />
            {(aula.lesson_captions ?? []).map((c) => (
              <track key={c.language} kind="captions" srcLang={c.language} label={c.label} src={c.url} default />
            ))}
            Seu navegador não consegue reproduzir este vídeo.
          </video>
        </div>
      )
    }

    if (!aula.video_url) {
      return (
        <div className="aula-foco__player">
          <p className="foto-pendente__rotulo">Vídeo ainda não enviado</p>
        </div>
      )
    }

    const incorporavel = aula.video_provider && aula.video_provider !== 'upload'
    return (
      <div className="aula-foco__player">
        {incorporavel ? (
          <iframe
            src={aula.video_url}
            title={aula.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <video controls preload="metadata" playsInline style={{ width: '100%', height: '100%' }}>
            <source src={aula.video_url} />
            {(aula.lesson_captions ?? []).map((c) => (
              <track key={c.language} kind="captions" srcLang={c.language} label={c.label} src={c.url} default />
            ))}
          </video>
        )}
      </div>
    )
  }

  if (aula.content_type === 'audio' && aula.audio_url) {
    return (
      <div className="cartao">
        <audio controls preload="metadata" style={{ width: '100%' }}>
          <source src={aula.audio_url} />
        </audio>
      </div>
    )
  }

  if (aula.content_type === 'live') {
    const url = aula.live_replay_url ?? aula.live_url
    return (
      <div className="cartao">
        <p className="titulo-apoio">Aula ao vivo</p>
        {url ? (
          <a className="botao botao--primario" href={url} target="_blank" rel="noopener noreferrer" style={{ marginBlockStart: 'var(--space-4)' }}>
            Entrar na transmissão
          </a>
        ) : (
          <p style={{ marginBlockStart: 'var(--space-3)' }}>
            O link da transmissão ainda não foi cadastrado.
          </p>
        )}
      </div>
    )
  }

  // Texto ou PDF: não existe player. Nada é renderizado.
  return null
}
