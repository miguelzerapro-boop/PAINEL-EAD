import Link from 'next/link'
import type { Metadata } from 'next'

import { AjudaDoDiagnostico, SecaoDePlanos } from '@/components/comercial/secao-de-planos'
import { ComposicaoVisual, VAGAS } from '@/components/composicao-visual'
import { Rodape, Topo } from '@/components/site-chrome'
import { VisualizacaoDeEtapa } from '@/components/analytics/rastro'
import { EVENTO } from '@/lib/analytics/eventos'
import { createClient } from '@/lib/supabase/server'
import { verifyToken } from '@/lib/token'
import { um } from '@/lib/rel'

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

  // O estado vazio ("ainda não estão disponíveis") vive dentro de
  // <SecaoDePlanos>, que é quem consulta o banco. Duplicá-lo aqui daria duas
  // versões da mesma mensagem para manter em sincronia.

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

              {/*
                A frase muda conforme o diagnóstico, o PREÇO NÃO. Variar valor
                por resultado de quiz seria discriminação, não personalização —
                e os três planos aparecem para todas, sem esconder nenhum.
              */}
              {momento ? (
                <p className="capa__apoio">
                  Seu diagnóstico está pronto: <strong>{momento.nome}</strong>. Agora escolha
                  como quer continuar sua formação — os três planos abrem a mesma formação,
                  e o que muda é até onde você vai.
                </p>
              ) : (
                <p className="capa__apoio">
                  Três planos, a mesma formação. O que muda é quantos capítulos você libera —
                  e dá para começar pelos fundamentos e avançar depois.
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

        {/* ====================================== PLANOS + COMPARAÇÃO ===== */}
        {/*
          O MESMO componente que a home monta. As duas páginas leem
          `getVitrine()`, então não têm como discordar sobre preço ou sobre o
          que cada pacote inclui.
        */}
        <SecaoDePlanos token={token} titulo="Três formas de começar" />

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

        {/*
          O BLOCO "FAÇA O DIAGNÓSTICO" NÃO ENTRA AQUI QUANDO ELA JÁ FEZ.

          Esta é a landing que recebe quem acabou de responder o quiz.
          Oferecer "faça o diagnóstico" de novo, em destaque, seria mandar a
          pessoa refazer o que ela terminou há trinta segundos. Sem o token,
          alguém chegou pela home ou por link direto — aí o convite faz
          sentido.
        */}
        {momento ? null : <AjudaDoDiagnostico />}

        {/* =============================================== CTA FINAL ====== */}
        {/*
          O fechamento volta para a seção de planos acima em vez de repetir os
          três botões com preço. Repeti-los criaria um segundo lugar onde o
          valor aparece escrito nesta página — e um a mais para divergir.
        */}
        <section className="fechamento-escuro">
          <div className="page">
            <h2 className="fechamento-escuro__titulo">Qual combina com o seu momento?</h2>
            <p className="fechamento-escuro__texto">
              Dá para começar pelos fundamentos e avançar depois — os capítulos que você já
              tiver continuam seus.
            </p>

            <div className="fechamento-escuro__acoes">
              <a className="botao botao--cta" href="#planos">
                Escolher meu plano
              </a>
            </div>

            {/* Refazer o diagnóstico existe, mas discreto: quem chegou aqui
                pelo quiz já respondeu. */}
            <p style={{ marginBlockStart: 'var(--space-5)' }}>
              <Link className="fechamento-escuro__discreto" href="/diagnostico">
                Refazer o diagnóstico
              </Link>
            </p>

            <span className="fechamento-escuro__fio" aria-hidden="true" />
          </div>
        </section>
      </main>

      <Rodape />
    </>
  )
}
