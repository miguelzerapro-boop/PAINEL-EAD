import Link from 'next/link'

import { CartaoDePlano, ComparacaoDePlanos } from '@/components/comercial/vitrine'
import { EstadoVazio } from '@/components/estados'
import {
  comparar,
  enfaseDoPlano,
  etiquetaDoPlano,
  getVitrine,
} from '@/lib/comercial/planos'

/**
 * A SEÇÃO DE PLANOS — a mesma na home e na /planos.
 *
 * A home mostrava só o diagnóstico, e o preço só aparecia depois do quiz.
 * Quem chegava querendo saber quanto custa tinha que responder um formulário
 * primeiro para descobrir. Agora os três pacotes estão na própria home.
 *
 * As duas páginas montam ESTE componente, que lê `getVitrine()` uma vez. É o
 * que garante que a home e a /planos nunca discordem sobre preço ou sobre o
 * que cada pacote inclui — divergir aí seria propaganda enganosa por descuido.
 */
export async function SecaoDePlanos({
  /** Token do diagnóstico, quando a visitante veio do quiz. Viaja até o checkout. */
  token,
  /** A comparação linha a linha. A home mostra; um resumo curto pode dispensar. */
  comComparacao = true,
  titulo = 'Escolha até onde você quer evoluir',
  apoio = 'Todos dão acesso à mesma formação. O que muda é quantos capítulos você libera.',
  /** `h2` na home (que já tem h1 no herói), `h2` também na /planos. */
  id = 'planos',
}: {
  token?: string
  comComparacao?: boolean
  titulo?: string
  apoio?: string
  id?: string
}) {
  const vitrine = await getVitrine()

  if (!vitrine || vitrine.planos.length === 0) {
    return (
      <section className="section" id={id}>
        <div className="page">
          <EstadoVazio
            titulo="Os planos ainda não estão disponíveis"
            texto="Assim que as inscrições abrirem, eles aparecem aqui com os valores e o que cada um inclui."
            acao={{ label: 'Fazer o diagnóstico', href: '/diagnostico' }}
          />
        </div>
      </section>
    )
  }

  const { planos, capitulos, totalDeCapitulos } = vitrine

  // O token viaja junto até o checkout: é o que liga a compra ao diagnóstico
  // que a originou, sem pedir os dados de novo.
  const sufixo = token ? `?d=${encodeURIComponent(token)}` : ''

  return (
    <>
      <section className="section secao-planos" id={id}>
        <div className="page">
          <h2 className="titulo-secao">{titulo}</h2>
          <p className="secao-planos__apoio">{apoio}</p>

          <div className="planos-grade">
            {planos.map((plano) => (
              <CartaoDePlano
                key={plano.id}
                plano={plano}
                etiqueta={etiquetaDoPlano(plano, planos)}
                enfase={enfaseDoPlano(plano, planos)}
                capitulos={comparar(plano, capitulos)}
                totalDeCapitulos={totalDeCapitulos}
                href={`/checkout/${plano.slug}${sufixo}`}
              />
            ))}
          </div>
        </div>
      </section>

      {comComparacao ? (
        <section className="section faixa-comparacao">
          <div className="page">
            <h2 className="titulo-secao">O que entra em cada plano</h2>
            <ComparacaoDePlanos planos={planos} capitulos={capitulos} />
          </div>
        </section>
      ) : null}
    </>
  )
}

/**
 * O diagnóstico como APOIO, não como porta de entrada.
 *
 * Ele continua sendo útil para quem não sabe escolher — mas a página não
 * depende mais dele para mostrar preço.
 */
export function AjudaDoDiagnostico() {
  return (
    <section className="section ajuda-diagnostico">
      <div className="page ajuda-diagnostico__caixa">
        <div>
          <p className="capa__chapeu">Em dúvida?</p>
          <h2 className="ajuda-diagnostico__titulo">
            Ainda não sabe qual plano combina com você?
          </h2>
          <p className="ajuda-diagnostico__texto">
            Responda algumas perguntas rápidas sobre o seu momento. No fim, você volta para
            os planos com uma orientação.
          </p>
        </div>

        <Link className="botao botao--secundario" href="/diagnostico">
          Fazer diagnóstico
        </Link>
      </div>
    </section>
  )
}
