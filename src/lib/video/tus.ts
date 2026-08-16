'use client'

import { Upload, type UploadOptions } from 'tus-js-client'

import { ESTADO_ENVIO, type EstadoEnvio } from './estados'

/**
 * UPLOAD RESUMÍVEL DE VÍDEO DE AULA (TUS)
 *
 * O problema que isto resolve: um envio de 800 MB que cai aos 80% não pode
 * recomeçar do zero. O protocolo TUS quebra o arquivo em blocos e guarda, do
 * lado do servidor, quantos bytes já chegaram; retomar é perguntar "onde
 * paramos?" e continuar dali.
 *
 * QUEM AUTORIZA
 *
 * O navegador usa o ACCESS TOKEN DA PRÓPRIA ADMINISTRADORA — nunca a chave de
 * backend. Quem decide se a gravação é permitida é a policy
 * `aula: apenas equipe envia` (migration 20), que exige admin ou instrutora
 * do curso e confere o `{course_id}` no primeiro segmento do caminho.
 *
 * Isso significa que não existe segredo trafegando para o cliente, e que uma
 * sessão de aluna simplesmente não consegue gravar — o Storage recusa, não a
 * interface.
 *
 * O caminho de destino é montado NO SERVIDOR e chega aqui pronto. O cliente
 * não escolhe onde grava.
 *
 * BLOCOS DE 6 MB
 *
 * Não é escolha de gosto: o endpoint resumível do Supabase exige exatamente
 * 6 MB por bloco. Outro valor é recusado.
 */

/** Exigência do endpoint resumível do Supabase. Não alterar. */
export const TAMANHO_DO_BLOCO = 6 * 1024 * 1024

/** Quantas vezes tentar de novo sozinho antes de entregar o erro à pessoa. */
const ESPERAS_DE_RETENTATIVA = [0, 3000, 10000, 20000]

export type ProgressoDoEnvio = {
  enviados: number
  total: number
  pct: number
  /** Bytes por segundo na janela recente. `null` enquanto não é confiável. */
  bytesPorSegundo: number | null
  /** Segundos restantes estimados. `null` enquanto não é confiável. */
  segundosRestantes: number | null
}

export type MotivoDeFalha =
  | 'rede'
  | 'expirado'
  | 'conflito'
  | 'permissao'
  | 'tamanho'
  | 'tipo'
  | 'desconhecido'

export type EventosDoEnvio = {
  onEstado?: (estado: EstadoEnvio) => void
  onProgresso?: (p: ProgressoDoEnvio) => void
  /** Chamado quando o servidor devolve a URL de retomada. Persista-a. */
  onUrlDeRetomada?: (url: string) => void
  onSucesso?: () => void
  onFalha?: (motivo: MotivoDeFalha, mensagem: string) => void
}

export type ParametrosDoEnvio = {
  arquivo: File
  bucket: string
  /** `{course_id}/{lesson_id}/{uuid}.{ext}` — montado pelo servidor. */
  caminho: string
  supabaseUrl: string
  /** Token da sessão de quem está enviando. Nunca a chave de backend. */
  accessToken: string
  /** Devolvida por um envio anterior, para continuar de onde parou. */
  urlDeRetomada?: string | null
}

/**
 * Traduz a falha do transporte para um motivo que a interface saiba explicar.
 *
 * As mensagens que a pessoa lê são montadas na camada de cima; aqui só se
 * classifica. Nunca devolvemos corpo de resposta cru — pode conter caminho
 * interno do storage.
 */
export function classificarFalha(erro: unknown): MotivoDeFalha {
  const texto = erro instanceof Error ? erro.message : String(erro ?? '')
  const status = Number(/status:\s*(\d{3})/i.exec(texto)?.[1] ?? NaN)

  if (status === 401 || status === 403) return 'permissao'
  if (status === 409) return 'conflito'
  // 404/410 num PATCH de retomada = a sessão de upload não existe mais.
  if (status === 404 || status === 410) return 'expirado'
  if (status === 413) return 'tamanho'
  if (status === 415) return 'tipo'

  if (/failed to fetch|networkerror|network error|load failed|econnreset|timeout/i.test(texto)) {
    return 'rede'
  }
  return 'desconhecido'
}

