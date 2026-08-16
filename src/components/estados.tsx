import Link from 'next/link'

/**
 * Estados vazios, avisos e progresso.
 *
 * Um estado vazio util diz tres coisas: o que nao existe, por que, e o que a
 * pessoa pode fazer agora. Nunca preenche a tela com conteudo inventado.
 */

export function EstadoVazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string
  texto: string
  acao?: { label: string; href: string }
}) {
  return (
    <div className="vazio">
      <p className="vazio__titulo">{titulo}</p>
      <p className="vazio__texto">{texto}</p>
      {acao ? (
        <Link className="botao botao--secundario" href={acao.href}>
          {acao.label}
        </Link>
      ) : null}
    </div>
  )
}

export function Aviso({
  titulo,
  children,
  tone = 'info',
}: {
  titulo?: string
  children: React.ReactNode
  tone?: 'info' | 'success' | 'warning' | 'error'
}) {
  return (
    <div className="aviso" data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      {titulo ? <p className="aviso__titulo">{titulo}</p> : null}
      <div>{children}</div>
    </div>
  )
}

export function Progresso({ pct, rotulo }: { pct: number; rotulo?: string }) {
  const valor = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="progresso">
      <div
        className="progresso__trilha"
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo ?? 'Progresso no curso'}
      >
        <span className="progresso__feito" style={{ width: `${valor}%` }} />
      </div>
      <span className="progresso__valor">{valor}%</span>
    </div>
  )
}

/** Esqueleto com a forma da palheta, para o carregamento não parecer genérico. */
export function EsqueletoTrilho({ itens = 3 }: { itens?: number }) {
  return (
    <div className="trilho" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Carregando…</span>
      <div className="trilho__itens">
        {Array.from({ length: itens }).map((_, i) => (
          <div key={i} className="esqueleto esqueleto--palheta" style={{ flex: 1 }} />
        ))}
      </div>
    </div>
  )
}
