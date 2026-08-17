'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { EnvioDeVideo, type VideoAtual } from '@/components/admin/envio-de-video'
import { Etapa } from '@/components/admin/etapa'
import { SeletorDeCapa } from '@/components/admin/seletor-de-capa'
import { publicarAula, salvarAula } from '../../acoes'

/**
 * FORMULÁRIO DA AULA
 *
 * A ordem dos campos é a ordem do trabalho real: escolher o capítulo, dar um
 * nome, descrever, subir o vídeo, decidir onde entra e só então publicar.
 *
 * Duas decisões de comportamento que valem explicação:
 *
 *   · SALVAR NÃO PUBLICA. "Salvar rascunho" e "Publicar" são dois botões
 *     distintos, e o rascunho é o caminho padrão. Subir vídeo nunca publica
 *     nada por conta própria.
 *
 *   · O envio do vídeo pode começar antes de a aula existir. Nesse caso o
 *     rascunho é criado silenciosamente para que o arquivo tenha onde se
 *     apoiar — e, com isso, nenhum arquivo enviado fica sem dono.
 */

type CapituloOpcao = { id: string; nome: string; numero: number }

type AulaExistente = {
  id: string
  titulo: string
  descricao: string
  posicao: number
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  gratuita: boolean
  releaseMode: string
  releaseAt: string | null
  releaseDays: number | null
  video: VideoAtual
  /** URL pública da capa já escolhida, se houver. */
  capa: string | null
}

type Aviso = { tom: 'ok' | 'erro' | 'info'; texto: string } | null

