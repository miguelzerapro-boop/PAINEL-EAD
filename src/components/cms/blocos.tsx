import Link from 'next/link'

import type { CmsBlock } from '@/lib/cms/page'
import { listPublishedCourses } from '@/lib/content/catalog'
import { formatWorkload } from '@/lib/format'
import { getWhatsAppTarget } from '@/lib/whatsapp'
import { createClient } from '@/lib/supabase/server'
import { Palheta, Trilho } from '@/components/palheta'
import { Foto } from '@/components/foto-pendente'

/**
 * Renderizador de blocos do CMS.
 *
 * Contrato: um bloco que nao tiver dado real NAO renderiza. Ele nao vira
 * placeholder, nao vira "Lorem", nao vira secao vazia. A pendencia aparece
 * somente no painel administrativo.
 */

export async function RenderBloco({ bloco }: { bloco: CmsBlock }) {
  switch (bloco.type) {
    case 'hero':
      return <BlocoHeroi bloco={bloco} />
    case 'diagnostic_invite':
      return <BlocoDiagnostico bloco={bloco} />
    case 'editorial_text':
      return <BlocoEditorial bloco={bloco} />
    case 'course_showcase':
      return <BlocoVitrine bloco={bloco} />
    case 'faq':
      return <BlocoFaq bloco={bloco} />
    case 'whatsapp_cta':
      return <BlocoWhatsApp bloco={bloco} />
    case 'media_editorial':
      return <BlocoImagem bloco={bloco} />
    case 'instructor_intro':
      return <BlocoInstrutora bloco={bloco} />
    case 'testimonials':
      return <BlocoDepoimentos bloco={bloco} />
    case 'metrics':
      return <BlocoMetricas bloco={bloco} />
    case 'legal_text':
      return <BlocoLegal bloco={bloco} />
    default:
      // Tipo desconhecido: nao inventar renderizacao.
      return null
  }
}

/* -------------------------------------------------------------------------- */

async function BlocoHeroi({ bloco }: { bloco: CmsBlock }) {
  const { eyebrow, title, lead, cta_label, cta_href, media_slot } = bloco.content as Record<
    string,
    string | undefined
  >
  const slot = media_slot ? await buscarSlot(media_slot) : null

  return (
    <section className="heroi">
      <div className="page heroi__grade">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="heroi__titulo">{title}</h1>
          <p className="heroi__apoio">{lead}</p>
        </div>
        {slot ? (
          <div>
            <Foto slot={slot} mediaPath={slot.mediaPath} alt={slot.alt} priority sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
        ) : null}
      </div>

      {/* O trilho fecha o herói: a última palheta é sempre a ação. */}
      <div className="page heroi__trilho">
        <Trilho rotulo="Percurso até o diagnóstico">
          <Palheta codigo="N.01" titulo="Responder" meta="4 perguntas, sem custo" />
          <Palheta codigo="N.02" titulo="Receber o diagnóstico" meta="na hora" />
          <Palheta codigo="N.03" titulo="Conversar" meta="pelo WhatsApp" />
          <Palheta acao titulo={cta_label ?? 'Começar'} href={cta_href ?? '/diagnostico'} destaque />
        </Trilho>
      </div>
    </section>
  )
}

function BlocoDiagnostico({ bloco }: { bloco: CmsBlock }) {
  const { title, lead, cta_label } = bloco.content as Record<string, string>
  return (
    <section className="section faixa-escura">
      <div className="page editorial">
        <p className="editorial__rotulo">Diagnóstico</p>
        <div>
          <h2>{title}</h2>
          {lead ? <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>{lead}</p> : null}
          <Link className="botao botao--primario" href="/diagnostico" style={{ marginBlockStart: 'var(--space-5)' }}>
            {cta_label}
          </Link>
        </div>
      </div>
    </section>
  )
}

