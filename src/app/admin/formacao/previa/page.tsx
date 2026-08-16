import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Aviso } from '@/components/estados'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Visualizar como aluna' }
export const dynamic = 'force-dynamic'

/**
 * VISUALIZAR COMO ALUNA — prévia por plano.
 *
 * Para mostrar a formação a um cliente sem que exista nenhuma aluna matriculada
 * ainda. Escolhe-se um plano e a tela mostra o que uma aluna daquele pacote
 * veria: quais capítulos abrem e quais ficam fechados.
 *
 * O QUE ESTA TELA NÃO FAZ, de propósito:
 *
 *   · não cria matrícula;
 *   · não cria pedido nem pagamento;
 *   · não concede direito nenhum a conta nenhuma;
 *   · não troca a sessão de quem está olhando.
 *
 * É LEITURA. A lista de aberto/fechado é calculada de `offer_module_access` —
 * a MESMA tabela que `user_has_module_access()` consulta no banco para decidir
 * o acesso de verdade. Se a prévia e o acesso real divergirem um dia, é
 * porque a tabela mudou, e os dois mudam junto.
 *
 * O middleware já barra quem não é admin em todo /admin. Não há caminho para
 * uma aluna abrir isto.
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

  // Quantas aulas cada capítulo já tem. Zero é o estado real hoje, e a tela
  // diz isso em vez de fingir conteúdo.
  const { data: aulas } = await db.from('lessons').select('id, module_id')
  const aulasPorModulo = new Map<string, number>()
  for (const a of aulas ?? []) {
    aulasPorModulo.set(a.module_id, (aulasPorModulo.get(a.module_id) ?? 0) + 1)
  }

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <>
      <p className="eyebrow">Conteúdo</p>
      <h1>Visualizar como aluna</h1>

      <div style={{ marginBlock: 'var(--space-5)' }}>
        <Aviso titulo="Isto é uma prévia">
          Nenhuma matrícula, pedido ou pagamento é criado aqui, e nenhuma conta ganha acesso.
          A lista abaixo é calculada da mesma tabela que o banco usa para liberar capítulo de
          verdade.
        </Aviso>
      </div>

      {planos.length === 0 ? (
        <div className="vazio-explicado">
          <p className="vazio-explicado__titulo">Nenhum plano publicado.</p>
          <p className="vazio-explicado__texto">
            A prévia aparece assim que existir ao menos uma oferta publicada com preço.
          </p>
        </div>
      ) : (
        <>
          <div className="previa__abas" role="group" aria-label="Escolha o plano">
            {planos.map((p) => (
              <Link
                key={p.id}
                href={`/admin/formacao/previa?plano=${p.slug}`}
                className="previa__aba"
                aria-current={p.id === atual?.id ? 'true' : undefined}
              >
                <span className="previa__aba-nome">{p.name}</span>
                <span className="previa__aba-preco mono">{brl.format((p.price_cents ?? 0) / 100)}</span>
              </Link>
            ))}
          </div>

          <p className="lead" style={{ marginBlock: 'var(--space-5) var(--space-4)' }}>
            Uma aluna do plano <strong>{atual?.name}</strong> vê{' '}
            <strong>
              {capitulos.filter((c) => abertos.has(c.id)).length} de {capitulos.length}
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
                      {aberto ? (
                        quantasAulas > 0 ? (
                          `Aberto · ${quantasAulas} ${quantasAulas === 1 ? 'aula' : 'aulas'}`
                        ) : (
                          /*
                           * Aberto e sem aula é o estado real hoje. Dizer
                           * "Aberto" e mostrar uma lista vazia faria o cliente
                           * achar que quebrou.
                           */
                          'Aberto · nenhuma aula cadastrada ainda'
                        )
                      ) : (
                        `Fechado neste plano`
                      )}
                    </p>
                  </div>

                  <span className="previa__selo">{aberto ? 'Abre' : 'Fecha'}</span>
                </li>
              )
            })}
          </ol>

          <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-6)' }}>
            Para cadastrar aulas, abra{' '}
            <Link href="/admin/formacao">a formação</Link>. Para mudar quais capítulos cada
            plano libera, o ajuste é em <code>offer_module_access</code>.
          </p>
        </>
      )}
    </>
  )
}
