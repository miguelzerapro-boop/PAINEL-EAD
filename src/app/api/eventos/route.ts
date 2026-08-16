import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { EVENTO, limparProps, type NomeDeEvento } from '@/lib/analytics/eventos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * REGISTRO DE EVENTO DO FUNIL
 *
 * Primeira parte: o evento vai para a nossa própria tabela. Nenhum terceiro,
 * nenhum pixel, nada sai do domínio.
 *
 * A rota é pública porque o funil começa antes de existir conta — quem abre a
 * landing ainda não é ninguém. A policy `analytics_insert_anon` (migration
 * 11) já autoriza esse insert e é o único ponto de escrita pública do
 * projeto.
 *
 * O QUE ESTA ROTA RECUSA:
 *   · nome de evento fora da lista fechada;
 *   · qualquer campo que pareça dado pessoal ou segredo;
 *   · string longa demais para ser rótulo.
 *
 * E o mais importante: uma falha aqui NUNCA derruba a navegação. Analytics
 * quebrada não pode impedir alguém de comprar — por isso todo erro vira 204 e
 * segue.
 */

const NOMES = Object.values(EVENTO) as string[]

const corpoSchema = z.object({
  nome: z.string().refine((n) => NOMES.includes(n), 'Evento desconhecido.'),
  sessionId: z.string().max(64).optional(),
  path: z.string().max(300).optional(),
  referrer: z.string().max(300).optional(),
  device: z.enum(['desktop', 'tablet', 'mobile']).optional(),
  utm: z.record(z.string().max(120)).optional(),
  props: z.record(z.unknown()).optional(),
  leadId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  let dados: z.infer<typeof corpoSchema>

  try {
    dados = corpoSchema.parse(await request.json())
  } catch {
    // Corpo inválido não é motivo para o cliente ver erro: ele está navegando,
    // não depurando. Registra nada e segue.
    return new NextResponse(null, { status: 204 })
  }

  try {
    // Quem está logado, se estiver. Nunca vem do corpo — só da sessão.
    let userId: string | null = null
    try {
      const db = await createClient()
      const {
        data: { user },
      } = await db.auth.getUser()
      userId = user?.id ?? null
    } catch {
      /* visitante anônimo: segue sem user_id */
    }

    await createAdminClient()
      .from('analytics_events')
      .insert({
        name: dados.nome as NomeDeEvento,
        session_id: dados.sessionId ?? null,
        lead_id: dados.leadId ?? null,
        user_id: userId,
        path: dados.path ?? null,
        referrer: dados.referrer ?? null,
        utm: dados.utm ?? {},
        props: limparProps(dados.props ?? {}),
        device: dados.device ?? null,
      })
  } catch (e) {
    console.error('[analytics] falha ao registrar', e instanceof Error ? e.message : e)
  }

  // Sempre 204: o cliente não precisa saber, e não deve esperar.
  return new NextResponse(null, { status: 204 })
}
