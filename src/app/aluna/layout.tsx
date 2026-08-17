import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { BotaoWhatsApp } from '@/components/botao-whatsapp'
import { MenuLateral, type GrupoDeMenu } from '@/components/menu-lateral'
import { previaAtiva } from '@/lib/admin/previa'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: { default: 'Minha área', template: "%s | Katia Franck Nail's Studio" },
  robots: { index: false, follow: false },
}

/**
 * Casca da área da aluna.
 *
 * O menu mostra badge só onde há algo esperando por ela — pendência e
 * mensagem não lida. Contagem de "quantos cursos você tem" saiu: é
 * informação que ela já sabe e que só somava ruído.
 */
export default async function AlunaLayout({ children }: { children: React.ReactNode }) {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/entrar?proximo=/aluna')

  /*
   * As contagens de Atividades e Mensagens não vêm mais: os dois itens saíram
   * do menu. Manter as consultas seria pagar duas idas ao banco em toda tela
   * da aluna para alimentar um contador que ninguém vê.
   */
  const [perfil, matriculas] = await Promise.all([
    db.from('profiles').select('full_name, display_name').eq('id', user.id).maybeSingle(),
    db
      .from('enrollments')
      .select('progress_pct')
      .eq('user_id', user.id)
      .in('status', ['active', 'completed']),
  ])

  const cursos = matriculas.data ?? []
  const progresso =
    cursos.length > 0
      ? cursos.reduce((soma, m) => soma + Number(m.progress_pct ?? 0), 0) / cursos.length
      : null

  const primeiroNome =
    (perfil.data?.display_name ?? perfil.data?.full_name ?? '').split(' ')[0] || 'Minha área'

  /*
   * O MENU DA ALUNA TAMBÉM ENCOLHEU: de 8 itens para 3.
   *
   * Comunidade e Mensagens saíram porque não vão ser usadas agora — e menu
   * apontando para tela vazia é pior do que menu sem o item. Atividades,
   * Biblioteca e Certificados saíram porque ainda não há conteúdo que os
   * alimente; voltam quando houver.
   *
   * As rotas continuam de pé. O suporte agora é o botão de WhatsApp, que
   * aparece flutuando em toda a área.
   */
  /*
   * COMUNIDADE VOLTA — mas só aqui.
   *
   * Ela saiu dos dois menus numa rodada anterior. A decisão foi revista para
   * a ALUNA: conviver com outras alunas faz parte da experiência de estudar.
   * No painel ela continua fora — administrar comunidade não é rotina da
   * responsável hoje.
   *
   * Mensagens continua fora dos dois: o suporte é o WhatsApp flutuante.
   */
  const grupos: GrupoDeMenu[] = [
    {
      rotulo: 'Estudar',
      itens: [
        { href: '/aluna', rotulo: 'Início', icone: 'inicio' },
        { href: '/aluna/cursos', rotulo: 'Minha Formação', icone: 'cursos' },
        { href: '/aluna/comunidade', rotulo: 'Comunidade', icone: 'comunidade' },
        { href: '/aluna/perfil', rotulo: 'Meu perfil', icone: 'perfil' },
      ],
    },
  ]

  /*
   * A responsável pode estar CONFERINDO esta área em vez de estudar nela.
   * Nesse caso a barra aparece no topo e devolve o caminho para o painel em um
   * clique — sem logout, sem senha, sem trocar o papel de ninguém.
   */
  const previa = await previaAtiva()

  return (
    <div className="app-shell">
      <MenuLateral titulo={primeiroNome} grupos={grupos} progresso={progresso} />
      <div className="app-shell__conteudo">
        {previa ? (
          <div className="barra-modo" role="status">
            <span className="barra-modo__texto">
              Visualizando como aluna — plano <strong>{previa.nome}</strong>
            </span>
            {/*
              `<a>` e não `<Link>`: o destino é um route handler que apaga o
              cookie da prévia e redireciona. Navegação do lado do cliente não
              aplicaria o `Set-Cookie` — a pessoa "voltaria" ao painel ainda em
              modo de visualização.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="botao barra-modo__voltar" href="/admin/previa/entrar?sair=1">
              Voltar ao painel
            </a>
          </div>
        ) : null}
        {children}
      </div>
      {/* Suporte sem inbox interno: um clique abre a conversa no WhatsApp. */}
      <BotaoWhatsApp origem="aluna" />
    </div>
  )
}
