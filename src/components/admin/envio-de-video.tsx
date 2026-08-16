'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'
import {
  ACCEPT_DE_VIDEO,
  LIMITE_LEGIVEL,
  assinaturaConfere,
  formatarBytes,
  validarDeclaracao,
} from '@/lib/video/regras'
import {
  EnvioResumivel,
  formatarTempoRestante,
  formatarVelocidade,
  type MotivoDeFalha,
  type ProgressoDoEnvio,
} from '@/lib/video/tus'
import { ESTADO_ENVIO } from '@/lib/video/estados'
import {
  cancelarEnvioDeVideo,
  confirmarEnvioDeVideo,
  garantirRascunhoDeAula,
  prepararEnvioDeVideo,
  registrarProgresso,
  registrarUrlDeRetomada,
} from '@/app/admin/formacao/acoes'

/**
 * ENVIO DO VÍDEO DA AULA — resumível
 *
 * Os bytes vão do navegador DIRETO para o Storage, em blocos de 6 MB, usando o
 * access token da própria administradora. O servidor autoriza antes, anota o
 * andamento durante e confere o arquivo depois — mas nunca vê os bytes.
 *
 * O QUE MUDA COM O PROTOCOLO RESUMÍVEL
 *
 * Uma queda aos 80% deixa de ser perda. O servidor de upload sabe quantos
 * bytes já recebeu; retomar é continuar dali. Guardamos a URL de retomada no
 * banco, então funciona mesmo depois de fechar a aba — inclusive de outro
 * computador.
 *
 * A barra de progresso é real: vem do `onProgress` do próprio envio. A
 * velocidade é medida numa janela curta, e não como média desde o início:
 * depois de uma queda de 40 s, a média mentiria sobre o tempo restante.
 */

type Etapa =
  | { nome: 'ocioso' }
  | { nome: 'verificando' }
  | { nome: 'preparando' }
  | { nome: 'enviando'; progresso: ProgressoDoEnvio }
  | { nome: 'pausado'; progresso: ProgressoDoEnvio | null; porQueda: boolean }
  | { nome: 'validando' }
  | { nome: 'concluido' }
  | { nome: 'erro'; mensagem: string; motivo: MotivoDeFalha; podeRetomar: boolean }

export type VideoAtual = {
  nome: string | null
  bytes: number | null
} | null

/** Anota o avanço no servidor de vez em quando, não a cada bloco. */
const INTERVALO_DE_ANOTACAO_MS = 5000

