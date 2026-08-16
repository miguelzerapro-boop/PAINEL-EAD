import Link from 'next/link'
import type { Metadata } from 'next'

import { ComposicaoVisual, VAGAS } from '@/components/composicao-visual'
import { EstadoVazio } from '@/components/estados'
import { Rodape, Topo } from '@/components/site-chrome'
import { VisualizacaoDeEtapa } from '@/components/analytics/rastro'
import { EVENTO } from '@/lib/analytics/eventos'
import { comparar, etiquetaDoPlano, getVitrine } from '@/lib/comercial/planos'
import { createClient } from '@/lib/supabase/server'
import { verifyToken } from '@/lib/token'
import { um } from '@/lib/rel'
import { CartaoDePlano, ComparacaoDePlanos } from './planos-cliente'

export const metadata: Metadata = {
  title: 'Planos e preços',
  description: 'Escolha até onde você quer evoluir na formação.',
}

export const dynamic = 'force-dynamic'

/**
 * LANDING COMERCIAL
 *
 * Vem depois do resultado do diagnóstico, nunca antes: a pessoa primeiro
 * entende o momento dela, depois escolhe até onde quer ir.
 *
 * Tudo — nome, preço, capítulos incluídos — sai do banco. Trocar um capítulo
 * de pacote ou ajustar um preço é mexer em `offers` e `offer_module_access`,
 * não aqui.
 *
 * O token do diagnóstico, quando presente, só personaliza a INTRODUÇÃO. Preço
 * e conteúdo são iguais para todo mundo: variar preço por resultado de quiz
 * seria discriminação, não personalização.
 */
