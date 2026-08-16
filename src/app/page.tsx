import Link from 'next/link'
import type { Metadata } from 'next'

import { RenderBloco } from '@/components/cms/blocos'
import { ComposicaoVisual, VAGAS } from '@/components/composicao-visual'

import { Rodape, Topo } from '@/components/site-chrome'
import { listPublishedCourses } from '@/lib/content/catalog'
import { getPublicSettings, getPublishedPage } from '@/lib/cms/page'
import { formatWorkload } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings()
  const title = typeof settings['seo.default_title'] === 'string' ? settings['seo.default_title'] : null
  const description =
    typeof settings['seo.default_description'] === 'string' ? settings['seo.default_description'] : null

  return {
    title: title ?? 'Escola de unhas',
    description:
      description ??
      'Não é apenas aprender a fazer unhas. É construir uma profissão com direção.',
  }
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [pagina, params] = await Promise.all([getPublishedPage('home'), searchParams])
  const revisao = params.revisao === '1'

  return (
    <>
      <Topo />
      <main id="conteudo">
        {pagina && pagina.blocks.length > 0 ? (
          pagina.blocks.map((bloco) => <RenderBloco key={bloco.id} bloco={bloco} />)
        ) : (
          <LandingPadrao revisao={revisao} />
        )}
      </main>
      <Rodape />
    </>
  )
}

/**
 * LANDING PADRÃO — antes de a responsável montar a página no CMS.
 *
 * A tese: o diferencial não é ter aula, é ter DIREÇÃO. A página gira em torno
 * de uma promessa verificável — você começa sabendo onde está.
 *
 * O MOSTRUÁRIO é a identidade da marca e agora existe de verdade aqui: trilho
 * e palhetas no DOM, não só na documentação. As palhetas carregam MOMENTOS
 * (situações do quiz), nunca cursos, módulos ou técnicas.
 *
 * O que ela deliberadamente NÃO faz, porque seria invenção:
 *   · não cita nome de curso, módulo, carga horária, preço ou prazo;
 *   · não promete renda, certificado ou bônus;
 *   · não exibe depoimento, número de alunas ou resultado;
 *   · não fala da instrutora.
 */
