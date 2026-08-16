import Link from 'next/link'
import type { Metadata } from 'next'

import { MenuLateral, type GrupoDeMenu } from '@/components/menu-lateral'
import { getContentGaps } from '@/lib/cms/page'

export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s · Painel' },
  robots: { index: false, follow: false },
}

/**
 * Casca do painel — mesmo menu da área da aluna.
 *
 * O badge de pendências fica só em "Pendências". Espalhar contador por todo
 * item transformava o menu num painel de alarme.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gaps = await getContentGaps().catch(() => null)

  const pendencias =
    (gaps?.missingSettings.length ?? 0) +
    (gaps?.incompleteBlocks.length ?? 0) +
    (gaps?.missingPhotos.length ?? 0) +
    (gaps?.demoStillPublished ? 1 : 0)

  const grupos: GrupoDeMenu[] = [
    {
      rotulo: 'Conteúdo',
      itens: [
        { href: '/admin', rotulo: 'Pendências', icone: 'pendencias', contador: pendencias || null },
        { href: '/admin/formacao', rotulo: 'Formação', icone: 'atividades' },
        { href: '/admin/cursos', rotulo: 'Cursos', icone: 'cursos' },
        { href: '/admin/biblioteca', rotulo: 'Biblioteca', icone: 'biblioteca' },
        { href: '/admin/instrutoras', rotulo: 'Instrutoras', icone: 'pessoas' },
        { href: '/admin/midia', rotulo: 'Fotos e mídia', icone: 'midia' },
      ],
    },
    {
      rotulo: 'Site',
      itens: [
        { href: '/admin/paginas', rotulo: 'Páginas', icone: 'paginas' },
        { href: '/admin/faq', rotulo: 'Perguntas frequentes', icone: 'suporte' },
        { href: '/admin/depoimentos', rotulo: 'Depoimentos', icone: 'comunidade' },
      ],
    },
    {
      rotulo: 'Pessoas',
      itens: [
        { href: '/admin/comunidade', rotulo: 'Comunidade', icone: 'comunidade' },
        { href: '/admin/mensagens', rotulo: 'Mensagens', icone: 'mensagens' },
        { href: '/admin/alunas', rotulo: 'Alunas', icone: 'pessoas' },
        { href: '/admin/avisos', rotulo: 'Avisos', icone: 'pendencias' },
      ],
    },
    {
      rotulo: 'Comercial',
      itens: [
        { href: '/admin/quiz', rotulo: 'Diagnóstico', icone: 'atividades' },
        { href: '/admin/leads', rotulo: 'Leads', icone: 'perfil' },
        { href: '/admin/ofertas', rotulo: 'Ofertas', icone: 'ofertas' },
        { href: '/admin/pedidos', rotulo: 'Pedidos', icone: 'ofertas' },
      ],
    },
    {
      rotulo: 'Sistema',
      itens: [
        { href: '/admin/ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
        { href: '/admin/lgpd', rotulo: 'LGPD', icone: 'certificado' },
      ],
    },
  ]

  return (
    <div className="app-shell">
      <MenuLateral titulo="Painel" grupos={grupos} rodape={<Link href="/">Ver o site →</Link>} />
      <main id="conteudo" className="app-shell__conteudo">
        {children}
      </main>
    </div>
  )
}
