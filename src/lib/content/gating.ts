import type { Database } from '@/types/database-lite'

/**
 * Texto honesto para conteúdo bloqueado.
 *
 * A regra vem do banco (`lesson_is_released` / `module_is_released`). Aqui só
 * traduzimos para uma frase que diz o MOTIVO — nunca um cadeado sem explicação.
 */

export type ReleaseMode = Database['release_mode']

export function motivoDaTrava(alvo: 'aula' | 'modulo', modo?: ReleaseMode, detalhe?: { dias?: number; data?: string }) {
  const nome = alvo === 'aula' ? 'Esta aula' : 'Este módulo'

  switch (modo) {
    case 'on_date':
      return detalhe?.data ? `${nome} abre em ${detalhe.data}.` : `${nome} abre em data marcada.`
    case 'days_after_enrollment':
      return detalhe?.dias
        ? `${nome} abre ${detalhe.dias} dias após a sua matrícula.`
        : `${nome} abre alguns dias após a sua matrícula.`
    case 'after_previous_lesson':
      return `${nome} abre quando você concluir a aula anterior.`
    case 'after_previous_module':
      return `${nome} abre quando você concluir o módulo anterior.`
    case 'manual':
      return `${nome} é liberado pela instrutora.`
    case 'by_cohort':
      return `${nome} abre junto com a sua turma.`
    default:
      return `${nome} ainda não está liberado para você.`
  }
}
