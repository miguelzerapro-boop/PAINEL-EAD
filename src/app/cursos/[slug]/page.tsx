import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Foto } from '@/components/foto-pendente'
import { Palheta, Trilho } from '@/components/palheta'
import { Rodape, Topo } from '@/components/site-chrome'
import { getCourseBySlug, getCourseOutline } from '@/lib/content/catalog'
import { formatDuration, formatInstallments, formatPrice, formatWorkload } from '@/lib/format'
import { um, varios } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await getCourseBySlug(slug)
  if (!curso) return { title: 'Curso não encontrado' }

  const seo = (curso.seo ?? {}) as { title?: string; description?: string }
  return {
    title: seo.title ?? curso.name,
    description: seo.description ?? curso.short_description ?? undefined,
  }
}

/**
 * Página de vendas do curso.
 *
 * Cada seção só existe se o dado correspondente estiver cadastrado:
 *  - carga horária ausente  -> não aparece
 *  - sem módulos            -> a seção "o que você vai encontrar" some
 *  - oferta sem preço       -> o bloco de investimento e o botão de compra somem
 *  - certificado desligado  -> nada é prometido
 */
export default async function CursoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const curso = await getCourseBySlug(slug)
  if (!curso) notFound()

  const [outline, oferta, whatsapp] = await Promise.all([
    getCourseOutline(curso.id),
    buscarOfertaAtiva(curso.id),
    getWhatsAppTarget(`Olá! Quero saber mais sobre o curso ${curso.name}.`),
  ])

  const capa = um<{ path?: string; alt?: string }>(curso.cover)
  const instrutoras = varios<{
    role_label: string | null
    instructors: unknown
  }>(curso.course_instructors).map((linha) => ({
    role_label: linha.role_label,
    instructors: um<{ id: string; name: string; headline: string | null; bio_short: string | null }>(
      linha.instructors,
    ),
  }))

  const cargaHoraria = formatWorkload(curso.workload_minutes)
  const preco = formatPrice(oferta?.price_cents ?? null)
  const parcelas = formatInstallments(oferta?.price_cents ?? null, oferta?.max_installments ?? null)

  const totalAulas = outline.reduce((soma, m) => soma + m.lessons.length, 0)

  return (
    <>
      <Topo />
      <main id="conteudo">
        {/* --- Abertura --- */}
        <section className="heroi">
          <div className="page heroi__grade">
            <div>
              <p className="eyebrow">Curso</p>
              <h1 className="heroi__titulo" style={{ maxWidth: '16ch' }}>
                {curso.name}
              </h1>
              {curso.short_description ? <p className="heroi__apoio">{curso.short_description}</p> : null}

              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  display: 'flex',
                  gap: 'var(--space-5)',
                  flexWrap: 'wrap',
                  marginBlockStart: 'var(--space-5)',
                }}
              >
                {um<{ name?: string }>(curso.level)?.name ? (
                  <li className="mono">{um<{ name: string }>(curso.level)!.name}</li>
                ) : null}
                {cargaHoraria ? <li className="mono">{cargaHoraria}</li> : null}
                {totalAulas > 0 ? <li className="mono">{totalAulas} aulas</li> : null}
                {curso.certificate_enabled ? <li className="mono">Com certificado</li> : null}
              </ul>

              {oferta && preco ? (
                <Link
                  className="botao botao--primario"
                  href={`/checkout/${oferta.slug}`}
                  style={{ marginBlockStart: 'var(--space-6)' }}
                >
                  Quero me inscrever
                </Link>
              ) : whatsapp.available ? (
                <a
                  className="botao botao--secundario"
                  href={whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginBlockStart: 'var(--space-6)' }}
                >
                  Falar sobre este curso
                </a>
              ) : null}
            </div>

            <div>
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
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            </div>
          </div>
        </section>

        {/* --- Descrição completa --- */}
        {curso.full_description ? (
          <section className="section section--amplo">
            <div className="page editorial">
              <p className="editorial__rotulo">Sobre o curso</p>
              <div className="prose">
                {curso.full_description.split('\n\n').map((p: string, i: number) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* --- Grade: só existe se houver módulo cadastrado --- */}
        {outline.length > 0 ? (
          <section className="section faixa-escura">
            <div className="page">
              <h2>O que você vai encontrar</h2>
              <div style={{ marginBlockStart: 'var(--space-6)' }}>
                <Trilho rotulo="Módulos do curso">
                  {outline.map((modulo, i) => (
                    <Palheta
                      key={modulo.id}
                      codigo={`M.${String(i + 1).padStart(2, '0')}`}
                      titulo={modulo.name}
                      meta={`${modulo.lessons.length} ${modulo.lessons.length === 1 ? 'aula' : 'aulas'}`}
                      destaque={i === 0}
                    />
                  ))}
                </Trilho>
              </div>
            </div>
          </section>
        ) : null}

        {/* --- Aula gratuita, se houver --- */}
        <AulaGratuita outline={outline} slug={slug} />

        {/* --- Público, pré-requisitos, materiais: cada um só se preenchido --- */}
        {(curso.audience || curso.prerequisites || curso.required_materials) && (
          <section className="section section--denso">
            <div className="page editorial">
              <p className="editorial__rotulo">Antes de começar</p>
              <div className="prose">
                {curso.audience ? (
                  <>
                    <h3>Para quem é</h3>
                    <p>{curso.audience}</p>
                  </>
                ) : null}
                {curso.prerequisites ? (
                  <>
                    <h3>Pré-requisitos</h3>
                    <p>{curso.prerequisites}</p>
                  </>
                ) : null}
                {curso.required_materials ? (
                  <>
                    <h3>Materiais necessários</h3>
                    <p>{curso.required_materials}</p>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* --- Instrutoras: só as que têm biografia cadastrada --- */}
        {instrutoras.some((i) => i.instructors?.bio_short) ? (
          <section className="section section--denso">
            <div className="page editorial">
              <p className="editorial__rotulo">Quem ensina</p>
              <div className="prose">
                {instrutoras
                  .filter((i) => i.instructors?.bio_short)
                  .map((i) => (
                    <div key={i.instructors!.id}>
                      <h3>{i.instructors!.name}</h3>
                      {i.instructors!.headline ? <p className="lead">{i.instructors!.headline}</p> : null}
                      <p>{i.instructors!.bio_short}</p>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* --- Investimento: só existe com preço definido --- */}
        {oferta && preco ? (
          <section className="section section--amplo">
            <div className="page editorial">
              <p className="editorial__rotulo">Investimento</p>
              <div>
                <p className="mono" style={{ fontSize: 'var(--size-h1)' }}>
                  {preco}
                </p>
                {parcelas ? (
                  <p className="lead">
                    ou em até {parcelas.count}× de {parcelas.value}
                  </p>
                ) : null}
                {oferta.access_note ? <p className="lead">{oferta.access_note}</p> : null}
                {oferta.guarantee_text ? (
                  <p style={{ marginBlockStart: 'var(--space-4)' }}>{oferta.guarantee_text}</p>
                ) : null}

                <Link
                  className="botao botao--primario"
                  href={`/checkout/${oferta.slug}`}
                  style={{ marginBlockStart: 'var(--space-5)' }}
                >
                  Ir para o pagamento
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Rodape />
    </>
  )
}

function AulaGratuita({
  outline,
  slug,
}: {
  outline: Awaited<ReturnType<typeof getCourseOutline>>
  slug: string
}) {
  const aula = outline.flatMap((m) => m.lessons).find((l) => l.isFree)
  if (!aula) return null

  return (
    <section className="section">
      <div className="page editorial">
        <p className="editorial__rotulo">Aula aberta</p>
        <div>
          <h2>{aula.title}</h2>
          {formatDuration(aula.durationSeconds) ? (
            <p className="mono">{formatDuration(aula.durationSeconds)}</p>
          ) : null}
          <Link
            className="botao botao--secundario"
            href={`/cursos/${slug}/aula/${aula.id}`}
            style={{ marginBlockStart: 'var(--space-4)' }}
          >
            Assistir sem custo
          </Link>
        </div>
      </div>
    </section>
  )
}

async function buscarOfertaAtiva(courseId: string) {
  const db = await createClient()

  const { data } = await db
    .from('offers')
    .select('id, slug, name, price_cents, max_installments, access_note, guarantee_text, product_id, products!inner (product_courses!inner (course_id))')
    .eq('status', 'published')
    .eq('products.product_courses.course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