async function LandingPadrao({ revisao: _revisao }: { revisao: boolean }) {
  const db = await createClient()

  const [{ data: momentos }, cursos, whatsapp, { data: vagasDeImagem }] = await Promise.all([
    db.from('quiz_outcomes').select('key, name, description').order('position'),
    listPublishedCourses({ limit: 6 }),
    getWhatsAppTarget(),
    /*
     * As fotos da landing vêm do CMS, como toda a mídia do projeto. Enquanto a
     * vaga estiver vazia, a arte editorial temporária ocupa o lugar — nenhuma
     * URL de imagem é escrita no JSX desta página.
     */
    db
      .from('image_slots')
      .select('key, media_assets:media_id (path)')
      .in('key', Object.values(VAGAS).map((v) => v.chave)),
  ])

  const imagens: Record<string, string | null> = {}
  for (const vaga of vagasDeImagem ?? []) {
    const midia = vaga.media_assets as { path?: string } | null
    imagens[vaga.key] = midia?.path ?? null
  }

  // Fonte dinâmica primeiro. O fallback repete exatamente a lista aprovada no
  // escopo — não é texto inventado, e não duplica o que já vem do banco.
  const lista =
    momentos && momentos.length > 0
      ? momentos
      : [
          { key: 'comecar_do_zero', name: 'Quero começar, mas não sei por onde', description: null },
          { key: 'praticar_evoluir', name: 'Já pratico e quero evoluir', description: null },
          { key: 'ja_trabalho', name: 'Já trabalho na área', description: null },
          { key: 'organizar_carreira', name: 'Quero organizar minha carreira', description: null },
          { key: 'recomecar', name: 'Quero recomeçar', description: null },
        ]

  return (
    <>
      {/* ================================================================== */}
      {/* HERÓI — tese à esquerda, mostruário à direita                      */}
      {/* ================================================================== */}
      {/*
        A primeira dobra é escura e fotográfica de propósito.

        A versão anterior era "texto | quadrados": abria branca, com o
        mostruário abstrato ocupando metade da tela. Quem chegava via um
        sistema, não um site de manicure. As palhetas continuam existindo em
        "Como funciona", onde têm função de explicar a jornada — aqui elas
        davam ornamento no lugar de assunto.
      */}
      <section className="capa">
        <div className="capa__fundo" aria-hidden="true">
          <span className="capa__luz capa__luz--alta" />
          <span className="capa__luz capa__luz--baixa" />
        </div>

        <div className="page capa__grade">
          <div className="capa__texto">
            <p className="capa__chapeu">Comece sabendo onde você está</p>

            <h1 className="capa__titulo">
              Não é só aprender
              <br />
              a fazer unhas.
              <br />
              <em>É construir uma profissão com direção.</em>
            </h1>

            <p className="capa__apoio">
              Enquanto outras plataformas entregam aulas soltas, aqui você começa com um
              diagnóstico, entende o seu momento e segue uma jornada clara — sabendo sempre
              qual é o próximo passo.
            </p>

            <div className="capa__acoes">
              <Link className="botao botao--cta" href="/diagnostico">
                <span>Fazer meu diagnóstico</span>
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
              <span className="capa__nota">
                Leva poucos minutos.
                <br />
                Sem custo e sem compromisso.
              </span>
            </div>
          </div>

          {/*
            A imagem sangra para fora da coluna e passa por baixo do texto no
            desktop. É o que dá profundidade — em vez de dois retângulos lado
            a lado.
          */}
          <div className="capa__visual">
            <ComposicaoVisual
              vaga={VAGAS.heroPrincipal}
              mediaPath={imagens['landing.hero']}
              prioridade
              className="capa__imagem"
              sizes="(max-width: 62rem) 100vw, 46vw"
            />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* A DIFERENÇA — o argumento central, em faixa de marca               */}
      {/* ================================================================== */}
      <section className="faixa-marca">
        <div className="page contraste">
          <div className="contraste__lado" data-tom="antes">
            <p className="contraste__rotulo">O jeito comum</p>
            <p className="contraste__frase">
              Um monte de aula solta. Você assiste, gosta, e continua sem saber o que fazer
              depois.
            </p>
          </div>

          <div className="contraste__divisor" aria-hidden="true" />

          <div className="contraste__lado" data-tom="depois">
            <p className="contraste__rotulo">Aqui</p>
            <p className="contraste__frase">
              Primeiro a gente entende o seu momento. Depois você segue um caminho, com o
              próximo passo sempre visível.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* COMO FUNCIONA — três palhetas no mesmo trilho                      */}
      {/* ================================================================== */}
      <section className="section" id="como-funciona">
        <div className="page">
          <h2 className="titulo-secao">Como funciona</h2>

          <div className="trilho mostruario percurso">
            <ol className="trilho__itens">
              <li className="palheta mostruario__item mostruario__item--atual">
                <span className="palheta__codigo">Etapa 01</span>
                <span className="palheta__titulo">Conte seu momento</span>
                <span className="palheta__meta">
                  Responda perguntas rápidas sobre sua experiência e seus objetivos.
                </span>
              </li>

              <li className="palheta mostruario__item">
                <span className="palheta__codigo">Etapa 02</span>
                <span className="palheta__titulo">Entenda onde você está</span>
                <span className="palheta__meta">
                  O diagnóstico organiza suas respostas e identifica seu momento atual.
                </span>
              </li>

              <li className="palheta mostruario__item">
                <span className="palheta__codigo">Etapa 03</span>
                <span className="palheta__titulo">Descubra o próximo passo</span>
                <span className="palheta__meta">
                  {whatsapp.available
                    ? 'Você recebe uma orientação e pode continuar a conversa pelo WhatsApp.'
                    : 'Você recebe uma orientação com o que faz sentido considerar a partir dali.'}
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* OS MOMENTOS — composição assimétrica                               */}
      {/* ================================================================== */}
      <section className="section faixa-escura">
        <div className="page momentos-composicao">
          <div className="momentos__topo">
            <p className="capa__chapeu">Seja qual for o seu ponto de partida</p>
            <h2 className="momentos__titulo">
              Toda jornada começa em algum lugar. A sua começa <em>aqui</em>.
            </h2>
            <p className="momentos__apoio">
              São cinco momentos possíveis. O diagnóstico diz em qual deles você está hoje —
              e é a partir dele que a conversa começa.
            </p>

            <div className="momentos__acao">
              <Link className="botao botao--secundario" href="/diagnostico">
                Ver em qual deles eu estou
              </Link>
            </div>
          </div>

          <div className="trilho mostruario">
            <ul className="trilho__itens" role="list">
              {lista.map((momento, i) => (
                <li
                  key={momento.key}
                  className={`palheta mostruario__item${
                    i === 1 ? ' mostruario__item--atual' : ''
                  }`}
                >
                  <span className="palheta__codigo">{String(i + 1).padStart(2, '0')}</span>
                  <span className="palheta__titulo">{momento.name}</span>
                  {momento.description ? (
                    <span className="palheta__meta">{momento.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* A BANCADA — onde a foto real vai entrar                            */}
      {/* ================================================================== */}
      {/*
        Faixa fotográfica escura. Entra depois de duas seções claras para
        quebrar o bloco branco — e é aqui que o assunto da profissão aparece
        em imagem, não em texto.
      */}
      <section className="faixa-foto">
        <div className="page faixa-foto__grade">
          <ComposicaoVisual
            vaga={VAGAS.detalheAcabamento}
            mediaPath={imagens['landing.acabamento']}
            className="faixa-foto__imagem"
            sizes="(max-width: 62rem) 100vw, 46vw"
          />

          <div>
            <p className="capa__chapeu">Feito com as mãos</p>
            <h2 className="faixa-foto__titulo">
              O acabamento é o que separa o trabalho bom do trabalho comum.
            </h2>
            <p className="faixa-foto__texto">
              Cutícula limpa, esmalte uniforme, borda definida. É detalhe que a cliente não
              sabe nomear — mas é exatamente o que a faz voltar.
            </p>
          </div>
        </div>
      </section>

      {/*
        Bancada, com a imagem do outro lado. Números editoriais no lugar de
        três cards iguais: mesma informação, muito menos moldura.
      */}
      <section className="faixa-foto faixa-foto--invertida faixa-foto--clara">
        <div className="page faixa-foto__grade">
          <ComposicaoVisual
            vaga={VAGAS.bancada}
            mediaPath={imagens['landing.bancada']}
            className="faixa-foto__imagem"
            sizes="(max-width: 62rem) 100vw, 46vw"
          />

          <div>
            <p className="capa__chapeu">Uma profissão de bancada</p>
            <h2 className="faixa-foto__titulo">
              O aprendizado acontece com as mãos.
            </h2>
            <p className="faixa-foto__texto">
              O que muda aqui é ter uma direção para onde levar essa prática — em vez de
              acumular técnica solta sem saber onde ela entra.
            </p>

            <div className="numeros-editoriais">
              <div className="numero-editorial">
                <span className="numero-editorial__valor">01</span>
                <span className="numero-editorial__rotulo">
                  Diagnóstico primeiro. Você começa sabendo onde está.
                </span>
              </div>
              <div className="numero-editorial">
                <span className="numero-editorial__valor">08</span>
                <span className="numero-editorial__rotulo">
                  Capítulos organizados por etapa do seu desenvolvimento.
                </span>
              </div>
              <div className="numero-editorial">
                <span className="numero-editorial__valor">∞</span>
                <span className="numero-editorial__rotulo">
                  Revisar quantas vezes quiser. A prática pede repetição.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CURSOS — some por inteiro enquanto não houver nenhum publicado     */}
      {/* ================================================================== */}
      {cursos.length > 0 ? (
        <section className="section">
          <div className="page">
            <h2 className="titulo-secao">Cursos disponíveis</h2>
            <div className="grade" style={{ marginBlockStart: 'var(--space-6)' }}>
              {cursos.map((curso) => (
                <Link key={curso.id} className="cartao" href={`/cursos/${curso.slug}`}>
                  <p className="titulo-apoio">
                    {[curso.levelName, formatWorkload(curso.workloadMinutes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--size-h4)',
                      fontWeight: 600,
                      marginBlockStart: 'var(--space-2)',
                    }}
                  >
                    {curso.name}
                  </p>
                  {curso.shortDescription ? (
                    <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
                      {curso.shortDescription}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ================================================================== */}
      {/* FECHAMENTO                                                         */}
      {/* ================================================================== */}
      {/* Fecha em quase-preto com neon: a página termina no tom que abriu. */}
      <section className="fechamento-escuro">
        <div className="page">
          <h2 className="fechamento-escuro__titulo">
            Vamos começar pelo seu momento?
          </h2>
          <p className="fechamento-escuro__texto">
            É rápido, não custa nada, e é o que permite falar com você sobre o que realmente
            interessa.
          </p>

          <div className="fechamento-escuro__acoes">
            <Link className="botao botao--cta" href="/diagnostico">
              <span>Fazer meu diagnóstico</span>
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
          </div>

          <span className="fechamento-escuro__fio" aria-hidden="true" />
        </div>
      </section>
    </>
  )
}
