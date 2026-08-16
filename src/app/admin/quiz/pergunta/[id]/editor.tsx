'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { salvarPergunta } from '../../acoes'

/**
 * CONSTRUTOR DE PERGUNTA — pergunta e respostas na mesma tela.
 *
 * Duas decisões que valem explicação:
 *
 *   · A PONTUAÇÃO APARECE EM PORTUGUÊS. O banco guarda `weights`, um objeto
 *     `{"chave": peso}` que o motor soma para escolher o resultado. Pedir
 *     esse JSON na tela transformaria a criação de uma pergunta em tarefa de
 *     programador. Aqui a mesma informação é "esta resposta indica mais:" e
 *     "quanto pesa" — o formulário monta o objeto na hora de salvar.
 *
 *   · O PREVIEW É A MESMA COISA QUE A ALUNA VÊ, e atualiza enquanto se
 *     digita. Sem ele a responsável só descobriria o resultado depois de
 *     salvar, sair do painel e refazer o quiz.
 */

export type ResultadoDoQuiz = { chave: string; nome: string }

export type RespostaEditavel = {
  id: string
  label: string
  outcome: string
  peso: number
}

const PESOS = [
  { valor: 1, rotulo: 'Um pouco' },
  { valor: 2, rotulo: 'Bastante' },
  { valor: 3, rotulo: 'Muito' },
]

