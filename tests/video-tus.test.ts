import { describe, expect, it } from 'vitest'

import {
  TAMANHO_DO_BLOCO,
  classificarFalha,
  formatarTempoRestante,
  formatarVelocidade,
  mensagemDaFalha,
} from '@/lib/video/tus'

/**
 * UPLOAD RESUMÍVEL — comportamento testável sem rede.
 *
 * ⚠️ TESTADO COM SIMULAÇÃO, NÃO COM SUPABASE REAL.
 *
 * O que este arquivo prova: a classificação de falhas, as mensagens que a
 * responsável lê e a aritmética de velocidade/tempo. O que ele NÃO prova: que
 * o endpoint resumível do Supabase aceita nossos cabeçalhos e retoma de fato.
 * Isso é papel de `npm run storage:validate`, contra um projeto real.
 */

describe('contrato com o Supabase', () => {
  it('o bloco é de exatamente 6 MB — exigência do endpoint resumível', () => {
    expect(TAMANHO_DO_BLOCO).toBe(6 * 1024 * 1024)
  })
})

describe('classificação de falhas', () => {
  it('401 e 403 são problema de permissão ou sessão', () => {
    expect(classificarFalha(new Error('tus: unexpected response, status: 401'))).toBe('permissao')
    expect(classificarFalha(new Error('tus: unexpected response, status: 403'))).toBe('permissao')
  })

  it('409 é conflito — outro envio para o mesmo destino', () => {
    expect(classificarFalha(new Error('tus: response status: 409 Conflict'))).toBe('conflito')
  })

  it('404 e 410 num PATCH significam sessão de upload expirada', () => {
    expect(classificarFalha(new Error('tus: status: 404'))).toBe('expirado')
    expect(classificarFalha(new Error('tus: status: 410 Gone'))).toBe('expirado')
  })

  it('413 é arquivo grande demais', () => {
    expect(classificarFalha(new Error('status: 413'))).toBe('tamanho')
  })

  it('415 é tipo recusado pelo bucket', () => {
    expect(classificarFalha(new Error('status: 415'))).toBe('tipo')
  })

  it('queda de conexão é classificada como rede', () => {
    expect(classificarFalha(new Error('Failed to fetch'))).toBe('rede')
    expect(classificarFalha(new TypeError('NetworkError when attempting to fetch'))).toBe('rede')
    expect(classificarFalha(new Error('ECONNRESET'))).toBe('rede')
    expect(classificarFalha(new Error('request timeout'))).toBe('rede')
  })

  it('o que não se reconhece não vira palpite', () => {
    expect(classificarFalha(new Error('algo estranho'))).toBe('desconhecido')
    expect(classificarFalha(null)).toBe('desconhecido')
    expect(classificarFalha(undefined)).toBe('desconhecido')
  })
})

describe('mensagens para a responsável', () => {
  it('queda de rede promete que o progresso foi preservado', () => {
    expect(mensagemDaFalha('rede')).toBe('A conexão foi interrompida. Seu progresso foi preservado.')
  })

  it('tipo inválido dá a instrução concreta', () => {
    expect(mensagemDaFalha('tipo')).toContain('MP4')
  })

  it('nenhuma mensagem vaza status HTTP, stack ou SQL', () => {
    const motivos = ['rede', 'expirado', 'conflito', 'permissao', 'tamanho', 'tipo', 'desconhecido'] as const
    for (const m of motivos) {
      const texto = mensagemDaFalha(m)
      expect(texto).not.toMatch(/\b[45]\d{2}\b/)
      expect(texto).not.toMatch(/at .*\.ts:|Error:|select |insert |null|undefined/i)
      // Frase completa em português, com ponto final.
      expect(texto.length).toBeGreaterThan(20)
      expect(texto.trim().endsWith('.')).toBe(true)
    }
  })

  it('todo motivo tem mensagem própria — nenhuma repetida por descuido', () => {
    const motivos = ['rede', 'expirado', 'conflito', 'permissao', 'tamanho', 'tipo'] as const
    const textos = motivos.map(mensagemDaFalha)
    expect(new Set(textos).size).toBe(motivos.length)
  })
})

describe('velocidade e tempo restante', () => {
  it('não mostra velocidade quando não é confiável', () => {
    expect(formatarVelocidade(null)).toBeNull()
    expect(formatarVelocidade(0)).toBeNull()
    expect(formatarVelocidade(-1)).toBeNull()
  })

  it('escolhe a unidade legível', () => {
    expect(formatarVelocidade(2.5 * 1024 * 1024)).toBe('2.5 MB/s')
    expect(formatarVelocidade(300 * 1024)).toBe('300 KB/s')
  })

  it('não inventa tempo restante sem dado', () => {
    expect(formatarTempoRestante(null)).toBeNull()
    expect(formatarTempoRestante(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatarTempoRestante(-5)).toBeNull()
  })

  it('fala em linguagem aproximada, não em segundos exatos', () => {
    expect(formatarTempoRestante(30)).toBe('menos de 1 min')
    expect(formatarTempoRestante(300)).toBe('cerca de 5 min')
    expect(formatarTempoRestante(3600)).toBe('cerca de 1 h')
    expect(formatarTempoRestante(5400)).toBe('cerca de 1 h 30 min')
  })
})
