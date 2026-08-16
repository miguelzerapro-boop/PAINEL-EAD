import Link from 'next/link'
import type { Metadata } from 'next'

import { EVENTO, FUNIL, ROTULO, type NomeDeEvento } from '@/lib/analytics/eventos'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Funil' }
export const dynamic = 'force-dynamic'

/**
 * O FUNIL, ETAPA A ETAPA.
 *
 * A tabela `analytics_events` existe desde a migration 09 e a instrumentação
 * escreve nela desde a rodada passada — mas não havia tela nenhuma para ler.
 * O painel do funil simplesmente não existia: `/admin/funil` respondia 404.
 *
 * A DECISÃO QUE IMPORTA AQUI: a tela aparece MESMO COM ZERO EVENTOS.
 *
 * A saída fácil seria esconder o painel enquanto não houvesse dado, para não
 * mostrar uma coluna de zeros. Mas quem abre isto agora precisa entender COMO
 * vai ser medido, e uma tela escondida não explica nada. Zero é uma medição
 * legítima: significa "ninguém passou por aqui ainda", não "quebrado".
 *
 * NENHUM NÚMERO É INVENTADO. Todos saem de `analytics_events`. Se a contagem
 * é zero, aparece zero.
 */

/** Etapas com um nome de negócio, na ordem em que acontecem. */
const ETAPAS: Array<{ evento: NomeDeEvento; explicacao: string }> = [
  { evento: EVENTO.LANDING_VIEW, explicacao: 'Alguém abriu a página inicial.' },
  { evento: EVENTO.SALES_LANDING_VIEW, explicacao: 'Chegou até a seção de planos.' },
  { evento: EVENTO.PLAN_SELECT, explicacao: 'Clicou no botão de um plano.' },
  { evento: EVENTO.CHECKOUT_START, explicacao: 'Abriu a tela de pagamento.' },
  { evento: EVENTO.PAYMENT_APPROVED, explicacao: 'O Mercado Pago confirmou o pagamento.' },
  { evento: EVENTO.ENROLLMENT_CREATED, explicacao: 'A matrícula foi criada e o acesso liberado.' },
  { evento: EVENTO.COURSE_STARTED, explicacao: 'Abriu o primeiro capítulo.' },
]

/** Caminho do diagnóstico, que é complementar e não a linha principal. */
const APOIO: NomeDeEvento[] = [
  EVENTO.QUIZ_START,
  EVENTO.QUIZ_COMPLETE,
  EVENTO.QUIZ_RESULT_VIEW,
]

function porcentagem(valor: number, base: number): string {
  if (base === 0) return '—'
  return `${Math.round((valor / base) * 100)}%`
}

export default async function FunilPage() {
  const db = createAdminClient()

  /*
   * Uma consulta por evento, com `head: true`: só o total volta, nenhuma
   * linha. São 10 contagens — mais barato do que trazer a tabela inteira
   * para contar no Node.
   */
  const nomes = [...new Set([...FUNIL, ...APOIO])]
  const contagens = new Map<string, number>()

  await Promise.all(
    nomes.map(async (nome) => {
      const { count } = await db
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('name', nome)
      contagens.set(nome, count ?? 0)
    }),
  )

  const topo = contagens.get(EVENTO.LANDING_VIEW) ?? 0
  const total = nomes.reduce((soma, n) => soma + (contagens.get(n) ?? 0), 0)

  return (
    <>
      <p className="eyebrow">Comercial</p>
      <h1>Funil</h1>

      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-6)', maxWidth: 'var(--measure-study)' }}>
        Cada etapa conta quantas vezes ela aconteceu. Os números são medidos no próprio
        site — nenhum pixel de terceiro, nada sai do domínio.
      </p>

      {total === 0 ? (
        <div className="vazio-explicado" style={{ marginBlockEnd: 'var(--space-6)' }}>
          <p className="vazio-explicado__titulo">Nenhum evento registrado ainda.</p>
          <p className="vazio-explicado__texto">
            As etapas abaixo já estão sendo medidas. Elas começam a somar assim que a
            primeira visitante abrir o site — inclusive esta visita, que aparece no próximo
            carregamento desta tela.
          </p>
        </div>
      ) : null}

      <ol className="funil" role="list">
        {ETAPAS.map((etapa, i) => {
          const valor = contagens.get(etapa.evento) ?? 0
          const anterior = i === 0 ? valor : (contagens.get(ETAPAS[i - 1]!.evento) ?? 0)

          return (
            <li className="funil__etapa" key={etapa.evento} data-vazio={valor === 0 ? 'sim' : undefined}>
              <span className="funil__ordem mono">{String(i + 1).padStart(2, '0')}</span>

              <div className="funil__corpo">
                <p className="funil__nome">{ROTULO[etapa.evento]}</p>
                <p className="funil__explicacao">{etapa.explicacao}</p>
              </div>

              <div className="funil__numeros">
                <span className="funil__valor mono">{valor}</span>
                <span className="funil__taxa">
                  {i === 0 ? 'entrada' : `${porcentagem(valor, anterior)} da etapa anterior`}
                </span>
              </div>

              {/* Barra proporcional ao topo do funil. Some quando não há topo. */}
              <span
                className="funil__barra"
                aria-hidden="true"
                style={{ '--proporcao': topo > 0 ? valor / topo : 0 } as React.CSSProperties}
              />
            </li>
          )
        })}
      </ol>

      <h2 className="titulo-secao" style={{ marginBlockStart: 'var(--space-8)' }}>
        Diagnóstico
      </h2>
      <p className="lead" style={{ marginBlock: 'var(--space-3) var(--space-5)', maxWidth: 'var(--measure-study)' }}>
        Caminho complementar. Quem responde o quiz volta para os planos com uma orientação —
        por isso ele aparece separado da linha principal.
      </p>

      <ol className="funil funil--apoio" role="list">
        {APOIO.map((evento, i) => (
          <li className="funil__etapa" key={evento} data-vazio={(contagens.get(evento) ?? 0) === 0 ? 'sim' : undefined}>
            <span className="funil__ordem mono">{String(i + 1).padStart(2, '0')}</span>
            <div className="funil__corpo">
              <p className="funil__nome">{ROTULO[evento]}</p>
            </div>
            <div className="funil__numeros">
              <span className="funil__valor mono">{contagens.get(evento) ?? 0}</span>
            </div>
          </li>
        ))}
      </ol>

      <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-7)' }}>
        Os pedidos com valor e estado de pagamento ficam em{' '}
        <Link href="/admin/pedidos">Pedidos</Link>. Os contatos do diagnóstico, em{' '}
        <Link href="/admin/leads">Leads</Link>.
      </p>
    </>
  )
}
