/**
 * ESTADOS DO ENVIO DE VÍDEO — fonte única.
 *
 * Espelha exatamente a constraint `lesson_video_uploads_status_check`
 * (migration 25). Se um estado for acrescentado aqui sem migration, o banco
 * recusa a gravação — que é o comportamento desejado: o schema manda.
 *
 * Nenhum arquivo da aplicação deve escrever `'pendente'` solto. Importe daqui.
 */

export const ESTADO_ENVIO = {
  /** Registro criado; os bytes ainda não começaram. */
  PENDENTE: 'pendente',
  /** Transferência em andamento. */
  ENVIANDO: 'enviando',
  /** Interrompida — por escolha ou por queda. Retomável. */
  PAUSADO: 'pausado',
  /** Bytes no bucket; o servidor está conferindo a assinatura. */
  VALIDANDO: 'validando',
  /** Arquivo validado e ligado à aula. */
  CONCLUIDO: 'concluido',
  /** Recusado na validação, ou erro definitivo. */
  FALHOU: 'falhou',
  /** Abandonado por escolha explícita. */
  CANCELADO: 'cancelado',
  /** A aula trocou de vídeo; este arquivo ficou para trás. */
  SUBSTITUIDO: 'substituido',
  /** Marcado pela limpeza administrativa. */
  ORFAO: 'orfao',
  /** Fora de uso, guardado por histórico. */
  ARQUIVADO: 'arquivado',
} as const

export type EstadoEnvio = (typeof ESTADO_ENVIO)[keyof typeof ESTADO_ENVIO]

export const TODOS_OS_ESTADOS: readonly EstadoEnvio[] = Object.values(ESTADO_ENVIO)

/**
 * Estados EM ABERTO: existe uma transferência viva ou pendente para esta aula.
 *
 * Duas consequências, ambas checadas no banco:
 *   · só pode haver um envio em aberto por aula (índice parcial único);
 *   · aula com envio em aberto não pode ser publicada (lesson_video_is_ready).
 */
export const ESTADOS_EM_ABERTO: readonly EstadoEnvio[] = [
  ESTADO_ENVIO.PENDENTE,
  ESTADO_ENVIO.ENVIANDO,
  ESTADO_ENVIO.PAUSADO,
  ESTADO_ENVIO.VALIDANDO,
]

/** Estados retomáveis: dá para continuar de onde parou. */
export const ESTADOS_RETOMAVEIS: readonly EstadoEnvio[] = [
  ESTADO_ENVIO.ENVIANDO,
  ESTADO_ENVIO.PAUSADO,
]

/** Estados que podem ter deixado arquivo sem dono no bucket. */
export const ESTADOS_LIMPAVEIS: readonly EstadoEnvio[] = [
  ESTADO_ENVIO.PENDENTE,
  ESTADO_ENVIO.ENVIANDO,
  ESTADO_ENVIO.PAUSADO,
  ESTADO_ENVIO.VALIDANDO,
  ESTADO_ENVIO.SUBSTITUIDO,
  ESTADO_ENVIO.FALHOU,
]

export function ehEstadoEnvio(valor: unknown): valor is EstadoEnvio {
  return typeof valor === 'string' && (TODOS_OS_ESTADOS as readonly string[]).includes(valor)
}

export function estaEmAberto(estado: EstadoEnvio): boolean {
  return ESTADOS_EM_ABERTO.includes(estado)
}

export function podeRetomar(estado: EstadoEnvio): boolean {
  return ESTADOS_RETOMAVEIS.includes(estado)
}

/**
 * Transições permitidas.
 *
 * Existe para que um bug não leve um envio de 'concluido' de volta para
 * 'enviando' e ressuscite um arquivo já substituído.
 */
const TRANSICOES: Record<EstadoEnvio, readonly EstadoEnvio[]> = {
  pendente: ['enviando', 'cancelado', 'falhou', 'orfao'],
  enviando: ['pausado', 'validando', 'cancelado', 'falhou', 'orfao'],
  pausado: ['enviando', 'cancelado', 'falhou', 'orfao'],
  validando: ['concluido', 'falhou', 'orfao'],
  concluido: ['substituido', 'arquivado'],
  falhou: ['pendente', 'orfao', 'arquivado'],
  cancelado: ['orfao', 'arquivado'],
  substituido: ['orfao', 'arquivado'],
  orfao: ['arquivado'],
  arquivado: [],
}

export function transicaoPermitida(de: EstadoEnvio, para: EstadoEnvio): boolean {
  return TRANSICOES[de].includes(para)
}

/** Texto que a responsável lê. Sem jargão, sem código. */
export const ROTULO_ESTADO: Record<EstadoEnvio, string> = {
  pendente: 'aguardando envio',
  enviando: 'enviando',
  pausado: 'pausado',
  validando: 'validando',
  concluido: 'pronto',
  falhou: 'falhou',
  cancelado: 'cancelado',
  substituido: 'substituído',
  orfao: 'sem aula vinculada',
  arquivado: 'arquivado',
}
