'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAdmin, mensagemDeErro } from '@/lib/admin/sessao'
import type { ResultadoAcao } from '../tipos'

/**
 * PERGUNTAS DO DIAGNÓSTICO — pergunta e respostas salvas juntas.
 *
 * Antes era preciso cadastrar a pergunta numa tela e cada alternativa em
 * outra. Aqui tudo vai de uma vez.
 *
 * COMO A LÓGICA DO QUIZ É PRESERVADA
 *
 * O motor não mudou. Ele soma, por resultado, os pesos guardados em
 * `quiz_options.weights` — um objeto `{"chave_do_resultado": peso}` — e o
 * resultado com maior soma vence (`quiz_scores`, migration 19).
 *
 * O que mudou é só a TRADUÇÃO na tela: em vez de pedir um JSON, a interface
 * pergunta "esta resposta indica mais:" com a lista de resultados, e "quanto
 * pesa" em três níveis. O formulário monta o objeto. Nenhuma regra de
 * pontuação foi tocada.
 */

const respostaSchema = z.object({
  /** Vazio quando é resposta nova. */
  id: z.string().uuid().optional().or(z.literal('')),
  label: z.string().trim().min(1, 'Escreva o texto da resposta.').max(300),
  /** Chave do resultado que esta resposta indica. Vazio = não influencia. */
  outcome: z.string().trim().max(80).optional(),
  peso: z.coerce.number().int().min(1).max(3).default(2),
})

const perguntaSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  quizId: z.string().uuid(),
  prompt: z.string().trim().min(3, 'Escreva a pergunta.').max(500),
  helpText: z.string().trim().max(500).optional(),
  posicao: z.coerce.number().int().min(0).default(0),
  respostas: z.array(respostaSchema).min(2, 'Adicione pelo menos duas respostas.'),
})

/** Texto sem acento, minúsculo e com hífen: vira o `value` da alternativa. */
function comoValor(texto: string, indice: number): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  // O índice evita duas alternativas com o mesmo texto virarem o mesmo valor —
  // o que faria a pontuação contar duas vezes a mesma resposta.
  return base ? `${base}-${indice + 1}` : `opcao-${indice + 1}`
}

export async function salvarPergunta(formData: FormData): Promise<ResultadoAcao> {
  try {
    await exigirAdmin()
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Você não tem acesso ao diagnóstico.') }
  }

  let dados: z.infer<typeof perguntaSchema>
  try {
    dados = perguntaSchema.parse({
      id: formData.get('id') ?? '',
      quizId: formData.get('quizId'),
      prompt: formData.get('prompt'),
      helpText: formData.get('helpText') ?? '',
      posicao: formData.get('posicao') ?? 0,
      respostas: JSON.parse(String(formData.get('respostas') ?? '[]')),
    })
  } catch (e) {
    /*
     * A primeira mensagem do zod já é escrita em português no schema. Mostrar
     * o erro cru ("Invalid input: expected string") não ajudaria ninguém.
     */
    const primeira = e instanceof z.ZodError ? e.issues[0]?.message : null
    return { ok: false, message: primeira ?? 'Confira os campos e tente de novo.' }
  }

  const db = createAdminClient()

  /* --- A pergunta ---------------------------------------------------------- */
  let questionId = dados.id || null

  if (questionId) {
    const { error } = await db
      .from('quiz_questions')
      .update({
        prompt: dados.prompt,
        help_text: dados.helpText || null,
        position: dados.posicao,
      })
      .eq('id', questionId)

    if (error) {
      console.error('[quiz] não foi possível atualizar a pergunta:', error.message)
      return { ok: false, message: 'Não foi possível salvar a pergunta.' }
    }
  } else {
    const { data, error } = await db
      .from('quiz_questions')
      .insert({
        quiz_id: dados.quizId,
        prompt: dados.prompt,
        help_text: dados.helpText || null,
        // O diagnóstico atual trabalha com escolha única. Não inventamos
        // suporte a múltipla escolha só para enfeitar o formulário.
        type: 'single',
        is_required: true,
        position: dados.posicao,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[quiz] não foi possível criar a pergunta:', error?.message)
      return { ok: false, message: 'Não foi possível criar a pergunta.' }
    }
    questionId = data.id
  }

  /* --- As respostas -------------------------------------------------------- */
  /*
   * Regravação completa: apaga as que sumiram e reescreve as demais na ordem
   * da tela. É mais simples e mais seguro do que tentar casar cada linha —
   * e como `quiz_responses` guarda o VALOR escolhido, não o id da opção, as
   * respostas já registradas não perdem sentido.
   */
  const idsQueFicam = dados.respostas.map((r) => r.id).filter(Boolean) as string[]

  const paraApagar = db.from('quiz_options').delete().eq('question_id', questionId)
  await (idsQueFicam.length > 0 ? paraApagar.not('id', 'in', `(${idsQueFicam.join(',')})`) : paraApagar)

  for (const [i, resposta] of dados.respostas.entries()) {
    // `weights` no formato que `quiz_scores` já lê. Sem resultado escolhido,
    // a resposta simplesmente não pontua para ninguém.
    const weights = resposta.outcome ? { [resposta.outcome]: resposta.peso } : {}

    const linha = {
      question_id: questionId,
      label: resposta.label,
      value: comoValor(resposta.label, i),
      weights,
      position: i,
    }

    const { error } = resposta.id
      ? await db.from('quiz_options').update(linha).eq('id', resposta.id)
      : await db.from('quiz_options').insert(linha)

    if (error) {
      console.error('[quiz] não foi possível salvar a resposta:', error.message)
      return { ok: false, message: `Não foi possível salvar a resposta "${resposta.label}".` }
    }
  }

  revalidatePath('/admin/quiz')
  return { ok: true, id: questionId ?? undefined }
}

export async function excluirPergunta(questionId: string): Promise<ResultadoAcao> {
  try {
    await exigirAdmin()
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Você não tem acesso ao diagnóstico.') }
  }

  // As alternativas caem junto pela chave estrangeira (`on delete cascade`).
  const { error } = await createAdminClient().from('quiz_questions').delete().eq('id', questionId)

  if (error) {
    console.error('[quiz] não foi possível excluir:', error.message)
    return { ok: false, message: 'Não foi possível excluir esta pergunta.' }
  }

  revalidatePath('/admin/quiz')
  return { ok: true }
}
