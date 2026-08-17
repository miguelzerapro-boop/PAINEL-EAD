import type { ReactNode } from 'react'

/**
 * UMA ETAPA DE UM FORMULÁRIO LONGO.
 *
 * O cadastro de aula tem quatro assuntos diferentes — informações, vídeo,
 * capa e publicação — e antes eram só campos empilhados. Quem abria via um
 * formulário comprido sem começo nem fim, e não sabia quanto ainda faltava.
 *
 * A numeração à esquerda resolve isso sem transformar cada assunto num cartão:
 * o número ancora, o título nomeia, o fio vertical liga as etapas. Card por
 * seção deixaria a tela cheia de molduras concorrendo com o conteúdo.
 */
export function Etapa({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero: number
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  return (
    <section className="etapa">
      <div className="etapa__marca" aria-hidden="true">
        <span className="etapa__numero mono">{numero}</span>
        <span className="etapa__fio" />
      </div>

      <div className="etapa__corpo">
        <h2 className="etapa__titulo">{titulo}</h2>
        {descricao ? <p className="etapa__descricao">{descricao}</p> : null}
        <div className="etapa__campos">{children}</div>
      </div>
    </section>
  )
}
