import { EsqueletoTrilho } from '@/components/estados'

/**
 * Esqueleto da área da aluna.
 *
 * Fica AQUI, e não na raiz, de propósito. Um `loading.tsx` na raiz envolve
 * toda página num Suspense: o cabeçalho HTTP sai antes de a página resolver,
 * e um `notFound()` posterior não consegue mais mudar o status — a página de
 * 404 aparecia com status 200 (soft 404) em rotas públicas indexáveis como
 * `/cursos/[slug]`. Verificado em build de produção.
 *
 * Nas rotas autenticadas isso não acontece: elas não são indexadas e o ganho
 * de mostrar a estrutura enquanto carrega é real.
 */
export default function Carregando() {
  return (
    <main className="page section">
      <div className="esqueleto" style={{ width: '10rem', height: '1rem' }} />
      <div
        className="esqueleto"
        style={{ width: 'min(24ch, 100%)', height: '3rem', marginBlockStart: 'var(--space-4)' }}
      />
      <div style={{ marginBlockStart: 'var(--space-7)' }}>
        <EsqueletoTrilho itens={4} />
      </div>
    </main>
  )
}
