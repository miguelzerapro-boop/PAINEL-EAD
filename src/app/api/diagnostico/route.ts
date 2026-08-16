import { NextResponse } from 'next/server'

import { quizSubmissionSchema, submitQuiz } from '@/lib/funnel/quiz'
import { ipDaRequisicao, limitar } from '@/lib/rate-limit'
import { signToken } from '@/lib/token'

export const runtime = 'nodejs'

/**
 * Recebe o diagnóstico.
 *
 * Roda no servidor com service role porque o funil público não tem policy de
 * insert para `anon` — assim validamos, registramos o consentimento e evitamos
 * escrita direta no banco a partir do navegador.
 *
 * Nada aqui confia no cliente: o segmento é calculado pelo banco, o limite de
 * múltipla escolha é reaplicado no servidor e o destino é resolvido contra o
 * catálogo publicado.
 */
export async function POST(request: Request) {
  const limite = limitar(`diagnostico:${ipDaRequisicao(request)}`, {
    limite: 10,
    janelaSegundos: 600,
  })
  if (!limite.permitido) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente de novo em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    )
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ message: 'Requisição inválida.' }, { status: 400 })
  }

  const parsed = quizSubmissionSchema.safeParse(corpo)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 422 },
    )
  }

  try {
    const resultado = await submitQuiz(parsed.data)
    if (!resultado.responseId) {
      return NextResponse.json({ message: 'Não foi possível registrar o diagnóstico.' }, { status: 500 })
    }

    // Token curto assinado: o resultado abre sem expor o id da resposta.
    const token = signToken({ r: resultado.responseId }, 60 * 60 * 24)
    return NextResponse.json({ token })
  } catch (error) {
    // A mensagem do banco fica no log do servidor; a pessoa recebe texto neutro.
    console.error('[diagnostico] falha ao processar', error)
    return NextResponse.json({ message: 'Não foi possível enviar suas respostas.' }, { status: 500 })
  }
}
