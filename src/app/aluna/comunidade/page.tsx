import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { Publicar } from './publicar'
import { Publicacao } from './publicacao'
import { EstadoVazio } from '@/components/estados'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Comunidade' }
export const dynamic = 'force-dynamic'

const POR_PAGINA = 10

/**
 * Feed da comunidade.
 *
 * Os canais visíveis vêm da RLS — canal de curso só aparece para quem tem
 * matrícula. Nada disso é decidido no navegador.
 */
export default async function ComunidadePage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string; pagina?: string; q?: string }>
}) {
  const { canal, pagina = '1', q } = await searchParams
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/comunidade')

  const { data: canais } = await db
    .from('community_channels')
    .select('id, name, slug, description, somente_equipe, course_id')
    .order('position')

  const lista = canais ?? []
  const canalAtual = canal ? lista.find((c) => c.slug === canal) : null

  const numero = Math.max(1, Number(pagina) || 1)
  const de = (numero - 1) * POR_PAGINA

  let consulta = db
    .from('community_posts')
    .select(
      `id, body, media, pinned, created_at, edited_at, comment_count, reaction_count,
       author_id, lesson_id,
       autora:profiles!community_posts_author_id_fkey (display_name, full_name, avatar_url),
       canal:community_channels (name, slug),
       aula:lessons (title),
       curso:courses (name, slug)`,
      { count: 'exact' },
    )
    .eq('status', 'published')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(de, de + POR_PAGINA - 1)

  if (canalAtual) consulta = consulta.eq('channel_id', canalAtual.id)
  if (q) consulta = consulta.ilike('body', `%${q}%`)

  const [{ data: posts, count }, { data: minhasReacoes }, perfil] = await Promise.all([
    consulta,
    db.from('community_reactions').select('post_id').eq('user_id', user.id),
    db.from('profiles').select('display_name, full_name, role').eq('id', user.id).maybeSingle(),
  ])

  const reagi = new Set((minhasReacoes ?? []).map((r) => r.post_id))
  const total = count ?? 0
  const temMais = de + POR_PAGINA < total
  const equipe = ['instructor', 'admin', 'owner'].includes(perfil.data?.role ?? '')
  const podePublicar = !canalAtual?.somente_equipe || equipe

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Entre alunas</p>
          <h1 className="titulo-pagina">{canalAtual ? canalAtual.name : 'Comunidade'}</h1>
          {canalAtual?.description ? <p className="lead">{canalAtual.description}</p> : null}
        </div>

        <form className="busca" action="/aluna/comunidade">
          {canalAtual ? <input type="hidden" name="canal" value={canalAtual.slug} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar publicações"
            aria-label="Buscar na comunidade"
          />
        </form>
      </div>

      <div className="pilha">
        {/* Canais */}
        <div className="chips">
          <Link className="chip" data-ativo={!canalAtual} href="/aluna/comunidade">
            Tudo
          </Link>
          {lista.map((c) => (
            <Link
              key={c.slug}
              className="chip"
              data-ativo={canalAtual?.slug === c.slug}
              href={`/aluna/comunidade?canal=${c.slug}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* Caixa de publicação */}
        {podePublicar ? (
          <Publicar
            canais={lista
              .filter((c) => !c.somente_equipe || equipe)
              .map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
            canalPadrao={canalAtual?.id ?? lista.find((c) => !c.somente_equipe)?.id ?? null}
          />
        ) : (
          <div className="cartao">
            <p className="lista__meta">
              Este canal é só para avisos da instrutora. Para conversar, use os outros canais.
            </p>
          </div>
        )}

        {/* Feed */}
        {(posts ?? []).length === 0 ? (
          q ? (
            <EstadoVazio
              titulo="Nenhuma publicação encontrada"
              texto="Tente outras palavras ou veja todos os canais."
              acao={{ label: 'Limpar busca', href: '/aluna/comunidade' }}
            />
          ) : (
            <EstadoVazio
              titulo="Ainda não há publicações por aqui"
              texto="Seja a primeira a escrever. Pode ser uma dúvida, um trabalho seu ou uma inspiração."
            />
          )
        ) : (
          <div className="feed">
            {(posts ?? []).map((post) => (
              <Publicacao
                key={post.id}
                post={{
                  id: post.id,
                  body: post.body,
                  pinned: post.pinned,
                  createdAt: post.created_at,
                  editedAt: post.edited_at,
                  comentarios: post.comment_count,
                  reacoes: post.reaction_count,
                  autoraId: post.author_id,
                  autora:
                    um<{ display_name: string; full_name: string }>(post.autora)?.display_name ??
                    um<{ full_name: string }>(post.autora)?.full_name ??
                    'Aluna',
                  canal: um<{ name: string; slug: string }>(post.canal),
                  aula: um<{ title: string }>(post.aula)?.title ?? null,
                }}
                souEu={post.author_id === user.id}
                reagi={reagi.has(post.id)}
                mostrarCanal={!canalAtual}
              />
            ))}
          </div>
        )}

        {/* Paginação */}
        {(temMais || numero > 1) && (
          <nav className="aula-nav" aria-label="Paginação">
            {numero > 1 ? (
              <Link
                className="aula-nav__link"
                href={`/aluna/comunidade?${new URLSearchParams({
                  ...(canalAtual ? { canal: canalAtual.slug } : {}),
                  pagina: String(numero - 1),
                })}`}
              >
                <span>Anterior</span>
              </Link>
            ) : (
              <span />
            )}
            <span className="lista__meta mono">página {numero}</span>
            {temMais ? (
              <Link
                className="aula-nav__link aula-nav__proxima"
                href={`/aluna/comunidade?${new URLSearchParams({
                  ...(canalAtual ? { canal: canalAtual.slug } : {}),
                  pagina: String(numero + 1),
                })}`}
              >
                <span>Próxima</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
