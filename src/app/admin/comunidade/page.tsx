import Link from 'next/link'
import type { Metadata } from 'next'

import { AcoesModeracao } from './acoes-moderacao'
import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Comunidade' }
export const dynamic = 'force-dynamic'

const MOTIVO: Record<string, string> = {
  spam: 'spam',
  ofensivo: 'conteúdo ofensivo',
  fora_do_tema: 'fora do tema',
  dado_pessoal: 'dado pessoal exposto',
  outro: 'outro',
}

/**
 * Moderação da comunidade.
 *
 * A ordem é a de quem modera: primeiro o que foi denunciado, depois o que
 * está no ar, por último os números.
 */
export default async function AdminComunidadePage() {
  const db = createAdminClient()

  const [denuncias, publicacoes, metricas, canais] = await Promise.all([
    db
      .from('community_reports')
      .select(
        `id, reason, detail, status, created_at, target_type,
         post:community_posts (id, body, author_id, status,
           autora:profiles!community_posts_author_id_fkey (display_name, full_name)),
         denunciante:profiles!community_reports_reporter_id_fkey (display_name, full_name)`,
      )
      .eq('status', 'open')
      .order('created_at'),
    db
      .from('community_posts')
      .select(
        `id, body, status, pinned, created_at, comment_count, reaction_count,
         autora:profiles!community_posts_author_id_fkey (display_name, full_name),
         canal:community_channels (name)`,
      )
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('community_channels').select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Pessoas</p>
          <h1 className="titulo-pagina">Comunidade</h1>
        </div>

        <div className="resumo" style={{ padding: 0 }}>
          <div className="resumo__item">
            <span className="resumo__valor">{metricas.count ?? 0}</span>
            <span className="resumo__rotulo">publicações</span>
          </div>
          <div className="resumo__item">
            <span className="resumo__valor">{denuncias.data?.length ?? 0}</span>
            <span className="resumo__rotulo">denúncias abertas</span>
          </div>
          <div className="resumo__item">
            <span className="resumo__valor">{canais.count ?? 0}</span>
            <span className="resumo__rotulo">canais</span>
          </div>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Denúncias abertas</h2>

          {(denuncias.data ?? []).length === 0 ? (
            <div className="cartao">
              <p className="lista__meta">Nenhuma denúncia aguardando análise.</p>
            </div>
          ) : (
            <div className="lista">
              {(denuncias.data ?? []).map((d) => {
                const post = um<{ id: string; body: string; status: string; autora: unknown }>(d.post)
                const autora = um<{ display_name: string; full_name: string }>(post?.autora)
                const quem = um<{ display_name: string; full_name: string }>(d.denunciante)

                return (
                  <div className="lista__item" key={d.id}>
                    <span className="lista__texto">
                      <span className="lista__titulo">
                        {MOTIVO[d.reason] ?? d.reason}
                        {d.detail ? ` — ${d.detail}` : ''}
                      </span>
                      <span className="lista__meta">
                        Publicação de {autora?.display_name ?? autora?.full_name ?? 'aluna'} ·
                        denunciada por {quem?.display_name ?? quem?.full_name ?? 'aluna'} ·{' '}
                        {formatDate(d.created_at, 'short')}
                      </span>
                      <span className="lista__meta" style={{ opacity: 0.85 }}>
                        “{(post?.body ?? '').slice(0, 160)}
                        {(post?.body ?? '').length > 160 ? '…' : ''}”
                      </span>
                    </span>
                    <span className="lista__fim">
                      <AcoesModeracao denunciaId={d.id} postId={post?.id ?? null} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="pilha pilha--junta">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="titulo-secao" style={{ flex: '1 1 12rem' }}>
              Últimas publicações
            </h2>
            <Link className="botao botao--secundario" href="/admin/canais">
              Gerenciar canais
            </Link>
          </div>

          {(publicacoes.data ?? []).length === 0 ? (
            <EstadoVazio
              titulo="A comunidade ainda está vazia"
              texto="Quando as alunas começarem a publicar, tudo aparece aqui para moderação."
            />
          ) : (
            <div className="lista">
              {(publicacoes.data ?? []).map((p) => {
                const autora = um<{ display_name: string; full_name: string }>(p.autora)
                const canal = um<{ name: string }>(p.canal)
                return (
                  <div className="lista__item" key={p.id} data-state={p.status === 'published' ? undefined : 'locked'}>
                    <span className="lista__texto">
                      <span className="lista__titulo">
                        {(p.body ?? '').slice(0, 90)}
                        {(p.body ?? '').length > 90 ? '…' : ''}
                      </span>
                      <span className="lista__meta">
                        {autora?.display_name ?? autora?.full_name ?? 'aluna'} · {canal?.name} ·{' '}
                        {formatDate(p.created_at, 'short')} · {p.comment_count} comentários ·{' '}
                        {p.reaction_count} reações
                      </span>
                    </span>
                    <span className="lista__fim">
                      {p.pinned ? <span className="selo" data-tom="acao">fixada</span> : null}
                      {p.status !== 'published' ? (
                        <span className="selo" data-tom="erro">{p.status}</span>
                      ) : null}
                      <AcoesModeracao postId={p.id} fixada={p.pinned} oculta={p.status !== 'published'} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
