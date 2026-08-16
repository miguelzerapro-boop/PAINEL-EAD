import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { BotaoFavorito } from './favorito'
import { Aviso } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const db = await createClient()
  const { data } = await db.from('library_materials').select('title').eq('slug', slug).maybeSingle()
  return { title: data?.title ?? 'Material' }
}

const NOME_DO_TIPO: Record<string, string> = {
  ebook: 'E-book',
  apostila: 'Apostila',
  guia: 'Guia',
  checklist: 'Checklist',
  livro: 'Livro',
  extra: 'Material extra',
}

/**
 * Página de leitura do material.
 *
 * O arquivo NÃO é servido por URL pública: o botão chama a rota de servidor
 * que confere o direito de acesso (`material_is_available`) e devolve uma URL
 * assinada de vida curta.
 */
export default async function MaterialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/biblioteca/${slug}`)

  // A RLS já limita ao que ela pode ver.
  const { data: material } = await db
    .from('library_materials')
    .select(
      `id, title, slug, description, kind, page_count, published_at, download_allowed, access,
       category:material_categories (name),
       course:courses (name, slug)`,
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!material) {
    // Pode ser inexistente ou bloqueado — não revelamos qual, mas oferecemos saída.
    return (
      <main id="conteudo" className="area">
        <div className="area__topo">
          <div>
            <p className="titulo-apoio">Biblioteca</p>
            <h1 className="titulo-pagina">Material indisponível</h1>
          </div>
        </div>
        <Aviso tone="warning" titulo="Você ainda não tem acesso a este material">
          <p>
            Ele pode fazer parte de um curso em que você ainda não está matriculada, ou ter saído
            do ar. Se acha que é engano, fale com a gente.
          </p>
          <p style={{ marginBlockStart: 'var(--space-3)' }}>
            <Link href="/aluna/biblioteca">← Voltar para a biblioteca</Link>
          </p>
        </Aviso>
      </main>
    )
  }

  const [favorito, progresso] = await Promise.all([
    db
      .from('material_favorites')
      .select('material_id')
      .eq('user_id', user.id)
      .eq('material_id', material.id)
      .maybeSingle(),
    db
      .from('material_progress')
      .select('last_page')
      .eq('user_id', user.id)
      .eq('material_id', material.id)
      .maybeSingle(),
  ])

  const categoria = um<{ name: string }>(material.category)
  const curso = um<{ name: string; slug: string }>(material.course)

  return (
    <main id="conteudo" className="area">
      <p className="aula-foco__migalha">
        <Link href="/aluna/biblioteca">Biblioteca</Link>
        <span aria-hidden="true">·</span>
        <span>{NOME_DO_TIPO[material.kind]}</span>
      </p>

      <div className="area__topo">
        <div>
          <h1 className="titulo-pagina">{material.title}</h1>
          <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
            {[
              categoria?.name,
              curso?.name,
              material.page_count ? `${material.page_count} páginas` : null,
              material.published_at ? formatDate(material.published_at, 'short') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <BotaoFavorito materialId={material.id} inicial={Boolean(favorito.data)} />
      </div>

      <div className="pilha">
        {material.description ? (
          <div className="prose">
            {material.description.split('\n\n').map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        <div className="cartao">
          <p className="titulo-apoio">Leitura</p>
          <p style={{ marginBlockStart: 'var(--space-3)' }}>
            {progresso.data
              ? `Você parou na página ${progresso.data.last_page}.`
              : 'Você ainda não abriu este material.'}
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBlockStart: 'var(--space-5)' }}>
            <a className="botao botao--primario" href={`/api/biblioteca/${material.id}/abrir`}>
              {progresso.data ? 'Continuar lendo' : 'Abrir material'}
            </a>
            {material.download_allowed ? (
              <a className="botao botao--secundario" href={`/api/biblioteca/${material.id}/abrir?baixar=1`}>
                Baixar
              </a>
            ) : (
              <span className="selo">Somente leitura</span>
            )}
          </div>

          <p className="lista__meta" style={{ marginBlockStart: 'var(--space-4)' }}>
            O link de leitura vale por alguns minutos e é gerado só para você.
          </p>
        </div>

        {curso ? (
          <div className="proximo-passo">
            <div className="proximo-passo__texto">
              <strong>Este material faz parte de um curso</strong>
              <span className="lista__meta">{curso.name}</span>
            </div>
            <Link className="botao botao--secundario" href={`/aluna/curso/${curso.slug}`}>
              Ir para o curso
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
