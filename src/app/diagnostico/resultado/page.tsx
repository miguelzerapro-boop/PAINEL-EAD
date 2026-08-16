import Link from 'next/link'
import type { Metadata } from 'next'

import { Palheta, Trilho } from '@/components/palheta'
import { Rodape, Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { VisualizacaoDeEtapa } from '@/components/analytics/rastro'
import { EVENTO } from '@/lib/analytics/eventos'
import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/token'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Seu diagnóstico',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Resultado do diagnóstico.
 *
 * A tela NUNCA afirma que existe curso ou trilha. O destino foi resolvido no
 * banco por resolve_quiz_outcome(): curso publicado > oferta ativa > página
 * configurada > WhatsApp. Sem nenhum desses, mostra a mensagem oficial de
 * encaminhamento.
 */
export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const { d } = await searchParams
  const payload = d ? verifyToken<{ r: string }>(d) : null

  // `!d` entra na guarda junto com o token inválido: sem ele não há o que
  // repassar adiante para a landing de planos.
  if (!d || !payload?.r) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Não encontramos este diagnóstico"
            texto="O link pode ter expirado. Você pode refazer o diagnóstico — leva menos de dois minutos."
            acao={{ label: 'Refazer o diagnóstico', href: '/diagnostico' }}
          />
        </main>
        <Rodape />
      </>
    )
  }

  const db = createAdminClient()
  const { data: resposta } = await db
    .from('quiz_responses')
    .select('id, resolved_action, quiz_outcomes (key, name, description), leads (name)')
    .eq('id', payload.r)
    .maybeSingle()

  if (!resposta) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Não encontramos este diagnóstico"
            texto="Você pode refazer o diagnóstico — leva menos de dois minutos."
            acao={{ label: 'Refazer o diagnóstico', href: '/diagnostico' }}
          />
        </main>
        <Rodape />
      </>
    )
  }

  const outcome = um<{ key: string; name: string; description: string | null }>(resposta.quiz_outcomes)
  const acao = (resposta.resolved_action ?? {}) as { action?: string; url?: string; message?: string }
  const lead = um<{ name: string | null }>(resposta.leads)

  /*
   * Existe plano publicado com preço?
   *
   * É essa pergunta — e não o `resolved_action` gravado na resposta — que
   * decide o destino do resultado. A ação foi resolvida no momento em que a
   * pessoa respondeu o quiz; se um plano foi publicado depois, o link salvo
   * continuaria mandando ela para o WhatsApp.
   */
  const { count: planosPublicados } = await db
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .not('price_cents', 'is', null)

  const temPlanos = (planosPublicados ?? 0) > 0

  const whatsapp = await getWhatsAppTarget(acao.message)

  return (
    <>
      <VisualizacaoDeEtapa
        evento={EVENTO.QUIZ_RESULT_VIEW}
        props={{ quizOutcome: outcome?.key ?? null }}
      />
      <Topo />
      <main id="conteudo">
        <section className="page" style={{ paddingBlockStart: 'var(--space-6)' }}>
          <Trilho rotulo="Diagnóstico concluído">
            <Palheta state="done" codigo="N.01" titulo="Respondido" />
            <Palheta state="done" codigo="N.02" titulo="Analisado" />
            <Palheta state="current" codigo="N.03" titulo="Seu momento" destaque />
          </Trilho>
        </section>

        {/* ================================================================ */}
        {/* O RESULTADO                                                      */}
        {/* ================================================================ */}
        {/*
          A versão anterior era um rótulo, um título e um botão soltos num
          branco enorme. O momento mais importante do funil — a pessoa acabou
          de responder sete perguntas e está esperando uma resposta — não
          dizia nada de volta.

          O QUE ESTA TELA PODE E NÃO PODE DIZER:

          Pode reconhecer o que ela respondeu e nomear o momento dela. Isso
          saiu do quiz, é medição, não invenção.

          NÃO pode afirmar que ela vai ganhar dinheiro, que vai virar
          profissional em X semanas, nem inventar um problema que o quiz não
          mediu. "Percebi algo preocupante" seria exatamente isso: alarme
          fabricado para vender. O que a tela faz é honesto e continua
          empático — reconhece o ponto de partida e diz que existe caminho.
        */}
        <section className="resultado">
          <div className="page resultado__grade">
            <div className="resultado__coluna">
              <p className="capa__chapeu">
                {lead?.name ? `${lead.name.split(' ')[0]}, seu diagnóstico está pronto` : 'Seu diagnóstico está pronto'}
              </p>

              <p className="resultado__rotulo">Seu momento é</p>
              <h1 className="resultado__titulo">{outcome?.name ?? 'Ainda estou pesquisando'}</h1>

              {outcome?.description ? (
                <p className="resultado__descricao">{outcome.description}</p>
              ) : null}

              <div className="resultado__leitura">
                <p>
                  Estar aqui não é atraso. É o ponto de partida — e ele existe para todo mundo
                  que começa.
                </p>
                <p>
                  <strong>O que muda daqui pra frente é ter uma ordem.</strong> Em vez de
                  juntar aula solta, você segue capítulos organizados por etapa, sabendo
                  sempre qual é o próximo.
                </p>
              </div>
            </div>

            <aside className="resultado__cartao">
              <p className="resultado__cartao-rotulo">Próximo passo</p>
              <p className="resultado__cartao-titulo">Escolha até onde quer ir agora</p>
              <p className="resultado__cartao-texto">
                São três planos com a mesma formação. O que muda é quantos capítulos você
                libera — e dá para começar pelos fundamentos e avançar depois.
              </p>

              <ol className="resultado__passos" role="list">
                <li>Compare os três planos</li>
                <li>Escolha o seu</li>
                <li>Comece a estudar</li>
              </ol>
            </aside>
          </div>
        </section>

        <section className="section">
          <div className="page editorial">
            <div>
              <div style={{ maxWidth: 'var(--measure-sales)' }}>
                {temPlanos ? (
                  /*
                   * Existe plano publicado com preço: o passo seguinte é ver
                   * os planos, não abrir o WhatsApp. O token vai junto para a
                   * landing saber de qual diagnóstico ela veio.
                   *
                   * O WhatsApp continua ali, mas como saída secundária — quem
                   * quer conversar antes de comprar não fica sem caminho.
                   */
                  <>
                    {/*
                      O CTA leva para a LANDING COMERCIAL, não direto para o
                      checkout: a pessoa precisa comparar antes de escolher.
                      O token viaja junto para a landing reconhecer de qual
                      diagnóstico ela veio.
                    */}
                    <Link
                      className="botao botao--cta botao--grande"
                      href={`/planos?d=${encodeURIComponent(d)}`}
                    >
                      <span>Ver planos e preços</span>
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
                        <path d="M4 10h11" />
                        <path d="m10 5 5 5-5 5" />
                      </svg>
                    </Link>

                    <p className="resultado__garantia">
                      Pagamento único. Sem mensalidade.
                    </p>

                    {/*
                      WhatsApp fora do caminho principal, por decisão de
                      escopo: ele não entra entre quiz, planos e checkout. Fica
                      como ajuda, discreto.
                    */}
                    {whatsapp.available ? (
                      <p style={{ marginBlockStart: 'var(--space-5)' }}>
                        <a
                          className="resultado__secundario"
                          href={whatsapp.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Precisa de ajuda? Fale com a gente
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : acao.action === 'course' || acao.action === 'offer' || acao.action === 'page' ? (
                  <Link className="botao botao--primario" href={acao.url ?? '/cursos'}>
                    Ver o que está disponível
                  </Link>
                ) : (
                  <>
                    {/* Sem curso publicado nem oferta ativa: mensagem oficial. */}
                    <p style={{ fontSize: 'var(--size-body-lg)' }}>
                      {acao.message ??
                        'Seu diagnóstico foi concluído. Nossa equipe vai conversar com você pelo WhatsApp para entender melhor seu momento e apresentar as opções disponíveis.'}
                    </p>
                    {whatsapp?.available ? (
                      <a
                        className="botao botao--primario"
                        href={whatsapp.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginBlockStart: 'var(--space-5)' }}
                      >
                        Falar no WhatsApp
                      </a>
                    ) : (
                      /*
                       * WhatsApp não configurado. Antes a tela simplesmente
                       * terminava aqui: a pessoa lia que a equipe entraria em
                       * contato e não tinha nenhum passo seguinte. Nada de
                       * botão quebrado nem número inventado — só a orientação
                       * neutra e o caminho de volta.
                       */
                      <p className="resultado__sem-canal">
                        Guarde este link: ele abre o seu resultado de novo quando você precisar.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  )
}
