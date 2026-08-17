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
    <section className="passo-form">
      <div className="passo-form__marca" aria-hidden="true">
        <span className="passo-form__numero mono">{numero}</span>
        <span className="passo-form__fio" />
      </div>

      <div className="passo-form__corpo">
        <h2 className="passo-form__titulo">{titulo}</h2>
        {descricao ? <p className="passo-form__descricao">{descricao}</p> : null}
        <div className="passo-form__campos">{children}</div>
      </div>
    </section>
  )
}