function BlocoEditorial({ bloco }: { bloco: CmsBlock }) {
  const { title, body } = bloco.content as Record<string, string | undefined>
  if (!body) return null

  return (
    <section className="section">
      <div className="page editorial">
        <p className="editorial__rotulo">{title ?? 'Sobre'}</p>
        <div className="prose">
          {body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

async function BlocoVitrine({ bloco }: { bloco: CmsBlock }) {
  const { title, limit } = bloco.content as { title?: string; limit?: number }
  const cursos = await listPublishedCourses({ limit: limit ?? 6 })

  // Sem curso publicado, a seção inteira desaparece. Nunca inventar vitrine.
  if (cursos.length === 0) return null

  return (
    <section className="section">
      <div className="page">
        <h2>{title ?? 'Cursos disponíveis'}</h2>
        <div className="vitrine" style={{ marginBlockStart: 'var(--space-6)' }}>
          {cursos.map((curso, i) => (
            <Palheta
              key={curso.id}
              codigo={`N.${String(i + 1).padStart(2, '0')}`}
              titulo={curso.name}
              meta={[curso.levelName, formatWorkload(curso.workloadMinutes)].filter(Boolean).join(' · ') || null}
              href={`/cursos/${curso.slug}`}
              destaque={i === 0}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

async function BlocoFaq({ bloco }: { bloco: CmsBlock }) {
  const { title, scope } = bloco.content as { title?: string; scope?: string }
  const db = await createClient()
  const { data } = await db
    .from('faqs')
    .select('id, question, answer')
    .eq('status', 'published')
    .eq('scope', scope ?? 'landing')
    .order('position')

  if (!data || data.length === 0) return null

  return (
    <section className="section">
      <div className="page editorial">
        <p className="editorial__rotulo">{title ?? 'Perguntas frequentes'}</p>
        <div style={{ maxWidth: 'var(--measure-study)' }}>
          {data.map((item) => (
            <details key={item.id} style={{ borderBlockEnd: '1px solid var(--border-subtle)', padding: 'var(--space-4) 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 'var(--target-min)', display: 'flex', alignItems: 'center' }}>
                {item.question}
              </summary>
              <p style={{ marginBlockStart: 'var(--space-3)', color: 'var(--text-secondary)' }}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

async function BlocoWhatsApp({ bloco }: { bloco: CmsBlock }) {
  const { title, lead, cta_label, message } = bloco.content as Record<string, string>
  const whatsapp = await getWhatsAppTarget(message)

  // Numero nao cadastrado: o botao nao existe. Nunca apontar para numero falso.
  if (!whatsapp.available) return null

  return (
    <section className="section">
      <div className="page editorial">
        <p className="editorial__rotulo">Atendimento</p>
        <div>
          <h2>{title}</h2>
          {lead ? <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>{lead}</p> : null}
          <a
            className="botao botao--primario"
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginBlockStart: 'var(--space-5)' }}
          >
            {cta_label}
          </a>
        </div>
      </div>
    </section>
  )
}

async function BlocoImagem({ bloco }: { bloco: CmsBlock }) {
  const { media_slot, caption } = bloco.content as Record<string, string | undefined>
  const slot = media_slot ? await buscarSlot(media_slot) : null
  if (!slot) return null

  return (
    <section className="section">
      <div className="page">
        <Foto slot={slot} mediaPath={slot.mediaPath} alt={slot.alt} sizes="100vw" />
        {caption ? (
          <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-3)' }}>{caption}</p>
        ) : null}
      </div>
    </section>
  )
}

async function BlocoInstrutora({ bloco }: { bloco: CmsBlock }) {
  const { instructor_id, title, lead } = bloco.content as Record<string, string>
  const db = await createClient()

  const { data } = await db
    .from('instructors')
    .select('name, headline, bio_short, bio_full, photo:media_assets!instructors_photo_id_fkey (path, alt)')
    .eq('id', instructor_id)
    .eq('status', 'published')
    .maybeSingle()

  // Instrutora nao publicada ou sem biografia: o bloco nao vai ao ar.
  if (!data || !data.bio_short) return null

  const foto = data.photo as { path?: string; alt?: string } | null

  return (
    <section className="section">
      <div className="page editorial">
        <p className="editorial__rotulo">{title ?? 'Quem ensina'}</p>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ maxWidth: '22rem' }}>
            <Foto
              slot={{ key: 'instrutora.retrato', name: 'Retrato da instrutora', recommendedWidth: 1400, recommendedHeight: 1750, aspectRatio: '4:5' }}
              mediaPath={foto?.path}
              alt={foto?.alt ?? data.name}
              sizes="(min-width: 900px) 22rem, 100vw"
            />
          </div>
          <div className="prose">
            <h2>{data.name}</h2>
            {data.headline ? <p className="lead">{data.headline}</p> : null}
            {lead ? <p>{lead}</p> : null}
            <p>{data.bio_full ?? data.bio_short}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

async function BlocoDepoimentos({ bloco }: { bloco: CmsBlock }) {
  const { title } = bloco.content as { title?: string }
  const db = await createClient()

  // A RLS ja exige is_verified e consentimento. Sem depoimento real, some.
  const { data } = await db
    .from('testimonials')
    .select('id, author_name, author_role, author_city, content')
    .eq('status', 'published')
    .order('position')
    .limit(6)

  if (!data || data.length === 0) return null

  // Lista editorial, não grade de cartões iguais: cada depoimento é uma
  // entrada numerada, com a citação em destaque e a atribuição na margem.
  return (
    <section className="section section--amplo">
      <div className="page editorial">
        <p className="editorial__rotulo">{title ?? 'O que dizem as alunas'}</p>
        <ol className="depoimentos">
          {data.map((d, i) => (
            <li key={d.id} className="depoimento">
              <span className="depoimento__indice mono">{String(i + 1).padStart(2, '0')}</span>
              <blockquote className="depoimento__texto">{d.content}</blockquote>
              <cite className="depoimento__autora">
                {d.author_name}
                {d.author_role ? <span className="palheta__meta"> · {d.author_role}</span> : null}
                {d.author_city ? <span className="palheta__meta"> · {d.author_city}</span> : null}
              </cite>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

async function BlocoMetricas({ bloco }: { bloco: CmsBlock }) {
  const { title } = bloco.content as { title?: string }
  const db = await createClient()

  // Metrica sem fonte e sem data nao pode estar publicada (constraint no banco).
  const { data } = await db
    .from('public_metrics')
    .select('key, label, value_number, value_text, unit, source_note, measured_at')
    .eq('status', 'published')
    .order('position')

  if (!data || data.length === 0) return null

  return (
    <section className="section">
      <div className="page">
        {title ? <h2>{title}</h2> : null}
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-7)', marginBlockStart: 'var(--space-6)' }}>
          {data.map((m) => (
            <div key={m.key}>
              <dd className="mono" style={{ margin: 0, fontSize: 'var(--size-h1)' }}>
                {m.value_text ?? m.value_number?.toLocaleString('pt-BR')}
                {m.unit ?? ''}
              </dd>
              <dt style={{ color: 'var(--text-secondary)' }}>{m.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function BlocoLegal({ bloco }: { bloco: CmsBlock }) {
  const { title, body } = bloco.content as Record<string, string | undefined>
  if (!title || !body) return null

  return (
    <section className="section">
      <div className="page prose">
        <h1>{title}</h1>
        {body.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

async function buscarSlot(key: string) {
  if (!key) return null
  const db = await createClient()
  const { data } = await db
    .from('image_slots')
    .select('key, name, recommended_width, recommended_height, aspect_ratio, media:media_assets (path, alt)')
    .eq('key', key)
    .maybeSingle()

  if (!data) return null
  const media = data.media as { path?: string; alt?: string } | null

  return {
    key: data.key,
    name: data.name,
    recommendedWidth: data.recommended_width,
    recommendedHeight: data.recommended_height,
    aspectRatio: data.aspect_ratio,
    mediaPath: media?.path ?? null,
    alt: media?.alt ?? null,
  }
}
