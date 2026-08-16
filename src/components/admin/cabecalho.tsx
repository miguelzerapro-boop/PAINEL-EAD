import type { ReactNode } from 'react'

/**
 * O CABEÇALHO DE TODA TELA DO PAINEL.
 *
 * Antes cada tela montava o próprio: uma usava `eyebrow + h1`, outra
 * `admin__migalha + admin__titulo`, outra um `<h1>` solto com um selo jogado
 * no canto direito da janela. Batia o olho e cada seção parecia ter sido
 * feita num mês diferente.
 *
 * A estrutura é sempre a mesma, na mesma ordem:
 *
 *   trilha (onde estou)
 *   TÍTULO
 *   uma frase dizendo para que serve a tela
 *   ─────────────────────────────────  ação principal à direita
 *
 * A ação fica ao lado do título, não flutuando no topo da janela: é dali que
 * o olho sai depois de ler o que a tela faz.
 */
export function CabecalhoAdmin({
  trilha,
  titulo,
  descricao,
  selo,
  acao,
}: {
  /** "Formação · Capítulo", por exemplo. Só quando há um caminho de volta. */
  trilha?: ReactNode
  titulo: string
  /** Uma frase curta. É o que responde "para que serve esta tela?". */
  descricao?: string
  /** Estado da coisa que a tela mostra — rascunho, publicado. */
  selo?: ReactNode
  /** Botão principal. Um só: duas ações do mesmo peso não têm principal. */
  acao?: ReactNode
}) {
  return (
    <header className="cabecalho">
      {trilha ? <p className="cabecalho__trilha">{trilha}</p> : null}

      <div className="cabecalho__linha">
        <div className="cabecalho__texto">
          <div className="cabecalho__titulo-linha">
            <h1 className="cabecalho__titulo">{titulo}</h1>
            {selo}
          </div>
          {descricao ? <p className="cabecalho__descricao">{descricao}</p> : null}
        </div>

        {acao ? <div className="cabecalho__acao">{acao}</div> : null}
      </div>
    </header>
  )
}
