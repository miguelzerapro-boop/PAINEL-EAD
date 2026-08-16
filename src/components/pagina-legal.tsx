import { Rodape, Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { getPublicSettings } from '@/lib/cms/page'

/**
 * Documento legal.
 *
 * O texto vem de `settings`. Enquanto não for redigido, a página diz
 * honestamente que o documento ainda não foi publicado — em vez de exibir um
 * texto genérico como se fosse o contrato real.
 */
export async function PaginaLegal({ titulo, chave }: { titulo: string; chave: string }) {
  const settings = await getPublicSettings()
  const texto = settings[chave]

  return (
    <>
      <Topo />
      <main id="conteudo" className="page section">
        <h1>{titulo}</h1>

        {typeof texto === 'string' && texto.trim() ? (
          <div className="prose" style={{ marginBlockStart: 'var(--space-5)' }}>
            {texto.split('\n\n').map((paragrafo, i) => (
              <p key={i}>{paragrafo}</p>
            ))}
          </div>
        ) : (
          <div style={{ marginBlockStart: 'var(--space-5)' }}>
            <EstadoVazio
              titulo="Este documento ainda não foi publicado"
              texto="O texto oficial está sendo preparado. Enquanto isso, entre em contato se precisar de qualquer esclarecimento."
              acao={{ label: 'Voltar ao início', href: '/' }}
            />
          </div>
        )}
      </main>
      <Rodape />
    </>
  )
}
