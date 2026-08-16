import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Biblioteca' }
export const dynamic = 'force-dynamic'

const TIPOS = [
  { valor: 'todos', rotulo: 'Tudo' },
  { valor: 'ebook', rotulo: 'E-books' },
  { valor: 'apostila', rotulo: 'Apostilas' },
  { valor: 'guia', rotulo: 'Guias' },
  { valor: 'checklist', rotulo: 'Checklists' },
  { valor: 'livro', rotulo: 'Livros' },
  { valor: 'extra', rotulo: 'Extras' },
] as const

const NOME_DO_TIPO: Record<string, string> = {
  ebook: 'E-book',
  apostila: 'Apostila',
  guia: 'Guia',
  checklist: 'Checklist',
  livro: 'Livro',
  extra: 'Extra',
}

/**
 * Biblioteca da aluna.
 *
 * A RLS já filtra: o `select` só devolve material a que ela tem direito. O
 * material bloqueado aparece de propósito, em cinza e com o motivo — saber
 * que existe faz parte da oferta. Ele vem de uma consulta separada, feita
 * pelo servidor, sem expor o arquivo.
 */
export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; categoria?: string; q?: string }>
}) {
  const { tipo = 'todos', categoria, q } = await searchParams
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/biblioteca')

  let consulta = db
    .from('library_materials')
    .select(
      `id, title, slug, description, kind, page_count, published_at, access, course_id,
       download_allowed,
       category:material_categories (name, slug),
       cover:media_assets!library_materials_cover_id_fkey (path, alt),
       course:courses (name)`,
    )
    .eq('status', 'published')
    .order('position')

  if (tipo !== 'todos') consulta = consulta.eq('kind', tipo)
  if (q) consulta = consulta.ilike('title', `%${q}%`)

  const [{ data: materiais }, categorias, favoritos, recentes] = await Promise.all([
    consulta,
    db.from('material_categories').select('name, slug').eq('status', 'published').order('position'),
    db.from('material_favorites').select('material_id').eq('user_id', user.id),
    db
      .from('material_progress')
      .select('material_id, last_page, opened_at, library_materials (title, slug)')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(3),
  ])

  const listaFavoritos = new Set((favoritos.data ?? []).map((f) => f.material_id))
  let lista = materiais ?? []
  if (categoria) {
    lista = lista.filter((m) => um<{ slug: string }>(m.category)?.slug === categoria)
  }

  const temFiltro = tipo !== 'todos' || Boolean(categoria) || Boolean(q)

  return (
    <main id="conteudo" className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Materiais</p>
          <h1 className="titulo-pagina">Biblioteca</h1>
          <p className="lead">
            E-books, apostilas, guias e checklists dos seus cursos.
          </p>
        </div>

        <form className="busca" action="/aluna/biblioteca">
          {tipo !== 'todos' ? <input type="hidden" name="tipo" value={tipo} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar na biblioteca"
            aria-label="Buscar material"
          />
        </form>
      </div>

      <div className="pilha">
        {/* Continuar lendo — só aparece se ela já abriu algo */}
        {recentes.data && recentes.data.length > 0 && !temFiltro ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Continuar lendo</h2>
            <div className="lista">
              {recentes.data.map((r) => {
                const material = um<{ title: string; slug: string }>(r.library_materials)
                if (!material) return null
                return (
                  <Link
                    key={r.material_id}
                    className="lista__item"
                    href={`/aluna/biblioteca/${material.slug}`}
                  >
                    <span className="lista__marca" aria-hidden="true" />
                    <span className="lista__texto">
                      <span className="lista__titulo">{material.title}</span>
                      <span className="lista__meta">página {r.last_page}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Filtros */}
        <div className="pilha pilha--junta">
          <div className="chips">
            {TIPOS.map((t) => (
              <Link
                key={t.valor}
                className="chip"
                data-ativo={tipo === t.valor}
                href={t.valor === 'todos' ? '/aluna/biblioteca' : `/aluna/biblioteca?tipo=${t.valor}`}
              >
                {t.rotulo}
              </Link>
            ))}
          </div>

          {categorias.data && categorias.data.length > 0 ? (
            <div className="chips">
              {categorias.data.map((c) => {
                const params = new URLSearchParams()
                if (tipo !== 'todos') params.set('tipo', tipo)
                if (categoria !== c.slug) params.set('categoria', c.slug)
                return (
                  <Link
                    key={c.slug}
                    className="chip"
                    data-ativo={categoria === c.slug}
                    href={`/aluna/biblioteca${params.toString() ? `?${params}` : ''}`}
                  >
                    {c.name}
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Resultado */}
        {lista.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              titulo="Nenhum material com esses filtros"
              texto="Tente outra categoria ou limpe a busca."
              acao={{ label: 'Limpar filtros', href: '/aluna/biblioteca' }}
            />
          ) : (
            <EstadoVazio
              titulo="A biblioteca ainda está sendo montada"
              texto="Os materiais dos seus cursos aparecem aqui assim que forem publicados."
              acao={{ label: 'Voltar ao início', href: '/aluna' }}
            />
          )
        ) : (
          <div className="grade grade--estreita">
            {lista.map((material) => {
              const capa = um<{ path?: string; alt?: string }>(material.cover)
              const curso = um<{ name: string }>(material.course)
              const favorito = listaFavoritos.has(material.id)

              return (
                <Link
                  key={material.id}
                  className="material"
                  href={`/aluna/biblioteca/${material.slug}`}
                >
                  <span className="material__capa">
                    {capa?.path ? null : (
                      <span className="foto-pendente__rotulo">{NOME_DO_TIPO[material.kind]}</span>
                    )}
                    {favorito ? <span className="material__tranca">favorito</span> : null}
                  </span>

                  <span className="material__corpo">
                    <span className="titulo-apoio">
                      {NOME_DO_TIPO[material.kind]}
                      {material.page_count ? ` · ${material.page_count} p.` : ''}
                    </span>
                    <span className="material__titulo">{material.title}</span>
                    {curso ? <span className="lista__meta">{curso.name}</span> : null}
                    {material.published_at ? (
                      <span className="lista__meta mono">
                        {formatDate(material.published_at, 'short')}
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
