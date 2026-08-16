import { describe, expect, it } from 'vitest'

import {
  ESTADOS_EM_ABERTO,
  ESTADOS_LIMPAVEIS,
  ESTADOS_RETOMAVEIS,
  ESTADO_ENVIO,
  ROTULO_ESTADO,
  TODOS_OS_ESTADOS,
  ehEstadoEnvio,
  estaEmAberto,
  podeRetomar,
  transicaoPermitida,
} from '@/lib/video/estados'

/**
 * ESTADOS DO ENVIO
 *
 * Este arquivo é o contrato com o banco. A constraint
 * `lesson_video_uploads_status_check` (migration 25) aceita exatamente esta
 * lista; a verificação de que o banco concorda está em
 * `scripts/homolog/10-formacao.mjs`, seção H.
 */

describe('conjunto de estados', () => {
  it('tem exatamente os dez estados formalizados', () => {
    expect([...TODOS_OS_ESTADOS].sort()).toEqual(
      [
        'arquivado',
        'cancelado',
        'concluido',
        'enviando',
        'falhou',
        'orfao',
        'pausado',
        'pendente',
        'substituido',
        'validando',
      ].sort(),
    )
  })

  it('todo estado tem um rótulo legível, sem jargão', () => {
    for (const estado of TODOS_OS_ESTADOS) {
      expect(ROTULO_ESTADO[estado]).toBeTruthy()
      expect(ROTULO_ESTADO[estado]).not.toMatch(/error|null|undefined|_/i)
    }
  })

  it('reconhece string válida e recusa inventada', () => {
    expect(ehEstadoEnvio('pausado')).toBe(true)
    expect(ehEstadoEnvio('inventado')).toBe(false)
    expect(ehEstadoEnvio(null)).toBe(false)
    expect(ehEstadoEnvio(42)).toBe(false)
  })
})

describe('estados em aberto', () => {
  it('são os quatro que impedem publicar e um segundo envio', () => {
    expect([...ESTADOS_EM_ABERTO]).toEqual(['pendente', 'enviando', 'pausado', 'validando'])
  })

  it('concluído NÃO está em aberto — senão a aula nunca publicaria', () => {
    expect(estaEmAberto(ESTADO_ENVIO.CONCLUIDO)).toBe(false)
  })

  it('cancelado e falhou não bloqueiam a aula', () => {
    expect(estaEmAberto(ESTADO_ENVIO.CANCELADO)).toBe(false)
    expect(estaEmAberto(ESTADO_ENVIO.FALHOU)).toBe(false)
  })

  it('pausado bloqueia: há uma transferência viva esperando retomada', () => {
    expect(estaEmAberto(ESTADO_ENVIO.PAUSADO)).toBe(true)
  })
})

describe('retomada', () => {
  it('enviando e pausado são retomáveis', () => {
    expect(podeRetomar(ESTADO_ENVIO.ENVIANDO)).toBe(true)
    expect(podeRetomar(ESTADO_ENVIO.PAUSADO)).toBe(true)
  })

  it('cancelado e concluído não são retomáveis', () => {
    expect(podeRetomar(ESTADO_ENVIO.CANCELADO)).toBe(false)
    expect(podeRetomar(ESTADO_ENVIO.CONCLUIDO)).toBe(false)
  })

  it('todo retomável está em aberto', () => {
    for (const e of ESTADOS_RETOMAVEIS) expect(estaEmAberto(e)).toBe(true)
  })
})

describe('transições', () => {
  it('o caminho feliz completo é permitido', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.PENDENTE, ESTADO_ENVIO.ENVIANDO)).toBe(true)
    expect(transicaoPermitida(ESTADO_ENVIO.ENVIANDO, ESTADO_ENVIO.VALIDANDO)).toBe(true)
    expect(transicaoPermitida(ESTADO_ENVIO.VALIDANDO, ESTADO_ENVIO.CONCLUIDO)).toBe(true)
  })

  it('queda e retomada: enviando → pausado → enviando', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.ENVIANDO, ESTADO_ENVIO.PAUSADO)).toBe(true)
    expect(transicaoPermitida(ESTADO_ENVIO.PAUSADO, ESTADO_ENVIO.ENVIANDO)).toBe(true)
  })

  it('concluído NÃO volta para enviando — é o que ressuscitaria arquivo trocado', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.CONCLUIDO, ESTADO_ENVIO.ENVIANDO)).toBe(false)
    expect(transicaoPermitida(ESTADO_ENVIO.CONCLUIDO, ESTADO_ENVIO.PENDENTE)).toBe(false)
  })

  it('cancelado não volta a enviar', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.CANCELADO, ESTADO_ENVIO.ENVIANDO)).toBe(false)
  })

  it('falhou pode ser tentado de novo', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.FALHOU, ESTADO_ENVIO.PENDENTE)).toBe(true)
  })

  it('arquivado é terminal', () => {
    for (const destino of TODOS_OS_ESTADOS) {
      expect(transicaoPermitida(ESTADO_ENVIO.ARQUIVADO, destino)).toBe(false)
    }
  })

  it('trocar o vídeo leva concluído a substituído', () => {
    expect(transicaoPermitida(ESTADO_ENVIO.CONCLUIDO, ESTADO_ENVIO.SUBSTITUIDO)).toBe(true)
  })
})

describe('limpeza de órfãos', () => {
  it('cobre todos os estados que podem ter deixado arquivo no bucket', () => {
    expect([...ESTADOS_LIMPAVEIS].sort()).toEqual(
      ['enviando', 'falhou', 'pausado', 'pendente', 'substituido', 'validando'].sort(),
    )
  })

  it('concluído nunca é tratado como órfão', () => {
    expect(ESTADOS_LIMPAVEIS).not.toContain(ESTADO_ENVIO.CONCLUIDO)
  })
})
