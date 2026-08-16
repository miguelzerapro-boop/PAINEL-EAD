import type { Metadata } from 'next'

import { RenderBloco } from '@/components/cms/blocos'
import { Rodape, Topo } from '@/components/site-chrome'
import { getDraftPage } from '@/lib/cms/page'
import { verifyToken } from '@/lib/token'

export const metadata: Metadata = {
  title: 'Pré-visualização',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Pré-visualização do rascunho.
 *
 * Só abre com token assinado e de vida curta. Mostra o rascunho como ele
 * ficaria e lista, ao final, os blocos que ainda não podem ir ao ar.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const [{ key }, { t }] = await Promise.all([params, searchParams])
  const payload = t ? verifyToken<{ page: string }>(t) : null

  if (!payload || payload.page !== key) {
    return (
      <main className="page section">
        <h1>Pré-visualização indisponível</h1>
        <p className="lead">Este link expirou. Abra novamente pelo painel.</p>
      </main>
    )
  }

  const pagina = await getDraftPage(key)
  if (!pagina) {
    return (
      <main className="page section">
        <h1>Página não encontrada</h1>
      </main>
    )
  }

  return (
    <>
      <div
        style={{
          background: 'var(--warning-soft)',
          borderBlockEnd: '1px solid var(--warning)',
          padding: 'var(--space-2) var(--space-4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--size-mono)',
        }}
      >
        PRÉ-VISUALIZAÇÃO DE RASCUNHO — não é o que o público vê
      </div>

      <Topo />
      <main id="conteudo">
        {pagina.blocks.map((bloco) => (
          <RenderBloco key={bloco.id} bloco={bloco} />
        ))}
      </main>

      {pagina.pendingBlocks && pagina.pendingBlocks.length > 0 ? (
        <section className="page section">
          <div className="aviso" data-tone="warning">
            <p className="aviso__titulo">
              {pagina.pendingBlocks.length} bloco(s) fora do ar por falta de conteúdo
            </p>
            <ul>
              {pagina.pendingBlocks.map((b) => (
                <li key={b.id}>
                  <strong>{b.type}</strong> — falta: {b.missingFields.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <Rodape />
    </>
  )
}
