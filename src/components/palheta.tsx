import Link from 'next/link'

/**
 * PALHETA - elemento de assinatura do projeto.
 *
 * Representa uma amostra do mostruario: curso, modulo, aula, etapa do quiz.
 * O entalhe no topo e por onde o trilho passa; por isso ela nunca deve ser
 * usada solta, sempre dentro de <Trilho>.
 *
 * Estados:
 *  available - papel, disponivel
 *  current   - contorno na cor de acao
 *  done      - preenchida
 *  locked    - papel vazado, com o MOTIVO real da trava em texto
 */

export type PalhetaState = 'available' | 'current' | 'done' | 'locked'

type PalhetaProps = {
  codigo?: string
  titulo: string
  meta?: string | null
  motivo?: string | null
  state?: PalhetaState
  href?: string
  destaque?: boolean
  acao?: boolean
  children?: React.ReactNode
}

export function Palheta({
  codigo,
  titulo,
  meta,
  motivo,
  state = 'available',
  href,
  destaque = false,
  acao = false,
  children,
}: PalhetaProps) {
  const className = [
    'palheta',
    destaque ? 'palheta--destaque' : '',
    acao ? 'palheta--acao' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const conteudo = (
    <>
      {codigo ? <span className="palheta__codigo">{codigo}</span> : null}
      <span className="palheta__titulo">{titulo}</span>
      {meta ? <span className="palheta__meta">{meta}</span> : null}
      {state === 'locked' && motivo ? <span className="palheta__motivo">{motivo}</span> : null}
      {children}
    </>
  )

  if (href && state !== 'locked') {
    return (
      <Link className={className} data-state={state} href={href}>
        {conteudo}
      </Link>
    )
  }

  return (
    <div className={className} data-state={state} aria-disabled={state === 'locked' || undefined}>
      {conteudo}
    </div>
  )
}

/**
 * TRILHO - a linha continua que carrega as palhetas.
 * Horizontal na landing e no catalogo; vertical na pagina do curso.
 */
export function Trilho({
  children,
  vertical = false,
  rotulo,
}: {
  children: React.ReactNode
  vertical?: boolean
  rotulo?: string
}) {
  return (
    <div className={vertical ? 'trilho trilho--vertical' : 'trilho'}>
      {rotulo ? <p className="visually-hidden">{rotulo}</p> : null}
      <div className="trilho__itens">{children}</div>
    </div>
  )
}

/** Item de trilho vertical: linha de aula, não cartão. */
export function TrilhoItem({
  titulo,
  meta,
  motivo,
  state = 'available',
  href,
}: {
  titulo: string
  meta?: string | null
  motivo?: string | null
  state?: PalhetaState
  href?: string
}) {
  // Título e motivo empilhados. Em linha, o motivo em itálico se intercalava
  // com o título quando ele quebrava — "Aula *abre em 7 dias* bloqueada".
  const conteudo = (
    <>
      <span className="trilho-item__texto">
        <span className="trilho-item__titulo">{titulo}</span>
        {state === 'locked' && motivo ? (
          <span className="palheta__motivo">{motivo}</span>
        ) : null}
      </span>
      {meta ? <span className="mono">{meta}</span> : null}
    </>
  )

  if (href && state !== 'locked') {
    return (
      <Link className="trilho-item" data-state={state} href={href}>
        {conteudo}
      </Link>
    )
  }

  return (
    <div className="trilho-item" data-state={state} aria-disabled={state === 'locked' || undefined}>
      {conteudo}
    </div>
  )
}