export function FormularioDeAula({
  capitulos,
  moduleIdInicial,
  posicaoSugerida,
  aula,
}: {
  capitulos: CapituloOpcao[]
  moduleIdInicial: string
  posicaoSugerida: number
  aula: AulaExistente | null
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()

  const [lessonId, setLessonId] = useState<string | null>(aula?.id ?? null)
  const [moduleId, setModuleId] = useState(moduleIdInicial)
  const [titulo, setTitulo] = useState(aula?.titulo ?? '')
  const [descricao, setDescricao] = useState(aula?.descricao ?? '')
  const [posicao, setPosicao] = useState(String(posicaoSugerida))
  const [gratuita, setGratuita] = useState(aula?.gratuita ?? false)
  const [releaseMode, setReleaseMode] = useState(aula?.releaseMode ?? 'immediate')
  const [releaseAt, setReleaseAt] = useState(aula?.releaseAt?.slice(0, 16) ?? '')
  const [releaseDays, setReleaseDays] = useState(
    aula?.releaseDays !== null && aula?.releaseDays !== undefined ? String(aula.releaseDays) : '',
  )
  const [video, setVideo] = useState<VideoAtual>(aula?.video ?? null)
  const [status, setStatus] = useState(aula?.status ?? 'draft')
  const [aviso, setAviso] = useState<Aviso>(null)

  /*
   * O arquivo de vídeo desta visita. Só existe enquanto a página não
   * recarrega — e é justamente por isso que a capa por quadro é oferecida
   * agora: com o arquivo em mãos, o quadro sai sem baixar nada do servidor.
   */
  const [arquivoDeVideo, setArquivoDeVideo] = useState<File | null>(null)

  const tituloValido = titulo.trim().length >= 2

  function montarFormulario(statusDesejado: 'draft' | 'published') {
    const fd = new FormData()
    if (lessonId) fd.set('id', lessonId)
    fd.set('module_id', moduleId)
    fd.set('title', titulo)
    fd.set('description', descricao)
    fd.set('position', posicao || String(posicaoSugerida))
    if (gratuita) fd.set('is_free', 'true')
    fd.set('status', statusDesejado)
    fd.set('release_mode', releaseMode)
    if (releaseMode === 'on_date') fd.set('release_at', releaseAt)
    if (releaseMode === 'days_after_enrollment') fd.set('release_days', releaseDays)
    return fd
  }

  function salvar(statusDesejado: 'draft' | 'published') {
    setAviso(null)

    if (!tituloValido) {
      setAviso({ tom: 'erro', texto: 'Dê um título à aula antes de salvar.' })
      return
    }

    if (statusDesejado === 'published' && !video) {
      setAviso({
        tom: 'erro',
        texto: 'Esta aula ainda não tem vídeo. Envie o vídeo antes de publicar.',
      })
      return
    }

    iniciarTransicao(async () => {
      setAviso({ tom: 'info', texto: 'Salvando aula…' })

      const resultado = await salvarAula(null, montarFormulario(statusDesejado))

      if (!resultado.ok) {
        setAviso({ tom: 'erro', texto: resultado.message })
        return
      }

      if (resultado.id) setLessonId(resultado.id)
      setStatus(statusDesejado)
      setAviso({
        tom: 'ok',
        texto: statusDesejado === 'published' ? 'Aula publicada.' : 'Aula salva como rascunho.',
      })
      router.refresh()
    })
  }

  function alternarPublicacao() {
    if (!lessonId) return
    setAviso(null)
    iniciarTransicao(async () => {
      const publicar = status !== 'published'
      const resultado = await publicarAula(lessonId, publicar)
      if (!resultado.ok) {
        setAviso({ tom: 'erro', texto: resultado.message })
        return
      }
      setStatus(publicar ? 'published' : 'draft')
      setAviso({ tom: 'ok', texto: publicar ? 'Aula publicada.' : 'Aula voltou para rascunho.' })
      router.refresh()
    })
  }

  return (
    <div className="form-aula">
      <div className="form-aula__estado">
        <span className="etiqueta" data-tone={status === 'published' ? 'ok' : 'rascunho'}>
          {status === 'published' ? 'publicada' : status === 'archived' ? 'arquivada' : 'rascunho'}
        </span>
        {video ? <span className="etiqueta" data-tone="ok">com vídeo</span> : (
          <span className="etiqueta" data-tone="rascunho">sem vídeo</span>
        )}
      </div>

      <Etapa
        numero={1}
        titulo="Informações da aula"
        descricao="Em qual capítulo ela entra e como se chama."
      >
      <label className="campo">
        <span className="campo__rotulo">Capítulo</span>
        <select
          className="entrada"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          disabled={pendente}
        >
          {capitulos.map((c) => (
            <option key={c.id} value={c.id}>
              {String(c.numero).padStart(2, '0')} — {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span className="campo__rotulo">Título da aula</span>
        <input
          className="entrada"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          disabled={pendente}
          autoComplete="off"
        />
        <span className="campo__dica">
          O nome que a aluna vê na lista do capítulo.
        </span>
      </label>

      <label className="campo">
        <span className="campo__rotulo">
          Descrição <span className="campo__dica">(opcional)</span>
        </span>
        <textarea
          className="entrada"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={4000}
          disabled={pendente}
        />
      </label>

      </Etapa>

      <Etapa
        numero={2}
        titulo="Vídeo da aula"
        descricao="O arquivo vai direto do seu computador para o servidor de vídeo. Pode fechar a aba: o envio retoma de onde parou."
      >
      <div className="campo">
        <EnvioDeVideo
          lessonId={lessonId}
          moduleId={moduleId}
          tituloDaAula={titulo}
          videoAtual={video}
          onAulaCriada={(id) => setLessonId(id)}
          onVideoEnviado={() => {
            setVideo({ nome: null, bytes: null })
            setAviso({
              tom: 'ok',
              texto: 'Vídeo enviado e ligado à aula. A aula continua em rascunho.',
            })
            router.refresh()
          }}
          /*
           * O arquivo escolhido sobe para cá para o seletor de capa poder
           * tirar um quadro dele. Os bytes não saem do navegador: quem os lê
           * é o <video> local.
           */
          aoEscolherArquivo={setArquivoDeVideo}
        />
        {!tituloValido ? (
          <span className="campo__dica">
            Informe o título antes de enviar — é ele que identifica a aula enquanto o vídeo sobe.
          </span>
        ) : null}
      </div>

      </Etapa>

      <Etapa
        numero={3}
        titulo="Capa da aula"
        descricao="Opcional. É a imagem que identifica a aula na lista da aluna."
      >
      <SeletorDeCapa
        lessonId={lessonId}
        arquivoDeVideo={arquivoDeVideo}
        capaAtual={aula?.capa ?? null}
      />

      </Etapa>

      <Etapa
        numero={4}
        titulo="Publicação"
        descricao="Em rascunho, só você enxerga. Publicada, a aula aparece para quem tem acesso a este capítulo."
      >
      <div className="form-aula__linha">
        <label className="campo">
          <span className="campo__rotulo">Ordem no capítulo</span>
          <input
            className="entrada"
            type="number"
            min={1}
            value={posicao}
            onChange={(e) => setPosicao(e.target.value)}
            disabled={pendente}
          />
          <span className="campo__dica">Menor número aparece primeiro.</span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">Liberação</span>
          <select
            className="entrada"
            value={releaseMode}
            onChange={(e) => setReleaseMode(e.target.value)}
            disabled={pendente}
          >
            <option value="immediate">Imediata</option>
            <option value="after_previous_lesson">Após concluir a aula anterior</option>
            <option value="after_previous_module">Após concluir o capítulo anterior</option>
            <option value="on_date">Em uma data</option>
            <option value="days_after_enrollment">N dias após a matrícula</option>
            <option value="manual">Manual</option>
          </select>
        </label>
      </div>

      {releaseMode === 'on_date' ? (
        <label className="campo">
          <span className="campo__rotulo">Data de liberação</span>
          <input
            className="entrada"
            type="datetime-local"
            value={releaseAt}
            onChange={(e) => setReleaseAt(e.target.value)}
            disabled={pendente}
          />
        </label>
      ) : null}

      {releaseMode === 'days_after_enrollment' ? (
        <label className="campo">
          <span className="campo__rotulo">Dias após a matrícula</span>
          <input
            className="entrada"
            type="number"
            min={0}
            value={releaseDays}
            onChange={(e) => setReleaseDays(e.target.value)}
            disabled={pendente}
          />
        </label>
      ) : null}

      <label className="consentimento">
        <input
          type="checkbox"
          checked={gratuita}
          onChange={(e) => setGratuita(e.target.checked)}
          disabled={pendente}
        />
        <span>
          Aula gratuita (degustação) — visível para quem ainda não comprou, desde que a formação
          esteja publicada.
        </span>
      </label>

      </Etapa>

      {aviso ? (
        <p
          className="form-aula__aviso"
          data-tom={aviso.tom}
          role={aviso.tom === 'erro' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      ) : null}

      <div className="form-aula__acoes">
        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => salvar('draft')}
          disabled={pendente || !tituloValido}
        >
          {pendente ? 'Salvando…' : 'Salvar rascunho'}
        </button>

        {lessonId && status === 'published' ? (
          <button
            type="button"
            className="botao botao--texto"
            onClick={alternarPublicacao}
            disabled={pendente}
          >
            Despublicar
          </button>
        ) : (
          <button
            type="button"
            className="botao botao--primario"
            onClick={() => salvar('published')}
            disabled={pendente || !tituloValido || !video}
            title={!video ? 'Envie o vídeo antes de publicar' : undefined}
          >
            Publicar aula
          </button>
        )}
      </div>

      <p className="form-aula__nota">
        Enviar o vídeo não publica a aula. Enquanto estiver em rascunho, ela não aparece para
        nenhuma aluna.
      </p>
    </div>
  )
}
