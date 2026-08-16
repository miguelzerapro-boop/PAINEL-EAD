import type { Metadata } from 'next'

import { LoginForm } from './login-form'
import { Topo } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

/**
 * Entrada por link mágico (sem senha).
 *
 * Motivo: o público não precisa administrar mais uma senha, e o e-mail já é o
 * canal em que a matrícula chega. Reduz suporte e elimina senha fraca.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams

  return (
    <>
      <Topo />
      <main
        id="conteudo"
        className="page section"
        style={{ display: 'grid', placeItems: 'center', minHeight: '70dvh' }}
      >
        <div style={{ width: '100%', maxWidth: 'var(--width-form)' }}>
          <p className="eyebrow">Área da aluna</p>
          <h1 style={{ marginBlockEnd: 'var(--space-5)' }}>Entrar</h1>
          <LoginForm proximo={proximo ?? '/aluna'} />
        </div>
      </main>
    </>
  )
}
