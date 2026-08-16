import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Rodape, Topo } from '@/components/site-chrome'
import { getCourseBySlug } from '@/lib/content/catalog'
import { formatDuration } from '@/lib/format'
import { varios } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const db = await createClient()
  const { data } = await db.from('lessons').select('title, is_free').eq('id', id).maybeSingle()
  return { title: data?.title ?? 'Aula' }
}

/**
 * Aula aberta (degustação), sem login.
 *
 * Só existe se a aula estiver marcada como gratuita e publicada — a própria
 * RLS impede o acesso a qualquer outra.
 */
export default async function AulaAbertaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const db = await createClient()

  const curso = await getCourseBySlug(slug)
  if (!curso) notFound()

  const { data: aula } = await db
    .from('lessons')
    .select('id, title, description, content_type, body, transcript, duration_seconds, video_provider, video_url, is_free, course_id, lesson_captions (language, label, url)')
    .eq('id', id)
    .eq('course_id', curso.id)
    .eq('is_free', true)
    .eq('status', 'published')
    .maybeSingle()

  if (!aula) notFound()

  const legendas = varios<{ language: string; label: string; url: string }>(aula.lesson_captions)

  return (
    <>
      <Topo />
      <main id="conteudo" className="page" style={{ paddingBlock: 'var(--space-5) var(--space-8)', maxWidth: 'var(--width-text)' }}>
        <p className="eyebrow">
          <Link href={`/cursos/${slug}`}>{curso.name}</Link> · aula aberta
        </p>

        {aula.content_type === 'video' && aula.video_url ? (
          <div className="aula__player" style={{ marginBlockStart: 'var(--space-4)' }}>
            {aula.video_provider && aula.video_provider !== 'upload' ? (
              <iframe
                src={aula.video_url}
                title={aula.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <video controls preload="metadata" style={{ width: '100%', height: '100%' }}>
                <source src={aula.video_url} />
                {legendas.map((c) => (
                  <track key={c.language} kind="captions" srcLang={c.language} label={c.label} src={c.url} default />
                ))}
              </video>
            )}
          </div>
        ) : null}

        <h1 className="aula__titulo">{aula.title}</h1>
        {formatDuration(aula.duration_seconds) ? (
          <p className="mono">{formatDuration(aula.duration_seconds)}</p>
        ) : null}

        {aula.description ? (
          <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>{aula.description}</p>
        ) : null}

        {aula.body ? (
          <div className="prose" style={{ marginBlockStart: 'var(--space-5)' }}>
            {String(aula.body)
              .split('\n\n')
              .map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        ) : null}

        <div className="aula__secao">
          <p className="lead">Esta é uma aula aberta. O restante do curso fica na área da aluna.</p>
          <Link className="botao botao--primario" href={`/cursos/${slug}`} style={{ marginBlockStart: 'var(--space-4)' }}>
            Ver o curso
          </Link>
        </div>
      </main>
      <Rodape />
    </>
  )
}
