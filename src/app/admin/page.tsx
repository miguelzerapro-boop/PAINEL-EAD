import Link from 'next/link'
import type { Metadata } from 'next'

import { ListaDePendencias } from './pendencias-lista'
import { listarPendencias } from '@/lib/admin/pendencias'
import { sessaoAtual } from '@/lib/admin/sessao'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Início' }

/**
 * O INÍCIO DO PAINEL.
 *
 * Antes esta tela era a lista de pendências — 22 itens de configuração, em
 * ordem de gravidade, ocupando a primeira coisa que a responsável via ao
 * entrar. Abrir o próprio painel e ser recebida por uma lista de problemas é
 * desanimador, e pior: não é o que ela vem fazer aqui.
 *
 * A ordem agora é: como o negócio está, o que dá para fazer agora, e só então
 * o que falta resolver.
 */
export default async function InicioPage() {
  const db = createAdminClient()

  const [sessao, pendencias, alunas, pedidos, aulas] = await Promise.all([
    sessaoAtual().catch(() => null),
    listarPendencias(),
    db.from('enrollments').select('id', { count: 'exact', head: true }),
    db.from('orders').select('amount_cents, status'),
    db.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  const pagos = (pedidos.data ?? []).filter((p) => p.status === 'paid')
  const faturado = pagos.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  const primeiroNome = (sessao?.nome ?? '').split(' ')[0]
  const bloqueiam = pendencias.filter((p) => p.prioridade === 'bloqueia').length

  return (
    <>
      <p className="eyebrow">Painel</p>
      <h1 className="inicio__saudacao">
        {primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
      </h1>

      {/* --- Como o negócio está ------------------------------------------ */}
      <div className="inicio__numeros">
        <Link className="numero-cartao" href="/admin/alunas">
          <span className="numero-cartao__valor mono">{alunas.count ?? 0}</span>
          <span className="numero-cartao__rotulo">
            {alunas.count === 1 ? 'aluna' : 'alunas'}
          </span>
        </Link>

        <Link className="numero-cartao" href="/admin/vendas">
          <span className="numero-cartao__valor mono">{brl.format(faturado / 100)}</span>
          <span className="numero-cartao__rotulo">recebido</span>
        </Link>

        <Link className="numero-cartao" href="/admin/formacao">
          <span className="numero-cartao__valor mono">{aulas.count ?? 0}</span>
          <span className="numero-cartao__rotulo">
            {aulas.count === 1 ? 'aula publicada' : 'aulas publicadas'}
          </span>
        </Link>

        <a className="numero-cartao" href="#pendencias" data-alerta={bloqueiam > 0 ? 'sim' : undefined}>
          <span className="numero-cartao__valor mono">{pendencias.length}</span>
          <span className="numero-cartao__rotulo">
            {pendencias.length === 1 ? 'pendência' : 'pendências'}
          </span>
        </a>
      </div>

      {/* --- O que dá para fazer agora ------------------------------------ */}
      <h2 className="titulo-secao" style={{ marginBlockStart: 'var(--space-8)' }}>
        Ações rápidas
      </h2>

      <div className="acoes-rapidas">
        <Link className="acao-rapida" href="/admin/formacao/aula/nova">
          <span className="acao-rapida__sinal" aria-hidden="true">+</span>
          <span>
            <span className="acao-rapida__titulo">Nova aula</span>
            <span className="acao-rapida__meta">Título, vídeo e capa numa tela só</span>
          </span>
        </Link>

        <Link className="acao-rapida" href="/admin/quiz/pergunta/nova">
          <span className="acao-rapida__sinal" aria-hidden="true">+</span>
          <span>
            <span className="acao-rapida__titulo">Nova pergunta</span>
            <span className="acao-rapida__meta">Pergunta e respostas juntas</span>
          </span>
        </Link>

        <Link className="acao-rapida" href="/admin/depoimentos/novo">
          <span className="acao-rapida__sinal" aria-hidden="true">+</span>
          <span>
            <span className="acao-rapida__titulo">Novo depoimento</span>
            <span className="acao-rapida__meta">Aparece na landing quando publicado</span>
          </span>
        </Link>

        <Link className="acao-rapida" href="/admin/formacao/previa">
          <span className="acao-rapida__sinal" aria-hidden="true">→</span>
          <span>
            <span className="acao-rapida__titulo">Ver como aluna</span>
            <span className="acao-rapida__meta">Confira como ficou a área de estudos</span>
          </span>
        </Link>
      </div>

      {/* --- E só então o que falta --------------------------------------- */}
      <ListaDePendencias pendencias={pendencias} />
    </>
  )
}
