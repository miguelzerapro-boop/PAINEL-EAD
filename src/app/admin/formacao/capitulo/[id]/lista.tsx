'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { formatarBytes } from '@/lib/video/regras'
import {
  arquivarOuExcluirAula,
  moverAulaDeCapitulo,
  publicarAula,
  reordenarAulas,
} from '../../acoes'

/**
 * LISTA DE AULAS DO CAPÍTULO
 *
 * Reordenação por arrastar, com teclado como caminho equivalente — arrastar
 * não funciona com leitor de tela nem em toque impreciso, e a responsável
 * pode estar no celular. Os botões ↑ ↓ fazem exatamente a mesma coisa.
 *
 * A ordem só vai ao banco quando ela confirma. Assim um arrasto errado não
 * vira gravação.
 */

type Aula = {
  id: string
  titulo: string
  posicao: number
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  temVideo: boolean
  videoNome: string | null
  videoBytes: number | null
  temHistorico: boolean
}

type CapituloOpcao = { id: string; nome: string; numero: number }

export function ListaDeAulas({
  moduleId,
  aulas,
  capitulos,
}: {
  moduleId: string
  aulas: Aula[]
  capitulos: CapituloOpcao[]
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()

  const [ordem, setOrdem] = useState(aulas)
  const [arrastado, setArrastado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const mudou = ordem.some((a, i) => a.id !== aulas[i]?.id)

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    const atual = ordem[indice]
    const vizinho = ordem[destino]
    if (!atual || !vizinho) return
    const nova = [...ordem]
    nova[indice] = vizinho
    nova[destino] = atual
    setOrdem(nova)
  }

  function soltarSobre(alvoId: string) {
    if (!arrastado || arrastado === alvoId) return
    const de = ordem.findIndex((a) => a.id === arrastado)
    const para = ordem.findIndex((a) => a.id === alvoId)
    if (de < 0 || para < 0) return
    const nova = [...ordem]
    const [item] = nova.splice(de, 1)
    if (!item) return
    nova.splice(para, 0, item)
    setOrdem(nova)
  }

  function salvarOrdem() {
    setAviso(null)
    iniciarTransicao(async () => {
      const r = await reordenarAulas(moduleId, ordem.map((a) => a.id))
      setAviso(
        r.ok
          ? { tom: 'ok', texto: 'Nova ordem salva.' }
          : { tom: 'erro', texto: r.message },
      )
      if (r.ok) router.refresh()
    })
  }

  function alternarPublicacao(aula: Aula) {
    setAviso(null)
    iniciarTransicao(async () => {
      const r = await publicarAula(aula.id, aula.status !== 'published')
      setAviso(
        r.ok
          ? {
              tom: 'ok',
              texto: aula.status === 'published' ? 'Aula despublicada.' : 'Aula publicada.',
            }
          : { tom: 'erro', texto: r.message },
      )
      if (r.ok) router.refresh()
    })
  }

  function remover(aula: Aula) {
    setAviso(null)
    setConfirmando(null)
    iniciarTransicao(async () => {
      const r = await arquivarOuExcluirAula(aula.id)
      if (!r.ok) {
        setAviso({ tom: 'erro', texto: r.message })
        return
      }
      setAviso({
        tom: 'ok',
        texto: r.arquivada
          ? 'Aula arquivada. O histórico das alunas foi preservado.'
          : 'Aula excluída.',
      })
      router.refresh()
    })
  }

  function mudarDeCapitulo(aula: Aula, destino: string) {
    if (destino === moduleId) return
    setAviso(null)
    iniciarTransicao(async () => {
      const r = await moverAulaDeCapitulo(aula.id, destino)
      setAviso(
        r.ok
          ? { tom: 'ok', texto: 'Aula movida para outro capítulo.' }
          : { tom: 'erro', texto: r.message },
      )
      if (r.ok) router.refresh()
    })
  }

  if (ordem.length === 0) {
    return (
      <div className="vazio">
        <p className="vazio__titulo">Nenhuma aula neste capítulo</p>
        <p className="vazio__texto">
          Enquanto não houver aula cadastrada, este capítulo não mostra conteúdo nenhum para as
          alunas — nem uma aula vazia, nem duração zerada.
        </p>
        <Link className="botao botao--primario" href={`/admin/formacao/aula/nova?capitulo=${moduleId}`}>
          + Adicionar aula
        </Link>
      </div>
    )
  }

  return (
    <div className="aulas-admin">
      {aviso ? (
        <p
          className="form-aula__aviso"
          data-tom={aviso.tom}
          role={aviso.tom === 'erro' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      ) : null}

      <ol className="aulas-admin__lista">
        {ordem.map((aula, indice) => (
          <li
            key={aula.id}
            className="aula-linha"
            data-status={aula.status}
            draggable={!pendente}
            onDragStart={() => setArrastado(aula.id)}
            onDragEnd={() => setArrastado(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              soltarSobre(aula.id)
              setArrastado(null)
            }}
          >
            <span className="aula-linha__pegar" aria-hidden="true">
              ≡
            </span>

            <div className="aula-linha__ordem">
              <button
                type="button"
                className="aula-linha__seta"
                onClick={() => mover(indice, -1)}
                disabled={indice === 0 || pendente}
                aria-label={`Mover “${aula.titulo}” para cima`}
              >
                ↑
              </button>
              <span className="mono">{String(indice + 1).padStart(2, '0')}</span>
              <button
                type="button"
                className="aula-linha__seta"
                onClick={() => mover(indice, 1)}
                disabled={indice === ordem.length - 1 || pendente}
                aria-label={`Mover “${aula.titulo}” para baixo`}
              >
                ↓
              </button>
            </div>

            <div className="aula-linha__corpo">
              <Link className="aula-linha__titulo" href={`/admin/formacao/aula/${aula.id}`}>
                {aula.titulo}
              </Link>
              <p className="aula-linha__meta">
                <span className="etiqueta" data-tone={aula.status === 'published' ? 'ok' : 'rascunho'}>
                  {rotulo(aula.status)}
                </span>
                {aula.temVideo ? (
                  <span className="mono">
                    {aula.videoNome ?? 'vídeo'}
                    {formatarBytes(aula.videoBytes) ? ` · ${formatarBytes(aula.videoBytes)}` : ''}
                  </span>
                ) : (
                  <span className="aula-linha__sem-video">sem vídeo</span>
                )}
                {aula.temHistorico ? <span className="mono">com histórico de alunas</span> : null}
              </p>
            </div>

            <div className="aula-linha__acoes">
              <Link className="botao botao--texto botao--pequeno" href={`/admin/formacao/aula/${aula.id}`}>
                Editar
              </Link>

              <button
                type="button"
                className="botao botao--texto botao--pequeno"
                onClick={() => alternarPublicacao(aula)}
                disabled={pendente || (!aula.temVideo && aula.status !== 'published')}
                title={
                  !aula.temVideo && aula.status !== 'published'
                    ? 'Envie o vídeo antes de publicar'
                    : undefined
                }
              >
                {aula.status === 'published' ? 'Despublicar' : 'Publicar'}
              </button>

              {capitulos.length > 1 ? (
                <select
                  className="aula-linha__mover"
                  value={moduleId}
                  onChange={(e) => mudarDeCapitulo(aula, e.target.value)}
                  disabled={pendente}
                  aria-label={`Mover “${aula.titulo}” para outro capítulo`}
                >
                  {capitulos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id === moduleId ? 'Mover para…' : `${String(c.numero).padStart(2, '0')} — ${c.nome}`}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                className="botao botao--texto botao--pequeno botao--perigo"
                onClick={() => setConfirmando(aula.id)}
                disabled={pendente}
              >
                {aula.temHistorico ? 'Arquivar' : 'Excluir'}
              </button>
            </div>

            {confirmando === aula.id ? (
              <div className="aula-linha__confirmar" role="alertdialog" aria-label="Confirmar remoção">
                {aula.temHistorico ? (
                  <p>
                    Alunas já têm progresso em <strong>{aula.titulo}</strong>. Excluir apagaria esse
                    histórico junto, então esta aula será <strong>arquivada</strong>: some da área da
                    aluna e o registro fica guardado. O vídeo não é apagado.
                  </p>
                ) : (
                  <p>
                    Excluir <strong>{aula.titulo}</strong> em definitivo? Nenhuma aluna tem progresso
                    nela. O vídeo já enviado continua guardado no servidor.
                  </p>
                )}
                <div className="aula-linha__confirmar-acoes">
                  <button
                    type="button"
                    className="botao botao--primario botao--pequeno"
                    onClick={() => remover(aula)}
                    disabled={pendente}
                  >
                    {aula.temHistorico ? 'Arquivar aula' : 'Excluir aula'}
                  </button>
                  <button
                    type="button"
                    className="botao botao--texto botao--pequeno"
                    onClick={() => setConfirmando(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="aulas-admin__rodape">
        {mudou ? (
          <>
            <button
              type="button"
              className="botao botao--primario botao--pequeno"
              onClick={salvarOrdem}
              disabled={pendente}
            >
              {pendente ? 'Salvando ordem…' : 'Salvar nova ordem'}
            </button>
            <button
              type="button"
              className="botao botao--texto botao--pequeno"
              onClick={() => setOrdem(aulas)}
              disabled={pendente}
            >
              Desfazer
            </button>
          </>
        ) : null}

        <Link
          className="botao botao--secundario botao--pequeno"
          href={`/admin/formacao/aula/nova?capitulo=${moduleId}`}
        >
          + Adicionar aula
        </Link>
      </div>
    </div>
  )
}

function rotulo(status: string) {
  const mapa: Record<string, string> = {
    draft: 'rascunho',
    scheduled: 'agendada',
    published: 'publicada',
    archived: 'arquivada',
  }
  return mapa[status] ?? status
}