/** Mensagem em português para a pessoa. Sem status HTTP, sem SQL, sem stack. */
export function mensagemDaFalha(motivo: MotivoDeFalha): string {
  switch (motivo) {
    case 'rede':
      return 'A conexão foi interrompida. Seu progresso foi preservado.'
    case 'expirado':
      return 'A sessão de envio expirou. É preciso enviar o arquivo de novo.'
    case 'conflito':
      return 'Já existe outro envio em andamento para esta aula. Termine ou cancele o outro antes.'
    case 'permissao':
      return 'Sua sessão expirou ou você não tem permissão para enviar vídeo neste curso. Entre de novo e tente outra vez.'
    case 'tamanho':
      return 'O arquivo é maior do que o limite permitido.'
    case 'tipo':
      return 'Esse arquivo não parece ser um vídeo válido. Escolha um arquivo MP4 ou WebM.'
    default:
      return 'Não foi possível concluir o envio. Tente de novo.'
  }
}

/**
 * Mede a velocidade numa janela curta.
 *
 * Média desde o início mente: se a conexão caiu por 40 s, a média continua
 * mostrando a velocidade de antes da queda e o tempo restante fica errado. A
 * janela de amostras recentes acompanha a rede de verdade.
 */
class MedidorDeVelocidade {
  private amostras: Array<{ t: number; bytes: number }> = []
  private readonly janelaMs = 8000

  registrar(bytes: number, agora: number) {
    this.amostras.push({ t: agora, bytes })
    const corte = agora - this.janelaMs
    while (this.amostras.length > 0 && (this.amostras[0]?.t ?? 0) < corte) {
      this.amostras.shift()
    }
  }

  /** `null` enquanto não houver amostra suficiente para não mentir. */
  bytesPorSegundo(): number | null {
    if (this.amostras.length < 2) return null
    const primeira = this.amostras[0]
    const ultima = this.amostras[this.amostras.length - 1]
    if (!primeira || !ultima) return null
    const segundos = (ultima.t - primeira.t) / 1000
    if (segundos < 1) return null
    const bytes = ultima.bytes - primeira.bytes
    if (bytes <= 0) return null
    return bytes / segundos
  }

  limpar() {
    this.amostras = []
  }
}

/**
 * Um envio: começar, pausar, retomar, cancelar.
 *
 * Guarda a URL de retomada assim que o servidor a devolve; é ela que permite
 * continuar depois de fechar a aba.
 */
export class EnvioResumivel {
  private upload: Upload | null = null
  private medidor = new MedidorDeVelocidade()
  private estadoAtual: EstadoEnvio = ESTADO_ENVIO.PENDENTE
  private urlDeRetomada: string | null = null
  private cancelado = false

  constructor(
    private readonly params: ParametrosDoEnvio,
    private readonly eventos: EventosDoEnvio = {},
  ) {
    this.urlDeRetomada = params.urlDeRetomada ?? null
  }

  get estado(): EstadoEnvio {
    return this.estadoAtual
  }

  get enderecoDeRetomada(): string | null {
    return this.urlDeRetomada
  }

  private mudarEstado(novo: EstadoEnvio) {
    this.estadoAtual = novo
    this.eventos.onEstado?.(novo)
  }

