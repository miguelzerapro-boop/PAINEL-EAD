'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { salvarCapaDaAula } from '@/app/admin/formacao/acoes'
import { MARCA } from '@/lib/marca'

/**
 * A CAPA DA AULA — imagem enviada ou um quadro do próprio vídeo.
 *
 * O CAMINHO DO QUADRO é o que evita trabalho para a responsável. Sem ele, ela
 * teria que abrir um editor de vídeo, exportar um print, salvar em algum lugar
 * e voltar para enviar o arquivo. Aqui ela arrasta a barra até o momento que
 * gosta e clica.
 *
 * COMO O QUADRO É CAPTURADO, sem baixar o vídeo de novo:
 *
 *   File escolhido no upload
 *     → URL.createObjectURL (o arquivo já está na máquina dela)
 *     → <video> posicionado no segundo escolhido
 *     → drawImage num <canvas>
 *     → canvas.toBlob('image/webp')
 *     → sobe só a imagem
 *
 * O vídeo NÃO trafega para gerar a capa. O que sobe é uma imagem de alguns
 * KB. Por isso o seletor só oferece o quadro enquanto o arquivo está na mão —
 * depois de recarregar a página, resta enviar uma imagem.
 *
 * SEM CAPA TAMBÉM É VÁLIDO: a aula salva do mesmo jeito e a área da aluna
 * mostra o selo da marca. Obrigar capa travaria o cadastro por um detalhe.
 */

const LARGURA_DA_CAPA = 1280

type Estado =
  | { nome: 'ocioso' }
  | { nome: 'escolhendo' }
  | { nome: 'enviando' }
  | { nome: 'erro'; mensagem: string }