export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  // `d` é o mesmo nome de parâmetro usado em /diagnostico/resultado — quem
  // chega de lá traz o token intacto, e o resultado continua identificado.
  const { d: token } = await searchParams
  const vitrine = await getVitrine()

  /* --- Personalização pelo diagnóstico ---------------------------------- */
  let momento: { nome: string; chave: string } | null = null

  if (token) {
    const carga = verifyToken<{ r: string }>(token)
    if (carga?.r) {
      const db = await createClient()
      const { data } = await db
        .from('quiz_responses')
        .select('quiz_outcomes (key, name)')
        .eq('id', carga.r)
        .maybeSingle()

      const outcome = um<{ key: string; name: string }>(data?.quiz_outcomes)
      if (outcome) momento = { nome: outcome.name, chave: outcome.key }
    }
  }

  if (!vitrine || vitrine.planos.length === 0) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Os planos ainda não estão disponíveis"
            texto="Assim que as inscrições abrirem, eles aparecem aqui com os valores e o que cada um inclui."
            acao={{ label: 'Fazer o diagnóstico', href: '/diagnostico' }}
          />
        </main>
        <Rodape />
      </>
    )
  }

  const { planos, capitulos, totalDeCapitulos } = vitrine
  const destaque = planos[planos.length - 1]

  // O token viaja junto até o checkout: é o que liga a compra ao diagnóstico
  // que a originou, sem pedir os dados de novo.
  const sufixo = token ? `?d=${encodeURIComponent(token)}` : ''

  return (
    <>
      <VisualizacaoDeEtapa
        evento={EVENTO.SALES_LANDING_VIEW}
        props={{ quizOutcome: momento?.chave ?? null }}
      />
      <Topo />

      <main id="conteudo">
        {/* ================================================== HERO ======== */}
        <section className="planos-capa">
          <div className="capa__fundo" aria-hidden="true">
            <span className="capa__luz capa__luz--alta" />
            <span className="capa__luz capa__luz--baixa" />
          </div>

          <div className="page planos-capa__grade">
            <div>
              <p className="capa__chapeu">Planos e preços</p>
              <h1 className="capa__titulo">
                Escolha até onde
                <br />
                você quer <em>evoluir.</em>
              </h1>

              {momento ? (
                <p className="capa__apoio">
                  Seu diagnóstico indica <strong>{momento.nome}</strong>. Veja as opções
                  disponíveis para começar e continuar evoluindo — o conteúdo e os valores são
                  os mesmos para todas.
                </p>
              ) : (
                <p className="capa__apoio">
                  Seu diagnóstico mostrou seu momento. Agora escolha o nível de acesso que
                  combina com o que você quer aprender.
                </p>
              )}

              <div className="capa__acoes">
                <a className="botao botao--cta" href="#planos">
                  <span>Ver os planos</span>
                  <svg
                    className="botao__seta"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10 4v11" />
                    <path d="m5 10 5 5 5-5" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="planos-capa__visual">
              <ComposicaoVisual
                vaga={VAGAS.detalheAcabamento}
                mediaPath={null}
                className="planos-capa__imagem"
                sizes="(max-width: 62rem) 100vw, 44vw"
                prioridade
              />
            </div>
          </div>
        </section>

        {/* ================================================ PLANOS ======== */}
        <section className="section" id="planos">
          <div className="page">
            <h2 className="titulo-secao">Três formas de começar</h2>
            <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-7)', maxWidth: 'var(--measure-lead)' }}>
              Todos dão acesso à mesma formação. O que muda é quantos capítulos você libera.
            </p>

            <div className="planos-grade">
              {planos.map((plano) => (
                <CartaoDePlano
                  key={plano.id}
                  plano={plano}
                  etiqueta={etiquetaDoPlano(plano, planos)}
                  destaque={plano.id === destaque?.id}
                  capitulos={comparar(plano, capitulos)}
                  totalDeCapitulos={totalDeCapitulos}
                  href={`/checkout/${plano.slug}${sufixo}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* =========================================== COMPARAÇÃO ========= */}
        <section className="section faixa-comparacao">
          <div className="page">
            <h2 className="titulo-secao">O que entra em cada plano</h2>
            <ComparacaoDePlanos planos={planos} capitulos={capitulos} />
          </div>
        </section>

        {/* ========================================= COMO FUNCIONA ======== */}
        <section className="section">
          <div className="page">
            <h2 className="titulo-secao">Como funciona</h2>
            <ol className="passos">
              <li className="passo">
                <span className="passo__numero mono">01</span>
                <div>
                  <p className="passo__titulo">Escolha seu plano</p>
                  <p className="passo__texto">
                    Compare os capítulos e decida até onde quer ir agora.
                  </p>
                </div>
              </li>
              <li className="passo">
                <span className="passo__numero mono">02</span>
                <div>
                  <p className="passo__titulo">Faça a compra</p>
                  <p className="passo__texto">
                    Pagamento processado pelo Mercado Pago. Não guardamos dados do seu cartão.
                  </p>
                </div>
              </li>
              <li className="passo">
                <span className="passo__numero mono">03</span>
                <div>
                  <p className="passo__titulo">Acesse sua área de estudos</p>
                  <p className="passo__texto">
                    Você entra com o mesmo e-mail da compra e começa pelos capítulos do seu
                    plano.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* =============================================== CTA FINAL ====== */}
        <section className="fechamento-escuro">
          <div className="page">
            <h2 className="fechamento-escuro__titulo">Qual combina com o seu momento?</h2>
            <p className="fechamento-escuro__texto">
              Dá para começar pelos fundamentos e avançar depois — os capítulos que você já
              tiver continuam seus.
            </p>

            <div className="fechamento-escuro__acoes">
              {planos.map((plano) => (
                <Link
                  key={plano.id}
                  className={`botao ${plano.id === destaque?.id ? 'botao--cta' : 'botao--secundario'}`}
                  href={`/checkout/${plano.slug}${sufixo}`}
                >
                  {plano.nome} · {plano.precoFormatado}
                </Link>
              ))}
            </div>

            <span className="fechamento-escuro__fio" aria-hidden="true" />
          </div>
        </section>
      </main>

      <Rodape />
    </>
  )
}
