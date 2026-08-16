import 'server-only'

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const quizSubmissionSchema = z.object({
  quizSlug: z.string().min(1),
  sessionId: z.string().min(1).max(64),
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  lead: z.object({
    name: z.string().trim().min(2, 'Informe seu nome.').max(120),
    email: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone incompleto.')
      .refine((v) => v.replace(/\D/g, '').length <= 13, 'Telefone inválido.'),
    city: z.string().trim().max(80).optional().or(z.literal('')),
    state: z.string().trim().length(2, 'UF inválida.').optional().or(z.literal('')),
  }),
  consent: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar para continuar.' }) }),
  utm: z.record(z.string()).optional(),
})

export type QuizSubmission = z.infer<typeof quizSubmissionSchema>

export type QuizResult = {
  responseId: string | null
  outcome: { key: string; name: string; description: string | null }
  /**
   * O que o sistema efetivamente tem para oferecer AGORA.
   * 'whatsapp' quando nao existe curso publicado nem oferta ativa.
   */
  action: 'course' | 'offer' | 'page' | 'whatsapp'
  url?: string
  message?: string
  whatsappHref?: string
}

/**
 * Registra o diagnostico e resolve o destino consultando o banco.
 * Nunca afirma que existe curso ou trilha: quem decide e resolve_quiz_outcome.
 */
export async function submitQuiz(input: QuizSubmission): Promise<QuizResult> {
  const db = createAdminClient()

  const { data: quiz } = await db
    .from('quizzes')
    .select('id, slug, fallback_message, consent_text, status')
    .eq('slug', input.quizSlug)
    .eq('status', 'published')
    .single()

  if (!quiz) {
    throw new Error('Diagnostico indisponivel.')
  }

  // 1. Consentimento primeiro (LGPD): guarda o texto exato aceito.
  const { data: consent } = await db
    .from('consents')
    .insert({
      subject_email: input.lead.email || null,
      subject_phone: input.lead.phone,
      purpose: 'marketing',
      policy_version: 'quiz-v1',
      text_snapshot: quiz.consent_text ?? 'Aceite registrado no diagnostico.',
      granted: true,
      channel: 'quiz',
    })
    .select('id')
    .single()

  // 2. Lead
  const { data: lead } = await db
    .from('leads')
    .insert({
      name: input.lead.name,
      email: input.lead.email || null,
      phone: input.lead.phone,
      whatsapp: input.lead.phone,
      city: input.lead.city || null,
      state: input.lead.state ? input.lead.state.toUpperCase() : null,
      source: 'quiz',
      stage: 'diagnosed',
      utm: input.utm ?? {},
      consent_id: consent?.id ?? null,
    })
    .select('id')
    .single()

  // 3. Pontuacao a partir dos pesos cadastrados nas alternativas.
  //    O limite de multipla escolha e reaplicado AQUI: o bloqueio do
  //    navegador e conforto, nao seguranca.
  const answers = await limitarSelecoes(db, quiz.id, input.answers)
  const selecionadas = Object.values(answers).flat().filter(Boolean)

  // A segmentação vive no banco (`quiz_segment`), com a regra da
  // pergunta-âncora. Nada é recalculado aqui — uma regra, uma implementação.
  const [{ data: winningKey }, { data: scores }] = await Promise.all([
    db.rpc('quiz_segment', { p_quiz_id: quiz.id, p_values: selecionadas }),
    db.rpc('quiz_scores', { p_quiz_id: quiz.id, p_values: selecionadas }),
  ])

  const { data: outcome } = await db
    .from('quiz_outcomes')
    .select('id, key, name, description, whatsapp_message')
    .eq('quiz_id', quiz.id)
    .eq('key', (winningKey as string) ?? '')
    .maybeSingle()

  // 4. Resolucao do destino: curso publicado > oferta ativa > pagina > WhatsApp
  const { data: resolved } = await db.rpc('resolve_quiz_outcome', {
    p_outcome_id: outcome?.id ?? null,
  })

  const action = (resolved as { action?: string })?.action ?? 'whatsapp'
  const url = (resolved as { url?: string })?.url
  const message =
    (resolved as { message?: string })?.message ?? quiz.fallback_message

  const { data: response } = await db
    .from('quiz_responses')
    .insert({
      quiz_id: quiz.id,
      lead_id: lead?.id ?? null,
      session_id: input.sessionId,
      answers,
      scores: scores ?? {},
      outcome_id: outcome?.id ?? null,
      resolved_action: resolved ?? {},
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const whatsapp = action === 'whatsapp' ? await getWhatsAppTarget(message) : null

  return {
    responseId: response?.id ?? null,
    outcome: {
      key: outcome?.key ?? 'pesquisando',
      name: outcome?.name ?? 'Ainda estou pesquisando',
      description: outcome?.description ?? null,
    },
    action: action as QuizResult['action'],
    url,
    message,
    whatsappHref: whatsapp?.available ? whatsapp.href : undefined,
  }
}

/**
 * Reaplica no servidor o limite de seleções de cada pergunta.
 *
 * O navegador já impede passar do limite, mas isso é conveniência de
 * interface. Quem manda é `quiz_questions.max_selections`, e o excedente é
 * simplesmente descartado — sem erro para a pessoa, porque não há ataque a
 * repelir aqui, apenas dado a normalizar.
 */
async function limitarSelecoes(
  db: ReturnType<typeof createAdminClient>,
  quizId: string,
  answers: Record<string, string | string[]>,
): Promise<Record<string, string | string[]>> {
  const { data: perguntas } = await db
    .from('quiz_questions')
    .select('id, type, max_selections')
    .eq('quiz_id', quizId)

  const limites = new Map((perguntas ?? []).map((p) => [p.id, p]))
  const saida: Record<string, string | string[]> = {}

  for (const [perguntaId, valor] of Object.entries(answers)) {
    const pergunta = limites.get(perguntaId)
    if (!pergunta) continue // pergunta de outro quiz ou inexistente: descarta

    if (pergunta.type !== 'multiple') {
      saida[perguntaId] = Array.isArray(valor) ? (valor[0] ?? '') : valor
      continue
    }

    const lista = Array.isArray(valor) ? valor : [valor]
    saida[perguntaId] = pergunta.max_selections ? lista.slice(0, pergunta.max_selections) : lista
  }

  return saida
}

/*
 * A antiga `scoreAnswers()` foi removida na migration 19: a soma de pesos
 * e a regra da pergunta-âncora agora vivem em `public.quiz_scores()` e
 * `public.quiz_segment()`. Manter uma cópia aqui significaria duas
 * implementações da mesma regra, e elas divergiriam na primeira recalibragem
 * feita pelo painel.
 */
