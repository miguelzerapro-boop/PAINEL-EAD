import type { Metadata, Viewport } from 'next'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

import { CapturaDeOrigem } from '@/components/analytics/rastro'
import { MARCA } from '@/lib/marca'

import './globals.css'

/**
 * Tipografia escolhida em docs/10-direcao-visual.md.
 * Fraunces  - destaque, serifa com caracter artesanal (eixos SOFT/WONK).
 * Plex Sans - leitura, formulario, interface. Altura-x alta, boa em 360 px.
 * Plex Mono - numeros, codigos, duracoes, valores.
 * Nenhuma das fontes proibidas no escopo.
 */
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  // Fonte variável: sem `weight`, para poder pedir os eixos SOFT e WONK.
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
  variable: '--font-fraunces',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

/**
 * Titulo e descricao vem de settings quando preenchidos.
 * Enquanto nao houver, usamos um texto neutro e verdadeiro - nunca uma
 * promessa de curso inventada.
 */
export const metadata: Metadata = {
  title: {
    default: MARCA.nome,
    template: `%s · ${MARCA.nome}`,
  },
  description: 'Plataforma de formacao profissional em manicure e nail design.',
  robots: { index: false, follow: false }, // liberar quando o conteudo real for publicado
}

export const viewport: Viewport = {
  /* Igual a --purple-950, o fundo do cabeçalho: a barra do navegador continua
     a página em vez de emendar branco no topo escuro. */
  themeColor: '#170524',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        {/* Guarda UTM e origem na PRIMEIRA página da visita — que na campanha
            é o quiz, não a home. Não envia nada. */}
        <CapturaDeOrigem />
        {children}
      </body>
    </html>
  )
}
