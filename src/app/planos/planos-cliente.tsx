'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { registrar } from '@/components/analytics/rastro'
import { EVENTO } from '@/lib/analytics/eventos'
import type { CapituloDoPlano, Plano, VitrineDePlanos } from '@/lib/comercial/planos'

/**
 * OS CARTÕES DE PLANO E A COMPARAÇÃO
 *
 * São cliente por um motivo só: medir. `plan_view` precisa de
 * IntersectionObserver (saber que o plano entrou na tela de verdade, não que
 * existe no HTML) e `plan_select` precisa do clique.
 *
 * Nenhum preço, nome ou capítulo é escrito aqui — tudo chega por props,
 * vindo do banco.
 */

function Marca({ incluido }: { incluido: boolean }) {
  return incluido ? (
    <svg
      className="marcador marcador--sim"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 8.5 3.5 3.5L13 4.5" />
    </svg>
  ) : (
    <svg
      className="marcador marcador--nao"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8h8" />
    </svg>
  )
}

export function CartaoDePlano({
  plano,
  etiqueta,
  destaque,
  capitulos,
  href,
  totalDeCapitulos,
}: {
  plano: Plano
  etiqueta: string | null
  destaque: boolean
  capitulos: CapituloDoPlano[]
  href: string
  totalDeCapitulos: number
}) {
  const artigo = useRef<HTMLElement | null>(null)

  /*
   * `plan_view` só sai quando metade do cartão aparece na tela. Disparar na
   * montagem contaria como "visto" um plano que ficou abaixo da dobra — e a
   * taxa de escolha por plano ficaria mentirosa.
   */
  useEffect(() => {
    const alvo = artigo.current
    if (!alvo || typeof IntersectionObserver === 'undefined') return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          registrar(EVENTO.PLAN_VIEW, {
            offerId: plano.id,
            offerSlug: plano.slug,
            valorCents: plano.precoCents,
            capitulos: plano.capitulos,
          })
          observador.disconnect()
        }
      },
      { threshold: 0.5 },
    )

    observador.observe(alvo)
    return () => observador.disconnect()
  }, [plano.id, plano.slug, plano.precoCents, plano.capitulos])

  const incluidos = capitulos.filter((c) => c.incluido)
  const fora = capitulos.filter((c) => !c.incluido)

  return (
    <article
      ref={artigo}
      className={`plano${destaque ? ' plano--destaque' : ''}`}
      aria-labelledby={`plano-${plano.slug}`}
    >
      {etiqueta ? <p className="plano__etiqueta">{etiqueta}</p> : null}

      <h3 className="plano__nome" id={`plano-${plano.slug}`}>
        {plano.nome}
      </h3>

      {plano.chamada ? <p className="plano__chamada">{plano.chamada}</p> : null}

      <p className="plano__preco">
        <span className="plano__valor">{plano.precoFormatado}</span>
        <span className="plano__pagamento">pagamento único</span>
      </p>

      <p className="plano__contagem">
        <strong>
          {plano.capitulos} de {totalDeCapitulos}
        </strong>{' '}
        capítulos da formação
      </p>

      <ul className="plano__capitulos" role="list">
        {incluidos.map((c) => (
          <li key={c.id} className="plano__capitulo">
            <Marca incluido />
            <span>{c.nome}</span>
          </li>
        ))}
        {fora.map((c) => (
          <li key={c.id} className="plano__capitulo plano__capitulo--fora">
            <Marca incluido={false} />
            <span>{c.nome}</span>
          </li>
        ))}
      </ul>

      <Link
        className={`botao ${destaque ? 'botao--cta' : 'botao--secundario'} plano__cta`}
        href={href}
        onClick={() =>
          registrar(EVENTO.PLAN_SELECT, {
            offerId: plano.id,
            offerSlug: plano.slug,
            valorCents: plano.precoCents,
            capitulos: plano.capitulos,
          })
        }
      >
        {plano.cta}
      </Link>
    </article>
  )
}

/**
 * Tabela de comparação.
 *
 * No celular ela rola na horizontal em vez de encolher a fonte — os cartões
 * acima já entregam preço, capítulos e CTA de cada plano sem rolagem, então
 * aqui a tabela pode continuar sendo tabela.
 */
export function ComparacaoDePlanos({
  planos,
  capitulos,
}: {
  planos: Plano[]
  capitulos: VitrineDePlanos['capitulos']
}) {
  return (
    <div className="comparacao" role="region" aria-label="Comparação entre os planos" tabIndex={0}>
      <table className="comparacao__tabela">
        <caption className="visually-hidden">
          Capítulos da formação incluídos em cada plano
        </caption>
        <thead>
          <tr>
            <th scope="col">Capítulo</th>
            {planos.map((p) => (
              <th scope="col" key={p.id}>
                <span className="comparacao__plano">{p.nome}</span>
                <span className="comparacao__preco">{p.precoFormatado}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {capitulos.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.nome}</th>
              {planos.map((p) => {
                const incluido = p.modulos.includes(c.id)
                return (
                  <td key={p.id} data-incluido={incluido ? 'sim' : 'nao'}>
                    <Marca incluido={incluido} />
                    <span className="visually-hidden">
                      {incluido ? 'incluído' : 'não incluído'} no {p.nome}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total de capítulos</th>
            {planos.map((p) => (
              <td key={p.id} className="comparacao__total">
                {p.capitulos}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
