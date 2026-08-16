import Link from 'next/link'

import { BotaoRemoverDemo } from './remover-demo'
import { EstadoVazio } from '@/components/estados'
import { formatDate } from '@/lib/format'
import { listarPendencias, ROTULO_PRIORIDADE, type Prioridade } from '@/lib/admin/pendencias'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ORDEM: Prioridade[] = ['bloqueia', 'importante', 'quando_puder']

const TITULO_DO_GRUPO: Record<Prioridade, string> = {
  bloqueia: 'Bloqueia a publicação',
  importante: 'Importante',
  quando_puder: 'Quando puder',
}

/**
 * Primeira tela do painel.
 *
 * Pendências como área de trabalho, não como contadores. Cada item diz o que
 * falta, o que quebra enquanto isso, e leva ao lugar que resolve.
 */
export default async function AdminHome() {
  const db = createAdminClient()
  const [pendencias, alteracoes] = await Promise.all([
    listarPendencias().catch(() => []),
    db
      .from('cms_revisions')
      .select('id, entity_type, action, actor_name, note, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const porPrioridade = ORDEM.map((p) => ({
    prioridade: p,
    itens: pendencias.filter((x) => x.prioridade === p),
  })).filter((g) => g.itens.length > 0)

  const bloqueiam = pendencias.filter((p) => p.prioridade === 'bloqueia').length

  return (
    <div className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Painel</p>
          <h1 className="titulo-pagina">Pendências</h1>
          <p className="lead">
            {bloqueiam > 0
              ? `${bloqueiam} ${bloqueiam === 1 ? 'item impede' : 'itens impedem'} o site de ir ao ar.`
              : 'Nada impede o site de ir ao ar.'}
          </p>
        </div>

        <div className="resumo" style={{ padding: 0 }}>
          <div className="resumo__item">
            <span className="resumo__valor">{pendencias.length}</span>
            <span className="resumo__rotulo">no total</span>
          </div>
          <div className="resumo__item">
            <span className="resumo__valor">{bloqueiam}</span>
            <span className="resumo__rotulo">bloqueiam</span>
          </div>
        </div>
      </div>

      <div className="pilha pilha--solta">
        {pendencias.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma pendência"
            texto="Todas as configurações obrigatórias estão preenchidas e não há bloco incompleto."
            acao={{ label: 'Ver o site', href: '/' }}
          />
        ) : (
          porPrioridade.map((grupo) => (
            <section className="pilha pilha--junta" key={grupo.prioridade}>
              <h2 className="titulo-secao">
                {TITULO_DO_GRUPO[grupo.prioridade]}
                <span className="selo" data-tom={ROTULO_PRIORIDADE[grupo.prioridade].tom}>
                  {grupo.itens.length}
                </span>
              </h2>

              <div className="lista">
                {grupo.itens.map((item) => (
                  <div className="lista__item" key={item.id}>
                    <span className="lista__texto">
                      <span className="lista__titulo">{item.titulo}</span>
                      <span className="lista__meta">{item.descricao}</span>
                      <span className="lista__meta" style={{ opacity: 0.8 }}>
                        Afeta: {item.afeta}
                      </span>
                      {item.responsavel ? (
                        <span className="lista__meta mono">responsável: {item.responsavel}</span>
                      ) : null}
                    </span>

                    <span className="lista__fim">
                      {item.id === 'demo' ? (
                        <BotaoRemoverDemo />
                      ) : (
                        <Link className="botao botao--secundario" href={item.href}>
                          {item.acao}
                        </Link>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Últimas alterações</h2>
          <div className="lista">
            {alteracoes.data && alteracoes.data.length > 0 ? (
              alteracoes.data.map((a) => (
                <div key={a.id} className="lista__item">
                  <span className="lista__texto">
                    <span className="lista__titulo">
                      {a.entity_type} · {a.action}
                    </span>
                    {a.note ? <span className="lista__meta">{a.note}</span> : null}
                  </span>
                  <span className="lista__fim mono">
                    {a.actor_name ?? '—'} · {formatDate(a.created_at, 'short')}
                  </span>
                </div>
              ))
            ) : (
              <p className="lista__meta" style={{ padding: 'var(--space-5)' }}>
                Nenhuma alteração registrada ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
