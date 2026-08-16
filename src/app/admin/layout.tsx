import Link from 'next/link'
import type { Metadata } from 'next'

import { MenuLateral, type GrupoDeMenu } from '@/components/menu-lateral'
import { getContentGaps } from '@/lib/cms/page'

export const metadata: Metadata = {
  title: { default: 'Painel', template: "%s | Painel · Katia Franck Nail's Studio" },
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
    /*
     * O MENU FOI CORTADO DE 21 ITENS PARA 9.
     *
     * A regra: fica no menu o que a responsável usa no dia a dia. O resto
     * continua existindo — rota, banco e código intactos — mas deixa de
     * disputar atenção. Um painel com 21 entradas obriga quem entra a
     * aprender o sistema antes de conseguir fazer a tarefa mais simples.
     *
     * SAÍRAM DO MENU (as rotas continuam funcionando):
     *
     *   Cursos, Biblioteca      já vivem dentro de Formação — três nomes
     *                           para a mesma coisa faziam a pessoa parar
     *                           para descobrir a diferença
     *   Instrutoras             o estúdio tem uma responsável só
     *   Comunidade, Mensagens   não vão ser usadas agora; o suporte é o
     *                           WhatsApp flutuante
     *   Fotos e mídia, Páginas,
     *   Perguntas frequentes,
     *   Avisos                  configuração de site, não rotina
     *   Leads, Ofertas, Pedidos reunidos em Vendas
     *   LGPD                    fica linkada em Configurações
     *
     * Nada foi apagado. Ver docs/validacao/menu-admin.md.
     */
    {
      rotulo: 'Painel',
      itens: [
        { href: '/admin', rotulo: 'Início', icone: 'inicio', contador: pendencias || null },
        { href: '/admin/formacao', rotulo: 'Formação', icone: 'cursos' },
        { href: '/admin/quiz', rotulo: 'Quiz', icone: 'atividades' },
        { href: '/admin/alunas', rotulo: 'Alunas', icone: 'pessoas' },
        { href: '/admin/vendas', rotulo: 'Vendas', icone: 'ofertas' },
        { href: '/admin/depoimentos', rotulo: 'Depoimentos', icone: 'comunidade' },
        { href: '/admin/funil', rotulo: 'Relatórios', icone: 'atividades' },
        { href: '/admin/ajustes', rotulo: 'Configurações', icone: 'ajustes' },
      ],
    },
    {
      rotulo: 'Conferir',
      itens: [
        { href: '/admin/formacao/previa', rotulo: 'Ver como aluna', icone: 'perfil' },
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
