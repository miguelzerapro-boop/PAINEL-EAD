import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { MenuLateral, type GrupoDeMenu } from '@/components/menu-lateral'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: { default: 'Minha área', template: '%s · Minha área' },
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

  const [perfil, matriculas, pendencias, naoLidas] = await Promise.all([
    db.from('profiles').select('full_name, display_name').eq('id', user.id).maybeSingle(),
    db
      .from('enrollments')
      .select('progress_pct')
      .eq('user_id', user.id)
      .in('status', ['active', 'completed']),
    db
      .from('activity_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['changes_requested', 'draft']),
    db.rpc('unread_conversations', { p_user_id: user.id }),
  ])

  const cursos = matriculas.data ?? []
  const progresso =
    cursos.length > 0
      ? cursos.reduce((soma, m) => soma + Number(m.progress_pct ?? 0), 0) / cursos.length
      : null

  const primeiroNome =
    (perfil.data?.display_name ?? perfil.data?.full_name ?? '').split(' ')[0] || 'Minha área'

  const grupos: GrupoDeMenu[] = [
    {
      rotulo: 'Estudar',
      itens: [
        { href: '/aluna', rotulo: 'Início', icone: 'inicio' },
        { href: '/aluna/cursos', rotulo: 'Meus cursos', icone: 'cursos' },
        {
          href: '/aluna/atividades',
          rotulo: 'Atividades',
          icone: 'atividades',
          contador: pendencias.count || null,
        },
        { href: '/aluna/biblioteca', rotulo: 'Biblioteca', icone: 'biblioteca' },
      ],
    },
    {
      rotulo: 'Conversar',
      itens: [
        { href: '/aluna/comunidade', rotulo: 'Comunidade', icone: 'comunidade' },
        {
          href: '/aluna/mensagens',
          rotulo: 'Mensagens',
          icone: 'mensagens',
          contador: (naoLidas.data as number | null) || null,
        },
      ],
    },
    {
      rotulo: 'Conta',
      itens: [
        { href: '/aluna/certificados', rotulo: 'Certificados', icone: 'certificado' },
        { href: '/aluna/perfil', rotulo: 'Meu perfil', icone: 'perfil' },
      ],
    },
  ]

  return (
    <div className="app-shell">
      <MenuLateral titulo={primeiroNome} grupos={grupos} progresso={progresso} />
      <div className="app-shell__conteudo">{children}</div>
    </div>
  )
}
