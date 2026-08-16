/**
 * REGRAS DO VÍDEO DE AULA
 *
 * Compartilhado entre navegador e servidor de propósito: os dois precisam
 * concordar sobre o que é um arquivo aceitável, senão a tela promete um envio
 * que o Storage vai recusar depois de 40 minutos subindo.
 *
 * Nenhuma destas regras substitui a barreira real. A ordem de defesa é:
 *
 *   1. navegador  — extensão, MIME e ASSINATURA do arquivo (bytes iniciais),
 *                   antes de gastar a banda da responsável;
 *   2. servidor    — reconfere o que foi declarado ao pedir a URL assinada;
 *   3. Storage     — `allowed_mime_types` e `file_size_limit` do bucket
 *                    (migration 20) recusam por conta própria;
 *   4. servidor    — depois do envio, lê os PRIMEIROS BYTES do que realmente
 *                    chegou e confere a assinatura. É a única checagem que o
 *                    cliente não tem como enganar.
 *
 * Só a etapa 4 prova o tipo do arquivo. As outras três existem para a pessoa
 * receber "esse arquivo não é um vídeo" em dois segundos, e não no fim.
 */

/** Espelha `allowed_mime_types` do bucket lesson-videos. Mudar aqui exige migration. */
export const MIMES_DE_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'] as const

export type MimeDeVideo = (typeof MIMES_DE_VIDEO)[number]

/**
 * Extensões aceitas por MIME.
 *
 * MP4/H.264 é a recomendação: é o que toca em iPhone, Android antigo, Smart TV
 * e navegador de desktop sem transcodificação. WebM entra porque o bucket
 * aceita; MOV entra porque é o que sai de um iPhone sem conversão — e exigir
 * que a responsável converta antes de enviar seria justamente o trabalho
 * manual que este projeto quer eliminar.
 */
export const EXTENSOES_POR_MIME: Record<MimeDeVideo, string[]> = {
  'video/mp4': ['mp4', 'm4v'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
}

/** Espelha `file_size_limit` do bucket lesson-videos: 5 GB. */
export const LIMITE_BYTES = 5_368_709_120

export const LIMITE_LEGIVEL = '5 GB'

/** Quantos bytes o servidor precisa ler para reconhecer a assinatura. */
export const BYTES_DE_ASSINATURA = 32

export function extensaoDe(nomeDoArquivo: string): string {
  const partes = nomeDoArquivo.toLowerCase().split('.')
  if (partes.length < 2) return ''
  return (partes.pop() ?? '').replace(/[^a-z0-9]/g, '')
}

export function ehMimeDeVideo(mime: string): mime is MimeDeVideo {
  return (MIMES_DE_VIDEO as readonly string[]).includes(mime)
}

export type ProblemaDeArquivo = {
  campo: 'tipo' | 'extensao' | 'tamanho' | 'assinatura' | 'vazio'
  mensagem: string
}

/**
 * Confere o que dá para conferir sem olhar o conteúdo: tipo, extensão e
 * tamanho. Devolve null quando está tudo certo.
 */
export function validarDeclaracao(params: {
  nome: string
  tamanho: number
  mime: string
}): ProblemaDeArquivo | null {
  if (!params.tamanho || params.tamanho <= 0) {
    return { campo: 'vazio', mensagem: 'O arquivo está vazio.' }
  }

  if (params.tamanho > LIMITE_BYTES) {
    return {
      campo: 'tamanho',
      mensagem: `O vídeo tem ${formatarBytes(params.tamanho)} e o limite é ${LIMITE_LEGIVEL}.`,
    }
  }

  if (!ehMimeDeVideo(params.mime)) {
    return {
      campo: 'tipo',
      mensagem:
        'Formato não aceito. Envie MP4 (recomendado), MOV ou WebM. Se o arquivo veio de um celular, ele já costuma estar em MP4 ou MOV.',
    }
  }

  const extensao = extensaoDe(params.nome)
  if (!EXTENSOES_POR_MIME[params.mime].includes(extensao)) {
    return {
      campo: 'extensao',
      mensagem: `A extensão “.${extensao || '?'}” não combina com um arquivo ${params.mime}. Renomear a extensão não converte o vídeo.`,
    }
  }

  return null
}

/**
 * ASSINATURA DO ARQUIVO — o que ele é de verdade.
 *
 *   MP4 / M4V / MOV (ISO BMFF): os bytes 4..8 são 'ftyp'.
 *   WebM / Matroska (EBML):     começa com 1A 45 DF A3.
 *
 * Um .zip renomeado para .mp4 não passa daqui.
 */
export function assinaturaConfere(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false

  if (mime === 'video/webm') {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  }

  if (mime === 'video/mp4' || mime === 'video/quicktime') {
    return (
      bytes[4] === 0x66 && // f
      bytes[5] === 0x74 && // t
      bytes[6] === 0x79 && // y
      bytes[7] === 0x70 //   p
    )
  }

  return false
}

export function formatarBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null
  const mb = bytes / 1024 / 1024
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

/** `accept` do input de arquivo — filtra o seletor do celular e do desktop. */
export const ACCEPT_DE_VIDEO = [
  ...MIMES_DE_VIDEO,
  ...Object.values(EXTENSOES_POR_MIME).flatMap((exts) => exts.map((e) => `.${e}`)),
].join(',')