export function SeletorDeCapa({
  lessonId,
  arquivoDeVideo,
  capaAtual,
}: {
  lessonId: string | null
  /** O vídeo escolhido nesta visita. Sem ele, só resta enviar imagem. */
  arquivoDeVideo: File | null
  capaAtual: string | null
}) {
  const [estado, setEstado] = useState<Estado>({ nome: 'ocioso' })
  const [previa, setPrevia] = useState<string | null>(capaAtual)
  const [urlDoVideo, setUrlDoVideo] = useState<string | null>(null)
  const [segundo, setSegundo] = useState(0)
  const [duracao, setDuracao] = useState(0)

  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  /*
   * `createObjectURL` aponta para o arquivo em disco, sem cópia na memória.
   * O `revoke` no fim é obrigatório: sem ele o navegador segura o arquivo
   * inteiro enquanto a aba viver.
   */
  useEffect(() => {
    if (!arquivoDeVideo) {
      setUrlDoVideo(null)
      return
    }
    const url = URL.createObjectURL(arquivoDeVideo)
    setUrlDoVideo(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivoDeVideo])

  async function enviar(blob: Blob) {
    if (!lessonId) {
      setEstado({
        nome: 'erro',
        mensagem: 'Escreva o título da aula antes de escolher a capa.',
      })
      return
    }

    setEstado({ nome: 'enviando' })

    const fd = new FormData()
    fd.set('lessonId', lessonId)
    fd.set('capa', blob, 'capa.webp')

    const r = await salvarCapaDaAula(fd)

    if (!r.ok) {
      setEstado({ nome: 'erro', mensagem: r.message })
      return
    }

    setPrevia(URL.createObjectURL(blob))
    setEstado({ nome: 'ocioso' })
  }

  /** Desenha o quadro atual do <video> e envia como imagem. */
  async function usarEsteMomento() {
    const v = video.current
    const c = canvas.current
    if (!v || !c) return

    const largura = LARGURA_DA_CAPA
    const altura = Math.round((v.videoHeight / v.videoWidth) * largura) || 720

    c.width = largura
    c.height = altura

    const ctx = c.getContext('2d')
    if (!ctx) {
      setEstado({ nome: 'erro', mensagem: 'Não foi possível preparar a imagem neste navegador.' })
      return
    }

    ctx.drawImage(v, 0, 0, largura, altura)

    const blob = await new Promise<Blob | null>((resolve) =>
      c.toBlob(resolve, 'image/webp', 0.85),
    )

    if (!blob) {
      setEstado({ nome: 'erro', mensagem: 'Não foi possível gerar a imagem deste momento.' })
      return
    }

    await enviar(blob)
  }

  async function aoEnviarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return

    if (!f.type.startsWith('image/')) {
      setEstado({ nome: 'erro', mensagem: 'Escolha uma imagem JPG, PNG ou WebP.' })
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      setEstado({ nome: 'erro', mensagem: 'A imagem precisa ter no máximo 8 MB.' })
      return
    }

    await enviar(f)
  }

  const enviando = estado.nome === 'enviando'

  return (
    <section className="capa-aula">
      <div className="capa-aula__topo">
        <h3 className="capa-aula__titulo">Capa da aula</h3>
        <p className="capa-aula__ajuda">
          Opcional. Sem capa, a aula mostra o selo da {MARCA.assinatura.principal}.
        </p>
      </div>

      <div className="capa-aula__grade">
        {/* ----------------------------------------------- a capa atual --- */}
        <div className="capa-aula__previa">
          {previa ? (
            <Image
              className="capa-aula__imagem"
              src={previa}
              alt="Capa escolhida para esta aula"
              width={640}
              height={360}
              unoptimized
            />
          ) : (
            <div className="capa-aula__vazia">
              <Image
                src={MARCA.logo.src}
                alt=""
                width={72}
                height={72}
                className="capa-aula__selo"
              />
              <span>Sem capa escolhida</span>
            </div>
          )}
        </div>

        {/* -------------------------------------------------- as opções --- */}
        <div className="capa-aula__opcoes">
          <label className="botao botao--secundario capa-aula__botao">
            {previa ? 'Trocar por outra imagem' : 'Escolher capa'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={aoEnviarImagem}
              disabled={enviando}
              hidden
            />
          </label>

          {urlDoVideo ? (
            <button
              type="button"
              className="botao botao--secundario capa-aula__botao"
              onClick={() => setEstado({ nome: 'escolhendo' })}
              disabled={enviando}
            >
              Escolher um momento do vídeo
            </button>
          ) : (
            <p className="capa-aula__nota">
              Para tirar a capa do próprio vídeo, escolha o arquivo do vídeo acima nesta
              mesma visita.
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------- o seletor de momento ------ */}
      {estado.nome === 'escolhendo' && urlDoVideo ? (
        <div className="capa-aula__seletor">
          <video
            ref={video}
            src={urlDoVideo}
            className="capa-aula__video"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
          />

          <label className="capa-aula__linha">
            <span className="campo__rotulo">
              Momento: {formatarTempo(segundo)} de {formatarTempo(duracao)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(duracao, 0.1)}
              step={0.1}
              value={segundo}
              onChange={(e) => {
                const s = Number(e.target.value)
                setSegundo(s)
                // Mover o <video> é o que atualiza a imagem na tela: a pessoa
                // vê exatamente o quadro que vai virar capa.
                if (video.current) video.current.currentTime = s
              }}
            />
          </label>

          <div className="capa-aula__acoes">
            <button
              type="button"
              className="botao botao--cta"
              onClick={usarEsteMomento}
              disabled={enviando}
            >
              {enviando ? 'Gerando a capa…' : 'Usar este momento como capa'}
            </button>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => setEstado({ nome: 'ocioso' })}
              disabled={enviando}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {/* O canvas só existe para desenhar o quadro; nunca aparece. */}
      <canvas ref={canvas} hidden />

      {estado.nome === 'enviando' ? (
        <p className="capa-aula__estado" role="status">
          Guardando a capa…
        </p>
      ) : null}

      {estado.nome === 'erro' ? (
        <p className="campo__erro" role="alert">
          {estado.mensagem}
        </p>
      ) : null}
    </section>
  )
}

function formatarTempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00'
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
