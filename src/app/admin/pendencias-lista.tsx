import Link from 'next/link'

import { ROTULO_PRIORIDADE, type Pendencia } from '@/lib/admin/pendencias'

/**
 * O QUE AINDA FALTA.
 *
 * Desceu para o fim do Início: continua acessível, deixou de ser a primeira
 * coisa que a responsável vê ao abrir o próprio painel.
 *
 * Cada item traz o que falta, por que importa e o botão que resolve. O botão
 * leva para o campo, não para uma tela genérica onde ela teria que procurar.
 */
export function ListaDePendencias({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return (
      <section id="pendencias" className="pendencias-vazio">
        <p className="pendencias-vazio__titulo">Nada pendente.</p>
        <p className="pendencias-vazio__texto">
          Todas as informações necessárias para o site funcionar já estão preenchidas.
        </p>
      </section>
    )
  }

  const bloqueiam = pendencias.filter((p) => p.prioridade === 'bloqueia')
  const resto = pendencias.filter((p) => p.prioridade !== 'bloqueia')

  return (
    <section id="pendencias" style={{ marginBlockStart: 'var(--space-8)' }}>
      <h2 className="titulo-secao">O que ainda falta</h2>
      <p className="lead" style={{ marginBlock: 'var(--space-3) var(--space-5)', maxWidth: 'var(--measure-study)' }}>
        {bloqueiam.length > 0
          ? `${bloqueiam.length} ${bloqueiam.length === 1 ? 'item impede' : 'itens impedem'} o site de ir ao ar. O resto pode esperar.`
          : 'Nada impede o site de ir ao ar. Os itens abaixo melhoram a apresentação.'}
      </p>

      <div className="pendencias">
        {[...bloqueiam, ...resto].map((p) => (
          <article className="pendencia" key={p.id} data-prioridade={p.prioridade}>
            <div className="pendencia__corpo">
              <p className="pendencia__titulo">{p.titulo}</p>
              <p className="pendencia__descricao">{p.descricao}</p>
              <p className="pendencia__afeta">{p.afeta}</p>
            </div>

            <div className="pendencia__lado">
              <span className="pendencia__selo" data-prioridade={p.prioridade}>
                {ROTULO_PRIORIDADE[p.prioridade].texto}
              </span>
              <Link className="botao botao--secundario pendencia__acao" href={p.href}>
                {p.acao}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
