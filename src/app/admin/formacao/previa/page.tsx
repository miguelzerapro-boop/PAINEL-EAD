import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Aviso } from '@/components/estados'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Ver como aluna' }
export const dynamic = 'force-dynamic'

/**
 * VER COMO ALUNA — a área de estudos vista pela ótica de cada plano.
 *
 * Serve para conferir uma aula recém-cadastrada, uma capa nova ou o que fica
 * bloqueado em cada pacote, e para apresentar o sistema sem que exista
 * nenhuma aluna matriculada.
 *
 * O QUE ESTA TELA NÃO FAZ, de propósito:
 *
 *   · não cria matrícula, pedido nem pagamento;
 *   · não altera o plano de ninguém;
 *   · não grava progresso;
 *   · não libera conteúdo de forma permanente;
 *   · não troca a sessão de quem está olhando.
 *
 * É LEITURA. O aberto/fechado sai de `offer_module_access` — a MESMA tabela
 * que `user_has_module_access()` consulta no banco para decidir o acesso de
 * verdade. Se um dia divergirem, é porque a tabela mudou, e os dois mudam
 * junto. Nada de capítulo escrito à mão aqui.
 *
 * O middleware já barra quem não é admin em todo /admin.
 */
export default async function PreviaPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>
}) {
  const { plano: planoPedido } = await searchParams
  const db = createAdminClient()

  const [{ data: ofertas }, { data: curso }] = await Promise.all([
    db
      .from('offers')
      .select('id, slug, name, price_cents')
      .eq('status', 'published')
      .not('price_cents', 'is', null)
      .order('price_cents'),
    db.from('courses').select('id, name, status').eq('slug', 'formacao').maybeSingle(),
  ])

  if (!curso) notFound()

  const planos = ofertas ?? []
  const atual = planos.find((o) => o.slug === planoPedido) ?? planos[0] ?? null

  const [{ data: modulos }, { data: liberados }] = await Promise.all([
    db.from('modules').select('id, name, position').eq('course_id', curso.id).order('position'),
    atual
      ? db.from('offer_module_access').select('module_id').eq('offer_id', atual.id)
      : Promise.resolve({ data: [] as Array<{ module_id: string }> }),
  ])

  const abertos = new Set((liberados ?? []).map((l) => l.module_id))
  const capitulos = modulos ?? []

  const { data: aulas } = await db.from('lessons').select('id, module_id')
  const aulasPorModulo = new Map<string, number>()
  for (const a of aulas ?? []) {
    aulasPorModulo.set(a.module_id, (aulasPorModulo.get(a.module_id) ?? 0) + 1)
  }

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const quantosAbertos = capitulos.filter((c) => abertos.has(c.id)).length

  return (
    <>
      {/*
        A BARRA DE PREVIEW.

        Fica no topo, fixa, e diz em uma frase o que a pessoa está vendo. O
        botão de voltar é a peça central: sem ele a saída seria o botão do
        navegador ou digitar /admin na barra de endereço — que é exatamente o
        tipo de coisa que faz alguém achar que "ficou preso" no sistema.
      */}
      <div className="barra-previa" role="status">
        <span className="barra-previa__texto">
          Você está vendo a plataforma como uma aluna
          {atual ? (
            <>
              {' '}
              do plano <strong>{atual.name}</strong>
            </>
          ) : null}
          .
        </span>
        <Link className="botao botao--secundario barra-previa__voltar" href="/admin">
          Voltar ao painel
        </Link>
      </div>

      <p className="eyebrow">Conferir</p>
      <h1>Ver como aluna</h1>

      <div style={{ marginBlock: 'var(--space-5)' }}>
        <Aviso titulo="Isto é só uma visualização">
          Nada é criado nem alterado aqui: nenhuma matrícula, nenhum pedido, nenhum pagamento,
          e nenhuma conta ganha acesso. É a mesma informação que o sistema usa para liberar os
          capítulos de verdade.
        </Aviso>
      </div>

      {planos.length === 0 ? (
        <div className="vazio-explicado">
          <p className="vazio-explicado__titulo">Nenhum plano publicado.</p>
          <p className="vazio-explicado__texto">
            A visualização aparece assim que existir ao menos um plano publicado com preço.
          </p>
        </div>
      ) : (
        <>
          <p className="lead" style={{ maxWidth: 'var(--measure-study)' }}>
            Escolha o plano para ver o que uma aluna dele enxerga.
          </p>

          <div className="previa__abas" role="group" aria-label="Escolha o plano">
            {planos.map((p) => (
              <Link
                key={p.id}
                href={`/admin/formacao/previa?plano=${p.slug}`}
                className="previa__aba"
                aria-current={p.id === atual?.id ? 'true' : undefined}
              >
                <span className="previa__aba-nome">{p.name}</span>
                <span className="previa__aba-preco mono">
                  {brl.format((p.price_cents ?? 0) / 100)}
                </span>
              </Link>
            ))}
          </div>

          {/*
            A LISTA ABAIXO É O RESUMO. O botão leva para a INTERFACE REAL.

            Só resumir dentro do painel não responde à pergunta que a
            responsável faz depois de cadastrar uma aula: "ficou bom para a
            aluna?". Para responder isso é preciso sair do painel — menu
            lateral do admin incluído — e ver a área de estudos como ela é.
          */}
          {atual ? (
            <p style={{ marginBlockStart: 'var(--space-5)' }}>
              <a className="botao botao--cta" href={`/admin/previa/entrar?plano=${atual.slug}`}>
                Abrir a área da aluna como {atual.name}
              </a>
            </p>
          ) : null}

          <p className="lead" style={{ marginBlock: 'var(--space-5) var(--space-4)' }}>
            Uma aluna do plano <strong>{atual?.name}</strong> vê{' '}
            <strong>
              {quantosAbertos} de {capitulos.length}
            </strong>{' '}
            capítulos abertos.
          </p>

          <ol className="previa__capitulos" role="list">
            {capitulos.map((c, i) => {
              const aberto = abertos.has(c.id)
              const quantasAulas = aulasPorModulo.get(c.id) ?? 0

              return (
                <li key={c.id} className="previa__capitulo" data-aberto={aberto ? 'sim' : 'nao'}>
                  <span className="previa__ordem mono">{String(i + 1).padStart(2, '0')}</span>

                  <div className="previa__corpo">
                    <p className="previa__nome">{c.name}</p>
                    <p className="previa__estado">
                      {aberto
                        ? quantasAulas > 0
                          ? `Aberto · ${quantasAulas} ${quantasAulas === 1 ? 'aula' : 'aulas'}`
                          : /*
                             * Aberto e sem aula é o estado real hoje. Dizer só
                             * "Aberto" e mostrar lista vazia faria parecer
                             * defeito.
                             */
                            'Aberto · nenhuma aula cadastrada ainda'
                        : 'Fechado neste plano'}
                    </p>
                  </div>

                  <span className="previa__selo">{aberto ? 'Abre' : 'Fecha'}</span>
                </li>
              )
            })}
          </ol>

          <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-6)' }}>
            Para cadastrar aulas, abra <Link href="/admin/formacao">a Formação</Link>.
          </p>
        </>
      )}
    </>
  )
}