  private montarOpcoes(): UploadOptions {
    const { arquivo, bucket, caminho, supabaseUrl, accessToken } = this.params

    return {
      endpoint: `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/upload/resumable`,
      // Presente = retomar aquela sessão. Ausente = criar uma nova.
      uploadUrl: this.urlDeRetomada,
      retryDelays: ESPERAS_DE_RETENTATIVA,
      chunkSize: TAMANHO_DO_BLOCO,
      // Sem isto o tus-js-client corta o arquivo achando que já subiu tudo.
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${accessToken}`,
        // Trocar o vídeo grava num caminho novo; nunca se sobrescreve.
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: bucket,
        objectName: caminho,
        contentType: arquivo.type,
        cacheControl: '3600',
      },

      onShouldRetry: (erro) => {
        // Não adianta insistir no que não vai mudar sozinho.
        const motivo = classificarFalha(erro)
        return motivo === 'rede' || motivo === 'desconhecido'
      },

      onAfterResponse: (_req, res) => {
        // O servidor devolve a URL de retomada na criação. É o que salva os 80%.
        const local = res.getHeader('Location')
        if (local && local !== this.urlDeRetomada) {
          this.urlDeRetomada = local
          this.eventos.onUrlDeRetomada?.(local)
        }
      },

      onProgress: (enviados, total) => {
        const agora = Date.now()
        this.medidor.registrar(enviados, agora)
        const vel = this.medidor.bytesPorSegundo()

        this.eventos.onProgresso?.({
          enviados,
          total,
          pct: total > 0 ? Math.round((enviados / total) * 100) : 0,
          bytesPorSegundo: vel,
          segundosRestantes: vel && vel > 0 ? Math.round((total - enviados) / vel) : null,
        })
      },

      onSuccess: () => {
        this.medidor.limpar()
        this.mudarEstado(ESTADO_ENVIO.VALIDANDO)
        this.eventos.onSucesso?.()
      },

      onError: (erro) => {
        this.medidor.limpar()
        if (this.cancelado) return

        const motivo = classificarFalha(erro)
        // Queda de rede não é fim: o que já subiu continua lá, retomável.
        this.mudarEstado(motivo === 'rede' ? ESTADO_ENVIO.PAUSADO : ESTADO_ENVIO.FALHOU)
        this.eventos.onFalha?.(motivo, mensagemDaFalha(motivo))
      },
    }
  }

  /** Começa — ou continua, se houver URL de retomada. */
  async iniciar(): Promise<void> {
    this.cancelado = false
    const opcoes = this.montarOpcoes()
    const upload = new Upload(this.params.arquivo, opcoes)
    this.upload = upload

    /*
     * Duas formas de retomar, nesta ordem:
     *
     *  1. `uploadUrl` nas opções — a URL que guardamos no banco. Funciona
     *     mesmo em outro navegador ou outra máquina.
     *  2. Impressão digital no localStorage — o tus-js-client reconhece o
     *     mesmo arquivo e continua sozinho. Só vale no mesmo navegador, e é
     *     por isso que não se depende dela.
     */
    if (!this.urlDeRetomada) {
      const anteriores = await upload.findPreviousUploads()
      const primeiro = anteriores[0]
      if (primeiro) upload.resumeFromPreviousUpload(primeiro)
    }

    this.mudarEstado(ESTADO_ENVIO.ENVIANDO)
    upload.start()
  }

  /** Pausa. O que já subiu permanece no servidor. */
  pausar() {
    if (!this.upload) return
    void this.upload.abort(false)
    this.mudarEstado(ESTADO_ENVIO.PAUSADO)
  }

  /** Continua de onde parou. */
  retomar() {
    if (!this.upload) {
      void this.iniciar()
      return
    }
    this.mudarEstado(ESTADO_ENVIO.ENVIANDO)
    this.upload.start()
  }

  /**
   * Cancela e descarta a sessão no servidor.
   *
   * `abort(true)` manda um DELETE: sem isso, os bytes parciais ficariam no
   * bucket sem ninguém para reclamá-los.
   */
  async cancelar() {
    this.cancelado = true
    if (this.upload) {
      try {
        await this.upload.abort(true)
      } catch {
        // Falhar em descartar não pode travar a interface. O registro em
        // lesson_video_uploads garante que a limpeza encontra o que sobrou.
      }
    }
    this.urlDeRetomada = null
    this.mudarEstado(ESTADO_ENVIO.CANCELADO)
  }

  /** Recomeça do zero, jogando fora a sessão anterior. */
  async recomecar() {
    if (this.upload) {
      try {
        await this.upload.abort(true)
      } catch {
        /* idem */
      }
    }
    this.upload = null
    this.urlDeRetomada = null
    this.medidor.limpar()
    await this.iniciar()
  }
}

/* -------------------------------------------------------------------------- */
/* Formatação para a tela                                                      */
/* -------------------------------------------------------------------------- */

export function formatarVelocidade(bytesPorSegundo: number | null): string | null {
  if (!bytesPorSegundo || bytesPorSegundo <= 0) return null
  const mb = bytesPorSegundo / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`
  return `${Math.round(bytesPorSegundo / 1024)} KB/s`
}

export function formatarTempoRestante(segundos: number | null): string | null {
  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) return null
  if (segundos < 60) return 'menos de 1 min'
  const min = Math.round(segundos / 60)
  if (min < 60) return `cerca de ${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `cerca de ${h} h` : `cerca de ${h} h ${resto} min`
}
