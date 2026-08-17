import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { planoDaAluna } from '@/lib/aluna/plano'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Aluna' }

/**
 * FICHA DA ALUNA.
 *
 * Reúne numa tela o que antes exigiria abrir matrícula, pedido e progresso
 * separados: qual plano ela comprou, quais capítulos isso abriu, quanto ela
 * já andou e como foi o pagamento.
 *
 * Os capítulos vêm de `offer_module_access` — a mesma tabela que o banco
 * consulta para liberar acesso. Nenhuma regra é reimplementada aqui.
 */
export default async function AlunaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()

  const { data: perfil } = await db
    .from('profiles')
    .select('id, full_name, display_name, email, city, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!perfil) notFound()

  const [{ data: matriculas }, { data: pedidos }, { data: progresso }] = await Promise.all([
    db
      .from('enrollments')
      .select('id, status, progress_pct, source, created_at, courses:course_id (name, slug)')
      .eq('user_id', id),
    db
      .from('orders')
      .select('id, amount_cents, status, created_at, offers:offer_id (name, slug)')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    db.from('lesson_progress').select('id, updated_at').eq('user_id', id).order('updated_at', { ascending: false }).limit(1),
  ])

  /* --- Que plano ela tem, e o que ele abre --------------------------------
   *
   * Antes isto partia do PEDIDO PAGO. Funcionava para quem comprou e mentia
   * para quem foi matriculada à mão: sem pedido, a ficha anunciava "nenhum
   * capítulo foi liberado" — justamente enquanto a aluna via os oito na área
   * dela. A ficha agora pergunta ao banco o que ela abre, que é a única
   * resposta que coincide com a experiência dela.
   */
  const plano = await planoDaAluna(id)

  let capitulos: Array<{ nome: string; aberto: boolean }> = []

  if (plano) {
    const { data: curso } = await db.from('courses').select('id').eq('slug', 'formacao').maybeSingle()
    if (curso) {
      const { data: modulos } = await db
        .from('modules')
        .select('id, name, position')
        .eq('course_id', curso.id)
        .order('position')

      const abertos = new Set(plano.modulosAbertos)
      capitulos = (modulos ?? []).map((m) => ({ nome: m.name, aberto: abertos.has(m.id) }))
    }
  }

  const nome = perfil.display_name ?? perfil.full_name ?? 'Aluna'
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const data = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : null)

  const matricula = (matriculas ?? [])[0]
  const ultimoAcesso = data(progresso?.[0]?.updated_at ?? null)

  return (
    <>
      <p className="admin__migalha">
        <Link href="/admin/alunas">Alunas</Link>
      </p>

      <h1 className="admin__titulo">{nome}</h1>

      <div className="ficha">
        {/* --- Quem é ------------------------------------------------------ */}
        <section className="ficha__bloco">
          <h2 className="ficha__titulo">Dados</h2>
          <dl className="ficha__dados">
            <Dado rotulo="E-mail" valor={perfil.email} />
            <Dado rotulo="Cidade" valor={perfil.city} />
            <Dado rotulo="Cadastro" valor={data(perfil.created_at)} />
            <Dado
              rotulo="Último acesso ao conteúdo"
              valor={ultimoAcesso}
              /* Sem dado real não se inventa "hoje" nem "nunca acessou". */
              vazio="Ainda não abriu nenhuma aula"
            />
          </dl>
        </section>

        {/* --- O que comprou ----------------------------------------------- */}
        <section className="ficha__bloco">
          <h2 className="ficha__titulo">Plano e acesso</h2>

          {plano ? (
            <dl className="ficha__dados">
              <Dado
                rotulo="Plano"
                valor={plano.nome}
                /* Sem oferta equivalente não se inventa um plano. */
                vazio="Acesso liberado pela escola"
              />
              <Dado
                rotulo="Situação"
                valor={matricula ? rotuloDaMatricula(matricula.status) : 'Sem matrícula'}
              />
              <Dado rotulo="Origem da matrícula" valor={rotuloDaOrigem(plano.origem)} />
              <Dado rotulo="Matrícula em" valor={data(matricula?.created_at ?? null)} />
              <Dado
                rotulo="Progresso"
                valor={matricula ? `${Math.round(Number(matricula.progress_pct ?? 0))}%` : null}
              />
            </dl>
          ) : (
            <p className="ficha__vazio">
              Esta pessoa ainda não está matriculada na formação, então nenhum capítulo foi
              liberado.
            </p>
          )}

          {capitulos.length > 0 ? (
            <>
              <h3 className="ficha__subtitulo">
                Capítulos liberados ({capitulos.filter((c) => c.aberto).length} de{' '}
                {capitulos.length})
              </h3>
              <ul className="ficha__capitulos" role="list">
                {capitulos.map((c) => (
                  <li key={c.nome} data-aberto={c.aberto ? 'sim' : 'nao'}>
                    {c.nome}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* --- Pagamentos --------------------------------------------------- */}
        <section className="ficha__bloco">
          <h2 className="ficha__titulo">Pagamentos</h2>
          {/*
            AUSÊNCIA DE PAGAMENTO NÃO É FALHA quando a matrícula foi concedida
            pelo painel. A frase anterior — "nenhuma compra registrada" — servia
            para quem deveria ter comprado e não comprou; aqui ela faria a
            responsável procurar um pagamento que nunca existiu. O texto diz o
            motivo, e o acesso fica explicado em vez de pendente.
          */}
          {(pedidos ?? []).length === 0 ? (
            plano && plano.origem !== 'order' ? (
              <p className="ficha__nota">
                <strong>Matrícula manual.</strong> O acesso foi concedido pelo painel, sem
                cobrança — não há pagamento a registrar.
              </p>
            ) : (
              <p className="ficha__vazio">Nenhuma compra registrada para esta pessoa.</p>
            )
          ) : (
            <ul className="ficha__pedidos" role="list">
              {(pedidos ?? []).map((p) => (
                <li key={p.id}>
                  <span>{um<{ name: string }>(p.offers)?.name ?? 'Plano'}</span>
                  <span className="mono">{brl.format((p.amount_cents ?? 0) / 100)}</span>
                  <span>{rotuloDoPedido(p.status)}</span>
                  <span className="mono">{data(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/*
        Visualizar como esta aluna. Reaproveita o modo de conferência já
        aprovado: abre a área real com os capítulos do PLANO dela. Continua
        sendo leitura — nada é criado, nenhum progresso é gravado.
      */}
      {plano?.slug ? (
        <p style={{ marginBlockStart: 'var(--space-7)' }}>
          <a className="botao botao--cta" href={`/admin/previa/entrar?plano=${plano.slug}`}>
            Visualizar como esta aluna
          </a>
        </p>
      ) : null}
    </>
  )
}

function Dado({
  rotulo,
  valor,
  vazio = 'Não informado',
}: {
  rotulo: string
  valor: string | null | undefined
  vazio?: string
}) {
  return (
    <div className="ficha__dado">
      <dt>{rotulo}</dt>
      <dd>{valor || <span className="ficha__nulo">{vazio}</span>}</dd>
    </div>
  )
}

function rotuloDaMatricula(status: string | null): string {
  switch (status) {
    case 'active':
      return 'Ativa'
    case 'completed':
      return 'Concluída'
    case 'cancelled':
      return 'Cancelada'
    case 'expired':
      return 'Expirada'
    default:
      return 'Pendente'
  }
}

/**
 * De onde veio a matrícula, em português.
 *
 * `enrollments.source` é o que distingue venda de concessão — por isso o
 * rótulo aparece na ficha em vez de ficar só no banco. Quem olha precisa saber
 * se aquele acesso passou pelo caixa.
 */
function rotuloDaOrigem(source: string | null): string {
  switch (source) {
    case 'order':
      return 'Compra aprovada'
    case 'manual':
      return 'Manual (concedida pelo painel)'
    case 'gift':
      return 'Cortesia'
    case 'import':
      return 'Importada'
    case 'demo':
      return 'Demonstração'
    default:
      return 'Não informada'
  }
}

function rotuloDoPedido(status: string | null): string {
  switch (status) {
    case 'paid':
      return 'Pago'
    case 'pending':
      return 'Aguardando pagamento'
    case 'refunded':
      return 'Reembolsado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Em análise'
  }
}

/** PostgREST devolve o relacionamento como objeto ou array conforme o caso. */
function um<T>(valor: unknown): T | null {
  if (!valor) return null
  return (Array.isArray(valor) ? (valor[0] ?? null) : valor) as T | null
}
