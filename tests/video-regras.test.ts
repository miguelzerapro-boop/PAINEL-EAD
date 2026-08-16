import { describe, expect, it } from 'vitest'

import {
  ACCEPT_DE_VIDEO,
  EXTENSOES_POR_MIME,
  LIMITE_BYTES,
  MIMES_DE_VIDEO,
  assinaturaConfere,
  ehMimeDeVideo,
  extensaoDe,
  formatarBytes,
  validarDeclaracao,
} from '@/lib/video/regras'

/**
 * VALIDAÇÃO DO ARQUIVO DE VÍDEO
 *
 * O caso que importa de verdade é o último bloco: um arquivo que MENTE sobre
 * o que é. Extensão e MIME são declarações do cliente e podem ser forjadas;
 * a assinatura nos primeiros bytes, não.
 */

/** Monta um cabeçalho ISO-BMFF válido (MP4/MOV): bytes 4..8 = 'ftyp'. */
function cabecalhoMp4(): Uint8Array {
  const b = new Uint8Array(32)
  b[0] = 0x00
  b[1] = 0x00
  b[2] = 0x00
  b[3] = 0x20
  b[4] = 0x66 // f
  b[5] = 0x74 // t
  b[6] = 0x79 // y
  b[7] = 0x70 // p
  return b
}

/** Cabeçalho EBML (WebM/Matroska): 1A 45 DF A3. */
function cabecalhoWebm(): Uint8Array {
  const b = new Uint8Array(32)
  b[0] = 0x1a
  b[1] = 0x45
  b[2] = 0xdf
  b[3] = 0xa3
  return b
}

/** Cabeçalho de ZIP: 'PK\x03\x04'. É o disfarce clássico. */
function cabecalhoZip(): Uint8Array {
  const b = new Uint8Array(32)
  b[0] = 0x50 // P
  b[1] = 0x4b // K
  b[2] = 0x03
  b[3] = 0x04
  return b
}

describe('MIME permitido', () => {
  it('aceita exatamente os três MIME do bucket', () => {
    expect([...MIMES_DE_VIDEO]).toEqual(['video/mp4', 'video/webm', 'video/quicktime'])
  })

  it('reconhece os MIME de vídeo', () => {
    expect(ehMimeDeVideo('video/mp4')).toBe(true)
    expect(ehMimeDeVideo('video/webm')).toBe(true)
    expect(ehMimeDeVideo('video/quicktime')).toBe(true)
  })

  it('recusa MIME que não é de vídeo', () => {
    expect(ehMimeDeVideo('application/zip')).toBe(false)
    expect(ehMimeDeVideo('image/png')).toBe(false)
    expect(ehMimeDeVideo('video/avi')).toBe(false)
    expect(ehMimeDeVideo('')).toBe(false)
  })

  it('o accept do input cobre MIME e extensões', () => {
    expect(ACCEPT_DE_VIDEO).toContain('video/mp4')
    expect(ACCEPT_DE_VIDEO).toContain('.mp4')
    expect(ACCEPT_DE_VIDEO).toContain('.mov')
    expect(ACCEPT_DE_VIDEO).toContain('.webm')
  })
})

describe('extensão', () => {
  it('extrai a extensão em minúsculas', () => {
    expect(extensaoDe('aula.MP4')).toBe('mp4')
    expect(extensaoDe('aula final.mov')).toBe('mov')
    expect(extensaoDe('a.b.c.webm')).toBe('webm')
  })

  it('devolve vazio quando não há extensão', () => {
    expect(extensaoDe('semextensao')).toBe('')
  })

  it('mapeia extensões por MIME', () => {
    expect(EXTENSOES_POR_MIME['video/mp4']).toContain('mp4')
    expect(EXTENSOES_POR_MIME['video/quicktime']).toContain('mov')
    expect(EXTENSOES_POR_MIME['video/webm']).toContain('webm')
  })
})

describe('validação da declaração', () => {
  it('aprova um MP4 plausível', () => {
    expect(
      validarDeclaracao({ nome: 'aula-01.mp4', tamanho: 50_000_000, mime: 'video/mp4' }),
    ).toBeNull()
  })

  it('aprova MOV, que é o que sai do iPhone sem conversão', () => {
    expect(
      validarDeclaracao({ nome: 'IMG_0042.mov', tamanho: 800_000_000, mime: 'video/quicktime' }),
    ).toBeNull()
  })

  it('recusa arquivo vazio', () => {
    const r = validarDeclaracao({ nome: 'a.mp4', tamanho: 0, mime: 'video/mp4' })
    expect(r?.campo).toBe('vazio')
  })

  it('recusa acima do limite do bucket', () => {
    const r = validarDeclaracao({ nome: 'a.mp4', tamanho: LIMITE_BYTES + 1, mime: 'video/mp4' })
    expect(r?.campo).toBe('tamanho')
    expect(r?.mensagem).toContain('5 GB')
  })

  it('aceita exatamente no limite', () => {
    expect(
      validarDeclaracao({ nome: 'a.mp4', tamanho: LIMITE_BYTES, mime: 'video/mp4' }),
    ).toBeNull()
  })

  it('recusa tipo não permitido, sem jargão técnico', () => {
    const r = validarDeclaracao({ nome: 'a.zip', tamanho: 100, mime: 'application/zip' })
    expect(r?.campo).toBe('tipo')
    expect(r?.mensagem).toMatch(/MP4/)
    expect(r?.mensagem).not.toMatch(/mime|MIME type|error|null/i)
  })

  it('recusa extensão que não combina com o MIME declarado', () => {
    const r = validarDeclaracao({ nome: 'aula.webm', tamanho: 100, mime: 'video/mp4' })
    expect(r?.campo).toBe('extensao')
  })
})

describe('assinatura — o arquivo é o que diz ser?', () => {
  it('aceita MP4 de verdade', () => {
    expect(assinaturaConfere(cabecalhoMp4(), 'video/mp4')).toBe(true)
  })

  it('aceita MOV de verdade (mesmo contêiner ISO-BMFF)', () => {
    expect(assinaturaConfere(cabecalhoMp4(), 'video/quicktime')).toBe(true)
  })

  it('aceita WebM de verdade', () => {
    expect(assinaturaConfere(cabecalhoWebm(), 'video/webm')).toBe(true)
  })

  it('RECUSA um ZIP renomeado para .mp4 — o caso que motiva esta camada', () => {
    expect(assinaturaConfere(cabecalhoZip(), 'video/mp4')).toBe(false)
  })

  it('recusa MP4 apresentado como WebM', () => {
    expect(assinaturaConfere(cabecalhoMp4(), 'video/webm')).toBe(false)
  })

  it('recusa WebM apresentado como MP4', () => {
    expect(assinaturaConfere(cabecalhoWebm(), 'video/mp4')).toBe(false)
  })

  it('recusa cabeçalho curto demais para decidir', () => {
    expect(assinaturaConfere(new Uint8Array(4), 'video/mp4')).toBe(false)
  })

  it('recusa MIME desconhecido mesmo com bytes válidos', () => {
    expect(assinaturaConfere(cabecalhoMp4(), 'application/zip')).toBe(false)
  })
})

describe('formatação de tamanho', () => {
  it('não inventa zero para valor ausente', () => {
    expect(formatarBytes(null)).toBeNull()
    expect(formatarBytes(0)).toBeNull()
    expect(formatarBytes(undefined)).toBeNull()
  })

  it('escolhe a unidade legível', () => {
    expect(formatarBytes(500 * 1024)).toBe('500 KB')
    expect(formatarBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatarBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB')
  })
})
