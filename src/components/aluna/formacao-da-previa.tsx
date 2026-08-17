import Image from 'next/image'
import Link from 'next/link'

import { capitulosDaPrevia, type PreviaAtiva } from '@/lib/admin/previa'
import { MARCA } from '@/lib/marca'

/**
 * MINHA FORMAÇÃO — a lista de capítulos como a aluna vê.
 *
 * Composição editorial, não grade de oito caixas iguais: número grande à
 * esquerda, capa, nome, o que tem dentro, e a ação. É como um sumário de
 * curso, que é o que a tela é.
 *
 * O CAPÍTULO FECHADO NÃO É ERRO. Aparece inteiro, com o nome legível e o
 * plano que o abre, em tom neutro. Um bloco apagado com cadeado faz a aluna
 * achar que a plataforma quebrou; dizer "disponível no plano Completo"
 * transforma o mesmo bloqueio em informação — e em convite.
 *
 * As classes são prefixadas com `form-aluna` de propósito: `.capitulo` já
 * existe no painel e colidir de novo custaria caro.
 */
export async function FormacaoDaPrevia({
  previa,
  nomeDoPlanoCompleto,
  /** No Início mostramos só os primeiros, com um link para a lista inteira. */
  limite,
}: {
  previa: PreviaAtiva
  nomeDoPlanoCompleto?: string
  limite?: number
}) {
  const todos = await capitulosDaPrevia(previa)
  const capitulos = limite ? todos.slice(0, limite) : todos
  const abertos = todos.filter((c) => c.aberto).length

  return (
    <section className="form-aluna">
      {!limite ? (
        <header className="form-aluna__topo">
          <p className="form-aluna__chapeu">Minha formação</p>
          <h1 className="form-aluna__titulo">Formação em manicure e nail design</h1>
          <p className="form-aluna__resumo">
            <strong>
              {abertos} de {todos.length}
            </strong>{' '}
            capítulos liberados no plano <strong>{previa.nome}</strong>.
          </p>

          <div
            className="form-aluna__barra"
            role="img"
            aria-label={`${abertos} de ${todos.length} capítulos liberados`}
          >
            <span style={{ inlineSize: `${(abertos / Math.max(todos.length, 1)) * 100}%` }} />
          </div>
        </header>
      ) : null}

      <ol className="form-aluna__lista" role="list">
        {capitulos.map((c, i) => (
          <li
            key={c.id}
            className="form-aluna__capitulo"
            data-aberto={c.aberto ? 'sim' : 'nao'}
          >
            <span className="form-aluna__ordem mono" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>

            {/*
              A capa do capítulo ainda não existe como campo próprio, então o
              espaço é ocupado pelo selo da marca. Nunca imagem quebrada, e
              nunca um buraco que faz a lista dançar.
            */}
            <span className="form-aluna__capa" aria-hidden="true">
              <Image src={MARCA.logo.src} alt="" width={96} height={96} />
            </span>

            <div className="form-aluna__corpo">
              <p className="form-aluna__nome">{c.nome}</p>

              {c.aberto ? (
                <p className="form-aluna__meta">
                  {c.aulas > 0
                    ? `${c.aulas} ${c.aulas === 1 ? 'aula' : 'aulas'}`
                    : 'Este capítulo ainda está sendo preparado.'}
                </p>
              ) : (
                <p className="form-aluna__meta form-aluna__meta--fechado">
                  <svg
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                    <path d="M5.75 7V5a2.25 2.25 0 0 1 4.5 0v2" />
                  </svg>
                  Disponível no plano {nomeDoPlanoCompleto ?? 'Completo'}
                </p>
              )}
            </div>

            {c.aberto ? (
              c.aulas > 0 ? (
                <Link className="form-aluna__acao" href={`/aluna/capitulo/${c.id}`}>
                  Abrir capítulo
                </Link>
              ) : (
                <span className="form-aluna__acao form-aluna__acao--inerte">Em preparação</span>
              )
            ) : (
              <Link className="form-aluna__acao form-aluna__acao--planos" href="/planos">
                Ver planos
              </Link>
            )}
          </li>
        ))}
      </ol>

      {limite && todos.length > limite ? (
        <p className="form-aluna__mais">
          <Link href="/aluna/cursos">Ver formação completa →</Link>
        </p>
      ) : null}
    </section>
  )
}
