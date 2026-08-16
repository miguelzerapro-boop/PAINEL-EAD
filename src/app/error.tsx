'use client'

import { useEffect } from 'react'

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] erro não tratado', error)
  }, [error])

  return (
    <main className="page section" style={{ maxWidth: 'var(--width-text)' }}>
      <p className="eyebrow">Erro</p>
      <h1>Algo saiu do lugar aqui</h1>
      <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
        A falha é nossa, não sua. Você pode tentar de novo — se continuar acontecendo, fale com a
        gente e informe o código abaixo.
      </p>

      {error.digest ? (
        <p className="mono" style={{ marginBlockStart: 'var(--space-4)' }}>
          código {error.digest}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBlockStart: 'var(--space-6)', flexWrap: 'wrap' }}>
        <button className="botao botao--primario" onClick={reset}>
          Tentar de novo
        </button>
        {/*
          `<a>` em vez de `<Link>` é deliberado, e não descuido.

          Esta é a fronteira de erro: a árvore React já está num estado ruim.
          Uma navegação client-side leva esse mesmo runtime quebrado para a
          próxima tela e a pessoa pode cair no mesmo erro de novo. O `<a>`
          força um carregamento completo do documento — é o único caminho que
          garante começar limpo.
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="botao botao--secundario" href="/">
          Voltar ao início
        </a>
      </div>
    </main>
  )
}
