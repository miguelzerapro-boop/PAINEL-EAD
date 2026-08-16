import Link from 'next/link'
import type { Metadata } from 'next'

import { CabecalhoAdmin } from '@/components/admin/cabecalho'
import { Aviso } from '@/components/estados'
import { estadoDaVenda } from '@/lib/comercial/gate'
import { getVitrine } from '@/lib/comercial/planos'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Vendas' }
export const dynamic = 'force-dynamic'

/**
 * VENDAS — pedidos, planos e pagamento numa tela só.
 *
 * Antes eram três entradas de menu (Ofertas, Pedidos, Leads) e a responsável
 * precisava saber a diferença entre "oferta" e "plano" para achar o preço.
 * Aqui não existe essa distinção: são os três planos, o que cada um libera, e
 * quem comprou.
 *
 * NENHUM PREÇO ESTÁ ESCRITO NESTA TELA. Tudo sai de `offers` pela mesma
 * função que a landing usa — se a vitrine e o painel discordassem, seria
 * porque um dos dois inventou.
 */
export default async function VendasPage() {
  const db = createAdminClient()

  const [vitrine, { data: pedidos }] = await Promise.all([
    getVitrine(),
    db
      .from('orders')
      .select('id, buyer_email, buyer_name, amount_cents, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const planos = vitrine?.planos ?? []

  // O estado do pagamento vale para o site inteiro; basta perguntar por um.
  const venda = planos[0] ? await estadoDaVenda(planos[0].slug) : null

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const lista = pedidos ?? []
  const pagos = lista.filter((p) => p.status === 'paid')
  const faturado = pagos.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  return (
    <>
      <CabecalhoAdmin
        titulo="Vendas"
        descricao="Quanto entrou, o que está à venda e quem comprou."
      />

      {/*
        O estado do pagamento vem primeiro porque é a única coisa que impede
        alguém de comprar hoje — e a mensagem diz o que fazer, não o nome da
        variável de ambiente que falta.
      */}
      {venda && !venda.podeCobrar ? (
        <div style={{ marginBlock: 'var(--space-5)' }}>
          <Aviso tone="warning" titulo="As vendas ainda não estão abertas">
            O site mostra os planos e o valor, mas ninguém consegue pagar ainda. Para abrir as
            inscrições é preciso cadastrar a conta do Mercado Pago.{' '}
            <Link href="/admin/ajustes">Ir para Configurações</Link>.
          </Aviso>
        </div>
      ) : null}

      {/* --- Resumo --------------------------------------------------------- */}
      <div className="cartoes-numero" style={{ marginBlock: 'var(--space-6)' }}>
        <div className="cartao-numero">
          <span className="cartao-numero__valor mono">{pagos.length}</span>
          <span className="cartao-numero__rotulo">Compras pagas</span>
        </div>
        <div className="cartao-numero">
          <span className="cartao-numero__valor mono">{brl.format(faturado / 100)}</span>
          <span className="cartao-numero__rotulo">Total recebido</span>
        </div>
        <div className="cartao-numero">
          <span className="cartao-numero__valor mono">{lista.length}</span>
          <span className="cartao-numero__rotulo">Pedidos registrados</span>
        </div>
      </div>

      {/* --- Planos --------------------------------------------------------- */}
      <h2 className="titulo-secao">Planos à venda</h2>
      <p className="lead" style={{ marginBlock: 'var(--space-3) var(--space-5)', maxWidth: 'var(--measure-study)' }}>
        É isto que a aluna vê no site. Para mudar preço ou nome, abra o plano.
      </p>

      <div className="planos-admin">
        {planos.map((p) => (
          <article className="plano-admin" key={p.id}>
            <p className="plano-admin__nome">{p.nome}</p>
            <p className="plano-admin__preco mono">{p.precoFormatado}</p>
            <p className="plano-admin__capitulos">
              {p.capitulos} de {vitrine?.totalDeCapitulos ?? 0} capítulos liberados
            </p>
            <Link className="botao botao--secundario" href={`/admin/ofertas/${p.id}`}>
              Editar plano
            </Link>
          </article>
        ))}
      </div>

      {/* --- Pedidos -------------------------------------------------------- */}
      <h2 className="titulo-secao" style={{ marginBlockStart: 'var(--space-8)' }}>
        Últimas compras
      </h2>

      {lista.length === 0 ? (
        <div className="vazio-explicado" style={{ marginBlockStart: 'var(--space-4)' }}>
          <p className="vazio-explicado__titulo">Nenhuma compra ainda.</p>
          <p className="vazio-explicado__texto">
            As compras aparecem aqui automaticamente assim que o pagamento for aprovado. Você
            não precisa lançar nada à mão.
          </p>
        </div>
      ) : (
        <div className="tabela-rolavel" style={{ marginBlockStart: 'var(--space-4)' }}>
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Quem comprou</th>
                <th scope="col">Valor</th>
                <th scope="col">Situação</th>
                <th scope="col">Quando</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.buyer_name ?? '—'}</strong>
                    <br />
                    <span className="palheta__meta">{p.buyer_email}</span>
                  </td>
                  <td className="mono">{brl.format((p.amount_cents ?? 0) / 100)}</td>
                  <td>
                    <span className="selo" data-estado={tomDoEstado(p.status)}>
                      {rotuloDoEstado(p.status)}
                    </span>
                  </td>
                  <td className="mono">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-6)' }}>
        Quem começou o diagnóstico mas ainda não comprou aparece em{' '}
        <Link href="/admin/leads">contatos do diagnóstico</Link>.
      </p>
    </>
  )
}

/**
 * O estado do pedido em português.
 *
 * O banco guarda `paid`, `pending`, `refunded`. Mostrar esses valores crus
 * obrigaria a responsável a decorar o vocabulário do sistema.
 */
function rotuloDoEstado(estado: string | null): string {
  switch (estado) {
    case 'paid':
      return 'Pago'
    case 'pending':
      return 'Aguardando pagamento'
    case 'refunded':
      return 'Reembolsado'
    case 'cancelled':
      return 'Cancelado'
    case 'failed':
      return 'Não concluído'
    default:
      return 'Em análise'
  }
}

/**
 * O tom do badge. Só três: pago, aguardando e cancelado.
 *
 * Uma cor por estado transformaria a tabela em semáforo — e "reembolsado" e
 * "cancelado" pedem a mesma leitura de quem administra: não entrou dinheiro.
 */
function tomDoEstado(estado: string | null): string {
  if (estado === 'paid') return 'pago'
  if (estado === 'pending') return 'aguardando'
  if (estado === 'refunded' || estado === 'cancelled' || estado === 'failed') return 'cancelado'
  return 'aguardando'
}
