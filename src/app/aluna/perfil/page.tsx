import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { FormularioPerfil } from './formulario'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Meu perfil' }
export const dynamic = 'force-dynamic'

/**
 * Perfil da aluna.
 *
 * Separação explícita, porque ela importa:
 *   · o que outras alunas veem na comunidade (nome de exibição e apresentação);
 *   · o que é só dela e da equipe (e-mail, telefone, cidade).
 *
 * A página deixa isso escrito, não implícito.
 */
export default async function PerfilPage() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna/perfil')

  const [{ data: perfil }, matriculas, certificados, publicacoes, favoritos] = await Promise.all([
    db
      .from('profiles')
      .select('full_name, display_name, email, phone, city, state, created_at, marketing_opt_in, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    db
      .from('enrollments')
      .select('id, progress_pct, curso:courses (name, slug)')
      .eq('user_id', user.id)
      .in('status', ['active', 'completed']),
    db.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .eq('status', 'published'),
    db
      .from('material_favorites')
      .select('material_id, material:library_materials (title, slug)')
      .eq('user_id', user.id)
      .limit(5),
  ])

  const nomeVisivel = perfil?.display_name ?? perfil?.full_name ?? 'Aluna'
  const cursos = matriculas.data ?? []

  return (
    <main id="conteudo" className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Conta</p>
          <h1 className="titulo-pagina">Meu perfil</h1>
        </div>
      </div>

      <div className="pilha pilha--solta">
        {/* Identidade + números */}
        <section
          className="cartao"
          style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span className="avatar avatar--grande" aria-hidden="true">
            {nomeVisivel.slice(0, 1).toUpperCase()}
          </span>
          <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
            <p style={{ fontSize: 'var(--size-h3)', fontWeight: 600 }}>{nomeVisivel}</p>
            <p className="lista__meta">
              {[perfil?.city, perfil?.state].filter(Boolean).join(' · ') || 'Cidade não informada'}
              {perfil?.created_at ? ` · na plataforma desde ${formatDate(perfil.created_at, 'short')}` : ''}
            </p>
          </div>

          <div className="resumo" style={{ padding: 0 }}>
            <div className="resumo__item">
              <span className="resumo__valor">{cursos.length}</span>
              <span className="resumo__rotulo">cursos</span>
            </div>
            <div className="resumo__item">
              <span className="resumo__valor">{certificados.count ?? 0}</span>
              <span className="resumo__rotulo">certificados</span>
            </div>
            <div className="resumo__item">
              <span className="resumo__valor">{publicacoes.count ?? 0}</span>
              <span className="resumo__rotulo">publicações</span>
            </div>
          </div>
        </section>

        {/* Edição */}
        <FormularioPerfil
          inicial={{
            display_name: perfil?.display_name ?? '',
            full_name: perfil?.full_name ?? '',
            phone: perfil?.phone ?? '',
            city: perfil?.city ?? '',
            state: perfil?.state ?? '',
            marketing_opt_in: perfil?.marketing_opt_in ?? false,
          }}
          email={perfil?.email ?? user.email ?? ''}
        />

        {/* Cursos */}
        {cursos.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Meus cursos</h2>
            <div className="lista">
              {cursos.map((m) => {
                const curso = um<{ name: string; slug: string }>(m.curso)
                if (!curso) return null
                const pct = Number(m.progress_pct)
                return (
                  <Link key={m.id} className="lista__item" href={`/aluna/curso/${curso.slug}`}>
                    <span className="lista__texto">
                      <span className="lista__titulo">{curso.name}</span>
                    </span>
                    <span className="lista__fim mono">{Math.round(pct)}%</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Favoritos */}
        {favoritos.data && favoritos.data.length > 0 ? (
          <section className="pilha pilha--junta">
            <h2 className="titulo-secao">Materiais favoritos</h2>
            <div className="lista">
              {favoritos.data.map((f) => {
                const material = um<{ title: string; slug: string }>(f.material)
                if (!material) return null
                return (
                  <Link
                    key={f.material_id}
                    className="lista__item"
                    href={`/aluna/biblioteca/${material.slug}`}
                  >
                    <span className="lista__texto">
                      <span className="lista__titulo">{material.title}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Privacidade */}
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Privacidade</h2>
          <div className="cartao">
            <p style={{ fontWeight: 600 }}>O que outras alunas veem</p>
            <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
              Apenas o seu nome de exibição e o que você publicar na comunidade.
            </p>

            <p style={{ fontWeight: 600, marginBlockStart: 'var(--space-5)' }}>
              O que fica só com você e a equipe
            </p>
            <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
              E-mail, telefone, cidade, progresso, atividades, pedidos e certificados.
            </p>

            <p className="lista__meta" style={{ marginBlockStart: 'var(--space-5)' }}>
              Para pedir uma cópia ou a exclusão dos seus dados, fale com a equipe. A LGPD dá até
              15 dias para a resposta. <Link href="/suporte">Falar com o suporte</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