export function EditorDePergunta({
  quizId,
  perguntaId,
  promptInicial,
  ajudaInicial,
  posicao,
  respostasIniciais,
  resultados,
}: {
  quizId: string
  perguntaId: string | null
  promptInicial: string
  ajudaInicial: string
  posicao: number
  respostasIniciais: RespostaEditavel[]
  resultados: ResultadoDoQuiz[]
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()

  const [prompt, setPrompt] = useState(promptInicial)
  const [ajuda, setAjuda] = useState(ajudaInicial)
  const [respostas, setRespostas] = useState<RespostaEditavel[]>(
    respostasIniciais.length > 0
      ? respostasIniciais
      : // Duas caixas em branco de saída: o mínimo que uma pergunta precisa.
        [novaResposta(), novaResposta()],
  )
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function alterar(indice: number, mudanca: Partial<RespostaEditavel>) {
    setRespostas((atual) => atual.map((r, i) => (i === indice ? { ...r, ...mudanca } : r)))
  }

  function remover(indice: number) {
    setRespostas((atual) => atual.filter((_, i) => i !== indice))
  }

  /** Sobe ou desce uma resposta. A ordem da tela é a ordem que a aluna vê. */
  function mover(indice: number, direcao: -1 | 1) {
    setRespostas((atual) => {
      const destino = indice + direcao
      if (destino < 0 || destino >= atual.length) return atual
      const copia = [...atual]
      const [item] = copia.splice(indice, 1)
      copia.splice(destino, 0, item!)
      return copia
    })
  }

  function salvar() {
    setErro(null)
    setOk(null)

    const preenchidas = respostas.filter((r) => r.label.trim().length > 0)
    if (preenchidas.length < 2) {
      setErro('Adicione pelo menos duas respostas.')
      return
    }
    if (prompt.trim().length < 3) {
      setErro('Escreva a pergunta.')
      return
    }

    iniciarTransicao(async () => {
      const fd = new FormData()
      if (perguntaId) fd.set('id', perguntaId)
      fd.set('quizId', quizId)
      fd.set('prompt', prompt)
      fd.set('helpText', ajuda)
      fd.set('posicao', String(posicao))
      fd.set(
        'respostas',
        JSON.stringify(
          preenchidas.map((r) => ({
            id: r.id.startsWith('nova-') ? '' : r.id,
            label: r.label,
            outcome: r.outcome || undefined,
            peso: r.peso,
          })),
        ),
      )

      const r = await salvarPergunta(fd)
      if (!r.ok) {
        setErro(r.message)
        return
      }

      setOk('Pergunta salva.')
      router.push('/admin/quiz')
      router.refresh()
    })
  }

  return (
    <div className="editor-pergunta">
      {/* ------------------------------------------------- o formulário --- */}
      <div className="editor-pergunta__campos">
        <label className="campo">
          <span className="campo__rotulo">Pergunta</span>
          <input
            className="entrada"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Qual é o seu momento profissional hoje?"
            maxLength={500}
            disabled={pendente}
          />
        </label>

        <label className="campo">
          <span className="campo__rotulo">
            Texto de ajuda <span className="campo__dica">(opcional)</span>
          </span>
          <input
            className="entrada"
            value={ajuda}
            onChange={(e) => setAjuda(e.target.value)}
            placeholder="Aparece embaixo da pergunta, em letra menor."
            maxLength={500}
            disabled={pendente}
          />
        </label>

        <h2 className="editor-pergunta__subtitulo">Respostas</h2>
        <p className="campo__dica">
          A aluna escolhe uma. A ordem aqui é a ordem que ela vê.
        </p>

        <ol className="respostas" role="list">
          {respostas.map((r, i) => (
            <li className="resposta" key={r.id}>
              <div className="resposta__linha">
                <span className="resposta__numero mono">{i + 1}</span>

                <input
                  className="entrada"
                  value={r.label}
                  onChange={(e) => alterar(i, { label: e.target.value })}
                  placeholder={`Resposta ${i + 1}`}
                  maxLength={300}
                  disabled={pendente}
                  aria-label={`Texto da resposta ${i + 1}`}
                />

                <div className="resposta__botoes">
                  <button
                    type="button"
                    className="resposta__acao"
                    onClick={() => mover(i, -1)}
                    disabled={pendente || i === 0}
                    aria-label={`Mover a resposta ${i + 1} para cima`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="resposta__acao"
                    onClick={() => mover(i, 1)}
                    disabled={pendente || i === respostas.length - 1}
                    aria-label={`Mover a resposta ${i + 1} para baixo`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="resposta__acao resposta__acao--remover"
                    onClick={() => remover(i)}
                    disabled={pendente || respostas.length <= 2}
                    aria-label={`Excluir a resposta ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/*
                A tradução da pontuação. Isto é o `weights` do banco, dito em
                português: qual resultado esta resposta empurra, e com que
                força.
              */}
              <div className="resposta__diagnostico">
                <label className="campo campo--linha">
                  <span className="campo__rotulo">Esta resposta indica mais</span>
                  <select
                    className="entrada"
                    value={r.outcome}
                    onChange={(e) => alterar(i, { outcome: e.target.value })}
                    disabled={pendente}
                  >
                    <option value="">Não influencia o resultado</option>
                    {resultados.map((o) => (
                      <option key={o.chave} value={o.chave}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </label>

                {r.outcome ? (
                  <label className="campo campo--linha">
                    <span className="campo__rotulo">Quanto pesa</span>
                    <select
                      className="entrada"
                      value={r.peso}
                      onChange={(e) => alterar(i, { peso: Number(e.target.value) })}
                      disabled={pendente}
                    >
                      {PESOS.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => setRespostas((a) => [...a, novaResposta()])}
          disabled={pendente || respostas.length >= 10}
        >
          + Adicionar resposta
        </button>

        {erro ? (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        ) : null}
        {ok ? <p className="campo__ok" role="status">{ok}</p> : null}

        <div className="editor-pergunta__acoes">
          <button type="button" className="botao botao--cta" onClick={salvar} disabled={pendente}>
            {pendente ? 'Salvando…' : 'Salvar pergunta'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------- o preview ----- */}
      <aside className="editor-pergunta__previa">
        <p className="eyebrow">Como a aluna verá</p>

        <div className="previa-quiz">
          <p className="previa-quiz__pergunta">
            {prompt.trim() || 'Sua pergunta aparece aqui'}
          </p>
          {ajuda.trim() ? <p className="previa-quiz__ajuda">{ajuda}</p> : null}

          <ul className="previa-quiz__opcoes" role="list">
            {respostas.map((r, i) => (
              <li className="previa-quiz__opcao" key={r.id}>
                <span className="previa-quiz__marca" aria-hidden="true" />
                <span>{r.label.trim() || `Resposta ${i + 1}`}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="campo__dica" style={{ marginBlockStart: 'var(--space-4)' }}>
          Escolha única: a aluna marca uma resposta e avança.
        </p>
      </aside>
    </div>
  )
}

let contador = 0
function novaResposta(): RespostaEditavel {
  contador += 1
  // Prefixo "nova-" para o servidor saber que é inserção, não atualização.
  return { id: `nova-${contador}`, label: '', outcome: '', peso: 2 }
}
