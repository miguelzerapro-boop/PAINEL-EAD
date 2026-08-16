import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * QUEM ESTÁ PEDINDO
 *
 * Um único lugar decide se a pessoa pode escrever conteúdo. A identidade vem
 * sempre da SESSÃO — nunca de um id enviado pelo formulário — e o papel vem
 * sempre do banco, nunca de um campo escondido.
 *
 * `comercial` e `financeiro` não aparecem em lugar nenhum aqui de propósito:
 * esses dois papéis não têm acesso a conteúdo de aula (ver o comentário de
 * `is_staff()` na migration 17).
 */

export type Sessao = { userId: string; nome: string; papel: string }

export class SemPermissao extends Error {
  constructor(mensagem = 'Sem permissão.') {
    super(mensagem)
    this.name = 'SemPermissao'
  }
}

export async function sessaoAtual(): Promise<Sessao> {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) throw new SemPermissao('Não autenticado.')

  const { data: perfil } = await db
    .from('profiles')
    .select('role, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) throw new SemPermissao('Sem permissão.')

  return {
    userId: user.id,
    nome: perfil.display_name ?? perfil.full_name ?? user.email ?? 'admin',
    papel: perfil.role,
  }
}

/** Administradora ou dona. Usado por tudo que é configuração do site. */
export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await sessaoAtual()
  if (!['admin', 'owner'].includes(sessao.papel)) throw new SemPermissao()
  return sessao
}

/**
 * Quem pode mexer no conteúdo DESTE curso: admin, dona, ou a instrutora que
 * leciona o curso. A pergunta sobre a instrutora é feita ao banco
 * (`instructor_teaches`), com a sessão da própria pessoa — a mesma função que
 * as policies de Storage usam, para que painel e bucket nunca discordem.
 */
export async function exigirEquipeDoCurso(courseId: string): Promise<Sessao> {
  const sessao = await sessaoAtual()
  if (['admin', 'owner'].includes(sessao.papel)) return sessao

  if (sessao.papel === 'instructor') {
    const db = await createClient()
    const { data: leciona } = await db.rpc('instructor_teaches', { p_course_id: courseId })
    if (leciona === true) return sessao
  }

  throw new SemPermissao('Você não tem permissão sobre este curso.')
}

/** Converte a exceção em mensagem legível, sem vazar detalhe técnico. */
export function mensagemDeErro(e: unknown, padrao: string): string {
  if (e instanceof SemPermissao) return e.message
  console.error('[admin]', e)
  return padrao
}