export function EnvioDeVideo({
  lessonId,
  moduleId,
  tituloDaAula,
  videoAtual,
  onAulaCriada,
  onVideoEnviado,
}: {
  lessonId: string | null
  moduleId: string
  tituloDaAula: string
  videoAtual: VideoAtual
  onAulaCriada?: (id: string) => void
  onVideoEnviado?: () => void
}) {
  const [etapa, setEtapa] = useState<Etapa>({ nome: 'ocioso' })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [substituindo, setSubstituindo] = useState(false)

  const envioRef = useRef<EnvioResumivel | null>(null)
  const uploadIdRef = useRef<string | null>(null)
  const ultimaAnotacaoRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const envio = envioRef.current
    return () => {
      // Sair da tela PAUSA — não cancela. O que subiu continua retomável.
      envio?.pausar()
    }
  }, [])

  const emAndamento =
    etapa.nome === 'enviando' || etapa.nome === 'preparando' || etapa.nome === 'validando'

  /* ---------------------------------------------------------------------- */

  const confirmarNoServidor = useCallback(async () => {
    const uploadId = uploadIdRef.current
    if (!uploadId) return

    setEtapa({ nome: 'validando' })

    const confirmado = await confirmarEnvioDeVideo({ uploadId })
    if (!confirmado.ok) {
      setEtapa({
        nome: 'erro',
        mensagem: confirmado.message,
        motivo: 'desconhecido',
        podeRetomar: false,
      })
      return
    }

    setEtapa({ nome: 'concluido' })
    setSubstituindo(false)
    onVideoEnviado?.()
  }, [onVideoEnviado])

  const enviar = useCallback(
    async (file: File, opcoes: { recomecar?: boolean } = {}) => {
      setArquivo(file)

      /* 1 — o que dá para saber sem tocar na rede ------------------------- */
      setEtapa({ nome: 'verificando' })

      const problema = validarDeclaracao({ nome: file.name, tamanho: file.size, mime: file.type })
      if (problema) {
        setEtapa({ nome: 'erro', mensagem: problema.mensagem, motivo: 'tipo', podeRetomar: false })
        return
      }

      try {
        const cabecalho = new Uint8Array(await file.slice(0, 32).arrayBuffer())
        if (!assinaturaConfere(cabecalho, file.type)) {
          setEtapa({
            nome: 'erro',
            mensagem:
              'Esse arquivo não parece ser um vídeo válido. Escolha um arquivo MP4 ou WebM.',
            motivo: 'tipo',
            podeRetomar: false,
          })
          return
        }
      } catch {
        // Não conseguir ler o cabeçalho não impede: o servidor confere de novo.
      }

      /* 2 — garantir aula e autorização ----------------------------------- */
      setEtapa({ nome: 'preparando' })

      let idDaAula = lessonId
      if (!idDaAula) {
        const criada = await garantirRascunhoDeAula({ moduleId, titulo: tituloDaAula })
        if (!criada.ok) {
          setEtapa({ nome: 'erro', mensagem: criada.message, motivo: 'desconhecido', podeRetomar: false })
          return
        }
        idDaAula = criada.id ?? null
        if (idDaAula) onAulaCriada?.(idDaAula)
      }

      if (!idDaAula) {
        setEtapa({
          nome: 'erro',
          mensagem: 'Não foi possível preparar a aula. Tente de novo.',
          motivo: 'desconhecido',
          podeRetomar: false,
        })
        return
      }

      const preparo = await prepararEnvioDeVideo({
        lessonId: idDaAula,
        nome: file.name,
        tamanho: file.size,
        mime: file.type,
        recomecar: opcoes.recomecar,
      })

      if (!preparo.ok) {
        setEtapa({ nome: 'erro', mensagem: preparo.message, motivo: 'conflito', podeRetomar: false })
        return
      }

      uploadIdRef.current = preparo.uploadId

      /* 3 — sessão da própria administradora ------------------------------ */
      const supabase = getBrowserClient()
      const { data: sessao } = await supabase.auth.getSession()
      const accessToken = sessao.session?.access_token

      if (!accessToken) {
        setEtapa({
          nome: 'erro',
          mensagem: 'Sua sessão expirou. Entre de novo e tente outra vez.',
          motivo: 'permissao',
          podeRetomar: false,
        })
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        setEtapa({
          nome: 'erro',
          mensagem: 'O serviço de arquivos não está configurado neste ambiente.',
          motivo: 'desconhecido',
          podeRetomar: false,
        })
        return
      }

      /* 4 — os bytes ------------------------------------------------------ */
      const envio = new EnvioResumivel(
        {
          arquivo: file,
          bucket: preparo.bucket,
          caminho: preparo.caminho,
          supabaseUrl,
          accessToken,
          urlDeRetomada: preparo.urlDeRetomada,
        },
        {
          onUrlDeRetomada: (url) => {
            // É esta linha no banco que transforma "fechei a aba" em "continue".
            void registrarUrlDeRetomada({ uploadId: preparo.uploadId, url })
          },

          onProgresso: (p) => {
            setEtapa({ nome: 'enviando', progresso: p })

            const agora = Date.now()
            if (agora - ultimaAnotacaoRef.current > INTERVALO_DE_ANOTACAO_MS) {
              ultimaAnotacaoRef.current = agora
              void registrarProgresso({
                uploadId: preparo.uploadId,
                bytesEnviados: p.enviados,
              })
            }
          },

          onSucesso: () => {
            void confirmarNoServidor()
          },

          onFalha: (motivo, mensagem) => {
            // Queda de rede não perde nada: o que subiu continua no servidor.
            if (motivo === 'rede') {
              setEtapa({ nome: 'pausado', progresso: null, porQueda: true })
              void registrarProgresso({
                uploadId: preparo.uploadId,
                bytesEnviados: 0,
                estado: ESTADO_ENVIO.PAUSADO,
              })
              return
            }
            setEtapa({
              nome: 'erro',
              mensagem,
              motivo,
              podeRetomar: motivo !== 'expirado' && motivo !== 'tipo',
            })
          },
        },
      )

      envioRef.current = envio
      await envio.iniciar()
    },
    [lessonId, moduleId, tituloDaAula, onAulaCriada, confirmarNoServidor],
  )

  /* ---------------------------------------------------------------------- */

  function pausar() {
    const p = etapa.nome === 'enviando' ? etapa.progresso : null
    envioRef.current?.pausar()
    setEtapa({ nome: 'pausado', progresso: p, porQueda: false })
    if (uploadIdRef.current && p) {
      void registrarProgresso({
        uploadId: uploadIdRef.current,
        bytesEnviados: p.enviados,
        estado: ESTADO_ENVIO.PAUSADO,
      })
    }
  }

  function retomar() {
    if (!envioRef.current) {
      if (arquivo) void enviar(arquivo)
      return
    }
    envioRef.current.retomar()
    setEtapa({ nome: 'enviando', progresso: etapa.nome === 'pausado' ? etapa.progresso ?? vazio() : vazio() })
  }

  async function cancelar() {
    await envioRef.current?.cancelar()
    envioRef.current = null
    if (uploadIdRef.current) {
      await cancelarEnvioDeVideo({ uploadId: uploadIdRef.current })
      uploadIdRef.current = null
    }
    setArquivo(null)
    setEtapa({ nome: 'ocioso' })
    if (inputRef.current) inputRef.current.value = ''
  }

  function tentarDeNovo() {
    if (!arquivo) return
    // Sessão expirada não dá para retomar: começa outra.
    const recomecar = etapa.nome === 'erro' && etapa.motivo === 'expirado'
    void enviar(arquivo, { recomecar })
  }

  function limpar() {
    envioRef.current = null
    uploadIdRef.current = null
    setArquivo(null)
    setEtapa({ nome: 'ocioso' })
    if (inputRef.current) inputRef.current.value = ''
  }

  /* ---------------------------------------------------------------------- */

  if (videoAtual && !substituindo && etapa.nome === 'ocioso') {
    return (
      <div className="envio envio--pronto">
        <div className="envio__resumo">
          <span className="envio__marca" aria-hidden="true"><IconeVideo /></span>
          <div className="envio__dados">
            <p className="envio__nome">{videoAtual.nome ?? 'Vídeo enviado'}</p>
            {formatarBytes(videoAtual.bytes) ? (
              <p className="envio__meta mono">{formatarBytes(videoAtual.bytes)}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="botao botao--secundario botao--pequeno"
            onClick={() => setSubstituindo(true)}
          >
            Trocar vídeo
          </button>
        </div>
        <p className="envio__nota">
          Vídeo pronto para esta aula. Trocar não publica nada — a aula continua como está até você
          publicar.
        </p>
      </div>
    )
  }

  return (
    <div className="envio">
      {etapa.nome === 'ocioso' || etapa.nome === 'verificando' ? (
        <>
          <label
            className="envio__area"
            data-arrastando={arrastando}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void enviar(file)
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_DE_VIDEO}
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void enviar(file)
              }}
            />
            <span className="envio__icone" aria-hidden="true"><IconeSubir /></span>
            <span className="envio__chamada">
              {etapa.nome === 'verificando'
                ? 'Verificando o arquivo…'
                : 'Arraste o vídeo da aula aqui'}
            </span>
            <span className="envio__ou">ou selecione do seu dispositivo</span>
            <span className="envio__formatos mono">
              MP4, MOV ou WebM · até {LIMITE_LEGIVEL}
            </span>
          </label>

          {substituindo ? (
            <button type="button" className="botao botao--texto" onClick={() => setSubstituindo(false)}>
              Manter o vídeo atual
            </button>
          ) : null}
        </>
      ) : null}

      {etapa.nome === 'preparando' ? (
        <p className="envio__estado" role="status">Preparando o envio…</p>
      ) : null}

      {etapa.nome === 'enviando' ? (
        <div className="envio__progresso">
          <div className="envio__resumo">
            <span className="envio__marca" aria-hidden="true"><IconeVideo /></span>
            <div className="envio__dados">
              <p className="envio__nome">{arquivo?.name}</p>
              <p className="envio__meta mono">
                {formatarBytes(etapa.progresso.enviados)} de {formatarBytes(etapa.progresso.total)}
                {formatarVelocidade(etapa.progresso.bytesPorSegundo)
                  ? ` · ${formatarVelocidade(etapa.progresso.bytesPorSegundo)}`
                  : ''}
                {formatarTempoRestante(etapa.progresso.segundosRestantes)
                  ? ` · falta ${formatarTempoRestante(etapa.progresso.segundosRestantes)}`
                  : ''}
              </p>
            </div>
          </div>

          <div
            className="envio__barra"
            role="progressbar"
            aria-valuenow={etapa.progresso.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do envio do vídeo"
          >
            <span className="envio__barra-feito" style={{ width: `${etapa.progresso.pct}%` }} />
          </div>

          <p className="envio__estado" role="status" aria-live="polite">
            Enviando vídeo — {etapa.progresso.pct}%
          </p>

          <div className="envio__acoes">
            <button type="button" className="botao botao--secundario botao--pequeno" onClick={pausar}>
              Pausar
            </button>
            <button type="button" className="botao botao--texto botao--pequeno" onClick={() => void cancelar()}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {etapa.nome === 'pausado' ? (
        <div className="envio__pausado">
          <p className="envio__estado" role="status">
            {etapa.porQueda ? 'A conexão foi interrompida. Seu progresso foi preservado.' : 'Envio pausado.'}
          </p>
          {etapa.progresso ? (
            <>
              <div
                className="envio__barra"
                role="progressbar"
                aria-valuenow={etapa.progresso.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso do envio do vídeo"
              >
                <span className="envio__barra-feito" style={{ width: `${etapa.progresso.pct}%` }} />
              </div>
              <p className="envio__meta mono">
                {formatarBytes(etapa.progresso.enviados)} de {formatarBytes(etapa.progresso.total)} enviados
              </p>
            </>
          ) : null}
          <div className="envio__acoes">
            <button type="button" className="botao botao--primario botao--pequeno" onClick={retomar}>
              Retomar upload
            </button>
            <button type="button" className="botao botao--texto botao--pequeno" onClick={() => void cancelar()}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {etapa.nome === 'validando' ? (
        <p className="envio__estado" role="status">Upload concluído. Validando o arquivo…</p>
      ) : null}

      {etapa.nome === 'concluido' ? (
        <div className="envio__ok">
          <p className="envio__estado" role="status">Vídeo pronto para esta aula.</p>
          <p className="envio__nota">
            O arquivo está guardado e ligado à aula. A aula continua em <strong>rascunho</strong> —
            nada foi publicado ainda.
          </p>
          <button type="button" className="botao botao--secundario botao--pequeno" onClick={limpar}>
            Enviar outro vídeo
          </button>
        </div>
      ) : null}

      {etapa.nome === 'erro' ? (
        <div className="envio__erro" role="alert">
          <p className="envio__erro-titulo">Não foi possível concluir o envio</p>
          <p className="envio__erro-texto">{etapa.mensagem}</p>
          <div className="envio__acoes">
            {etapa.podeRetomar && arquivo ? (
              <button type="button" className="botao botao--primario botao--pequeno" onClick={tentarDeNovo}>
                Tentar de novo
              </button>
            ) : null}
            <button type="button" className="botao botao--secundario botao--pequeno" onClick={limpar}>
              Escolher outro arquivo
            </button>
          </div>
        </div>
      ) : null}

      {emAndamento ? (
        <p className="envio__aviso-saida">
          Você pode sair desta página: o envio é retomável e o progresso fica guardado.
        </p>
      ) : null}
    </div>
  )
}

function vazio(): ProgressoDoEnvio {
  return { enviados: 0, total: 0, pct: 0, bytesPorSegundo: null, segundosRestantes: null }
}

/* -------------------------------------------------------------------------- */

function IconeSubir() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

function IconeVideo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="13" height="13" rx="2" />
      <path d="m15.5 10.5 6-3v9l-6-3z" />
    </svg>
  )
}
