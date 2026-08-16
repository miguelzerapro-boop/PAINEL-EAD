/**
 * EVENTOS DO FUNIL
 *
 * A tabela `analytics_events` existe desde a migration 09, com índices, RLS e
 * uma view `funnel_daily` — e até agora nada escrevia nela. Este arquivo é a
 * instrumentação que faltava.
 *
 * PRIMEIRA PARTE, sem terceiro: os eventos vão para o próprio banco. Não há
 * pixel, não há script externo, e nada sai do domínio. Isso importa para a
 * LGPD e para a política de retenção já registrada (395 dias).
 *
 * O QUE NUNCA ENTRA: senha, cartão, token, chave, conteúdo de resposta
 * aberta. O que entra é o suficiente para medir o funil e nada além.
 */

export const EVENTO = {
  LANDING_VIEW: 'landing_view',
  DIAGNOSTIC_CTA_CLICK: 'diagnostic_cta_click',
  QUIZ_START: 'quiz_start',
  QUIZ_ANSWER: 'quiz_answer',
  QUIZ_COMPLETE: 'quiz_complete',
  QUIZ_RESULT_VIEW: 'quiz_result_view',
  SALES_LANDING_VIEW: 'sales_landing_view',
  PLAN_VIEW: 'plan_view',
  PLAN_SELECT: 'plan_select',
  CHECKOUT_START: 'checkout_start',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_APPROVED: 'payment_approved',
  ENROLLMENT_CREATED: 'enrollment_created',
  COURSE_STARTED: 'course_started',
} as const

export type NomeDeEvento = (typeof EVENTO)[keyof typeof EVENTO]

/**
 * Ordem do funil, para o painel montar a queda etapa a etapa.
 *
 * A JORNADA PRINCIPAL COMEÇA NO QUIZ, não na home. O link de campanha aponta
 * para /diagnostico: a pessoa responde, vê o resultado e só então chega na
 * landing comercial. A home institucional existe para marca, busca e login, e
 * fica FORA desta lista para não distorcer a conversão de quem veio do
 * anúncio.
 */
export const FUNIL: NomeDeEvento[] = [
  EVENTO.QUIZ_START,
  EVENTO.QUIZ_ANSWER,
  EVENTO.QUIZ_COMPLETE,
  EVENTO.QUIZ_RESULT_VIEW,
  EVENTO.SALES_LANDING_VIEW,
  EVENTO.PLAN_VIEW,
  EVENTO.PLAN_SELECT,
  EVENTO.CHECKOUT_START,
  EVENTO.PAYMENT_PENDING,
  EVENTO.PAYMENT_APPROVED,
  EVENTO.ENROLLMENT_CREATED,
  EVENTO.COURSE_STARTED,
]

export const ROTULO: Record<NomeDeEvento, string> = {
  landing_view: 'Entradas na landing',
  diagnostic_cta_click: 'Clique no diagnóstico',
  quiz_start: 'Quiz iniciado',
  quiz_answer: 'Perguntas respondidas',
  quiz_complete: 'Quiz concluído',
  quiz_result_view: 'Resultado visto',
  sales_landing_view: 'Planos visualizados',
  plan_view: 'Plano em foco',
  plan_select: 'Plano escolhido',
  checkout_start: 'Checkout iniciado',
  payment_pending: 'Pagamento pendente',
  payment_approved: 'Pagamento aprovado',
  enrollment_created: 'Matrícula criada',
  course_started: 'Estudo iniciado',
}

/**
 * Eventos que não podem repetir por re-render ou refresh.
 *
 * `plan_view` fica de fora de propósito: ver o mesmo plano duas vezes é
 * informação legítima. Já `quiz_complete` duas vezes na mesma sessão é ruído
 * que estraga a taxa de conversão.
 */
export const UMA_VEZ_POR_SESSAO: NomeDeEvento[] = [
  EVENTO.LANDING_VIEW,
  EVENTO.QUIZ_START,
  EVENTO.QUIZ_COMPLETE,
  EVENTO.QUIZ_RESULT_VIEW,
  EVENTO.SALES_LANDING_VIEW,
  EVENTO.CHECKOUT_START,
]

export type PropsDoEvento = {
  offerId?: string | null
  offerSlug?: string | null
  productId?: string | null
  valorCents?: number | null
  moeda?: string | null
  quizOutcome?: string | null
  leadId?: string | null
  [chave: string]: unknown
}

export type Utm = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

/** Campos que jamais podem ir para o registro, mesmo se alguém passar. */
const PROIBIDOS = [
  'password', 'senha', 'token', 'secret', 'apikey', 'api_key',
  'card', 'cartao', 'cvv', 'cpf', 'document', 'email', 'phone', 'telefone',
]

/**
 * Remove o que não pode ser gravado.
 *
 * A lista de proibidos existe porque props é um objeto aberto: alguém vai
 * acabar passando o e-mail junto "só para facilitar", e a hora de barrar é
 * antes de gravar, não em revisão de código.
 */
export function limparProps(props: PropsDoEvento = {}): Record<string, unknown> {
  const limpo: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === undefined || valor === null) continue
    const nome = chave.toLowerCase()
    if (PROIBIDOS.some((p) => nome.includes(p))) continue
    if (typeof valor === 'string' && valor.length > 200) continue
    limpo[chave] = valor
  }
  return limpo
}

/** Classifica o aparelho a partir da largura. Sem impressão digital. */
export function tipoDeAparelho(largura: number): 'desktop' | 'tablet' | 'mobile' {
  if (largura < 640) return 'mobile'
  if (largura < 1024) return 'tablet'
  return 'desktop'
}

/** Só os cinco campos de UTM, nada mais da query string. */
export function extrairUtm(params: URLSearchParams): Utm {
  const utm: Utm = {}
  for (const chave of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
    const valor = params.get(chave)
    if (valor) utm[chave] = valor.slice(0, 120)
  }
  return utm
}
