'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

export type QuizPergunta = {
  id: string
  prompt: string
  helpText: string | null
  type: 'single' | 'multiple' | 'scale' | 'text'
  required: boolean
  minSelections: number
  maxSelections: number | null
  opcoes: Array<{ id: string; label: string; value: string; helpText: string | null }>
}

export type ColetaFinal = {
  email: boolean
  cidade: boolean
  estado: boolean
  apenasPrimeiroNome: boolean
}

const UF = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

const CHAVE_RASCUNHO = 'diagnostico:rascunho'

/** Fases da tela. Não é regra de negócio — é só onde a visitante está. */
type Fase = 'inicio' | 'retomada' | 'respondendo'

/** Estado real do rascunho. Não existe timer falso aqui. */
type Salvamento = 'ocioso' | 'salvando' | 'salvo' | 'indisponivel'

/**
 * Quiz: uma pergunta por tela, apresentada como uma etapa do mostruário.
 *
 * O trilho no topo é o progresso: palheta concluída, atual e futura têm forma,
 * etiqueta e texto próprios — não se distinguem só por cor.
 *
 * Nada de regra mudou nesta revisão. Continuam idênticos: o limite de seleção,
 * a validação de avanço, a chave e o formato do rascunho, o envio, a leitura de
 * UTM e o consentimento desmarcado por padrão. O que mudou é a apresentação e
 * os estados que antes não existiam na tela (início, retomada, salvamento).
 *
 * Sobre o salvamento: o rascunho é gravado no localStorage deste navegador, de
 * forma síncrona. Por isso o rótulo diz "salva neste navegador" — afirmar
 * "salvo" sem dizer onde daria a entender que já está no servidor, e não está.
 * As respostas só vão para o servidor no envio final.
 */
export function QuizForm({
  quizSlug,
  perguntas,
  consentText,
  coleta,
  introTitulo = null,
  introTexto = null,
}: {
  quizSlug: string
  perguntas: QuizPergunta[]
  consentText: string | null
  coleta: ColetaFinal
  /** Vem do CMS. Quando preenchido, substitui o texto padrão da abertura. */
  introTitulo?: string | null
  introTexto?: string | null
}) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('inicio')
  const [passo, setPasso] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string | string[]>>({})
  const [lead, setLead] = useState({ name: '', email: '', phone: '', city: '', state: '' })
  const [consent, setConsent] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvamento, setSalvamento] = useState<Salvamento>('ocioso')
  const [rascunho, setRascunho] = useState<{ passo: number; respostas: Record<string, string | string[]> } | null>(null)
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false)
  const [tentouAvancar, setTentouAvancar] = useState(false)

  const tituloRef = useRef<HTMLHeadingElement>(null)
  const primeiraRenderizacao = useRef(true)

  const totalPerguntas = perguntas.length
  const totalPassos = totalPerguntas + 1 // + tela de contato
  const naTelaDeContato = passo === totalPerguntas
  const pergunta = perguntas[passo]

  const sessionId = useMemo(
    () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
    [],
  )

  // --- Retomada -------------------------------------------------------------
  // Mesma chave, mesmo formato, mesma regra de antes. A diferença é que agora a
  // pessoa ESCOLHE retomar, em vez de o rascunho ser aplicado sem aviso.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_RASCUNHO)
      if (!salvo) return
      const dados = JSON.parse(salvo)
      if (dados.quizSlug !== quizSlug || !dados.respostas) return
      if (Object.keys(dados.respostas).length === 0) return
      setRascunho({ passo: Math.min(dados.passo ?? 0, totalPerguntas), respostas: dados.respostas })
      setFase('retomada')
    } catch {
      // rascunho corrompido: começa do zero, sem incomodar a pessoa
    }
  }, [quizSlug, totalPerguntas])

  useEffect(() => {
    if (Object.keys(respostas).length === 0) return
    setSalvamento('salvando')
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ quizSlug, passo, respostas }))
      setSalvamento('salvo')
    } catch {
      // localStorage indisponível (navegação anônima com restrição): segue sem salvar
      setSalvamento('indisponivel')
    }
  }, [quizSlug, passo, respostas])

  // Foco no título a cada troca de pergunta, para quem navega por teclado ou
  // leitor de tela saber que a etapa mudou.
  useEffect(() => {
    if (fase !== 'respondendo') return
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false
      return
    }
    tituloRef.current?.focus()
  }, [passo, fase])

  // --- Validação (idêntica à anterior) --------------------------------------
  const selecionadas = pergunta
    ? Array.isArray(respostas[pergunta.id])
      ? (respostas[pergunta.id] as string[])
      : respostas[pergunta.id]
        ? [respostas[pergunta.id] as string]
        : []
    : []

  const telefoneValido = lead.phone.replace(/\D/g, '').length >= 10
  const emailValido = !lead.email || /\S+@\S+\.\S+/.test(lead.email)

  const podeAvancar = naTelaDeContato
    ? lead.name.trim().length >= 2 &&
      telefoneValido &&
      emailValido &&
      (!coleta.cidade || lead.city.trim().length >= 2) &&
      (!coleta.estado || lead.state.length === 2) &&
      consent
    : !pergunta?.required || selecionadas.length >= (pergunta?.minSelections ?? 1)

  const limiteAtingido =
    pergunta?.type === 'multiple' &&
    pergunta.maxSelections !== null &&
    selecionadas.length >= pergunta.maxSelections

  function responder(perguntaId: string, valor: string, multipla: boolean) {
    setTentouAvancar(false)
    setRespostas((atual) => {
      if (!multipla) return { ...atual, [perguntaId]: valor }

      const anteriores = Array.isArray(atual[perguntaId]) ? (atual[perguntaId] as string[]) : []
      const jaMarcada = anteriores.includes(valor)

      // Desmarcar sempre pode. Marcar respeita o limite configurado.
      if (!jaMarcada && pergunta?.maxSelections && anteriores.length >= pergunta.maxSelections) {
        return atual
      }

      return {
        ...atual,
        [perguntaId]: jaMarcada ? anteriores.filter((v) => v !== valor) : [...anteriores, valor],
      }
    })
  }

  function avancar() {
    // O botão usa aria-disabled em vez de disabled, para poder explicar o
    // bloqueio quando clicado. Logo a guarda contra envio duplo é aqui.
    if (enviando) return
    if (!podeAvancar) {
      setTentouAvancar(true)
      return
    }
    setTentouAvancar(false)
    if (naTelaDeContato) void enviar()
    else setPasso((p) => p + 1)
  }

  function recomecar() {
    try {
      localStorage.removeItem(CHAVE_RASCUNHO)
    } catch {
      /* segue */
    }
    setRespostas({})
    setPasso(0)
    setRascunho(null)
    setConfirmandoReinicio(false)
    setSalvamento('ocioso')
    setFase('respondendo')
  }

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizSlug,
          sessionId,
          answers: respostas,
          lead,
          consent,
          utm: lerUtm(),
        }),
      })

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}))
        throw new Error(corpo.message ?? 'Não foi possível enviar suas respostas.')
      }

      const { token } = await resposta.json()
      try {
        localStorage.removeItem(CHAVE_RASCUNHO)
      } catch {
        /* segue */
      }
      router.push(`/diagnostico/resultado?d=${token}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar suas respostas.')
      setEnviando(false)
    }
  }

  // ==========================================================================
  // ABERTURA
  // ==========================================================================
  if (fase === 'inicio') {
    return (
      <section className="page quiz-abertura">
        <div className="quiz-abertura__texto">
          <p className="capa__chapeu">Diagnóstico profissional</p>
          <h1 className="quiz-abertura__titulo">
            {introTitulo ?? 'Vamos entender o seu momento?'}
          </h1>
          <p className="quiz-abertura__apoio">
            {introTexto ??
              'Responda algumas perguntas rápidas sobre sua experiência, seus objetivos e o que você procura hoje.'}
          </p>

          <ul className="quiz-abertura__notas">
            <li>Leva poucos minutos.</li>
            <li>Não existe resposta certa ou errada.</li>
            <li>Você pode continuar de onde parou.</li>
          </ul>

          <button
            type="button"
            className="botao botao--primario botao--grande"
            onClick={() => setFase('respondendo')}
          >
            Começar meu diagnóstico
          </button>
        </div>

        <div className="quiz-abertura__mostruario" aria-hidden="true">
          <div className="trilho mostruario">
            <div className="trilho__itens">
              <div className="palheta mostruario__item mostruario__item--atual">
                <span className="palheta__codigo mono">01 / {totalPerguntas}</span>
                <span className="palheta__titulo">Seu momento</span>
                <span className="palheta__meta">É isto que o diagnóstico identifica.</span>
              </div>
              <div className="palheta mostruario__item" data-state="locked">
                <span className="palheta__codigo mono">02</span>
                <span className="palheta__titulo">Próximo passo</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ==========================================================================
  // RETOMADA
  // ==========================================================================
  if (fase === 'retomada' && rascunho) {
    const respondidas = Object.keys(rascunho.respostas).length
    return (
      <section className="page quiz-retomada">
        <p className="capa__chapeu">Diagnóstico em andamento</p>
        <h1 className="quiz-abertura__titulo">Você já começou seu diagnóstico.</h1>
        <p className="quiz-abertura__apoio">
          Encontramos suas respostas salvas. Você pode continuar de onde parou ou começar
          novamente.
        </p>

        <p className="quiz-retomada__resumo mono">
          {respondidas} {respondidas === 1 ? 'resposta guardada' : 'respostas guardadas'} · parou na
          etapa {Math.min(rascunho.passo + 1, totalPassos)} de {totalPassos}
        </p>

        {confirmandoReinicio ? (
          <div className="quiz-retomada__confirmar" role="alertdialog" aria-label="Confirmar recomeço">
            <p>
              Recomeçar apaga as {respondidas}{' '}
              {respondidas === 1 ? 'resposta guardada' : 'respostas guardadas'} neste navegador. Não
              dá para desfazer.
            </p>
            <div className="quiz-retomada__acoes">
              <button type="button" className="botao botao--discreto" onClick={() => setConfirmandoReinicio(false)}>
                Manter minhas respostas
              </button>
              <button type="button" className="botao botao--perigo" onClick={recomecar}>
                Apagar e recomeçar
              </button>
            </div>
          </div>
        ) : (
          <div className="quiz-retomada__acoes">
            <button
              type="button"
              className="botao botao--primario botao--grande"
              onClick={() => {
                setRespostas(rascunho.respostas)
                setPasso(rascunho.passo)
                setFase('respondendo')
              }}
            >
              Continuar de onde parei
            </button>
            <button type="button" className="botao botao--discreto" onClick={() => setConfirmandoReinicio(true)}>
              Recomeçar diagnóstico
            </button>
          </div>
        )}
      </section>
    )
  }

  // ==========================================================================
  // PERGUNTAS E CONTATO
  // ==========================================================================
  const rotuloEtapa = naTelaDeContato ? 'Seus dados' : `Pergunta ${passo + 1} de ${totalPerguntas}`
  const bloqueioMotivo = naTelaDeContato
    ? 'Preencha os campos obrigatórios e marque o consentimento para continuar.'
    : pergunta?.type === 'multiple' && (pergunta?.minSelections ?? 1) > 1
      ? `Escolha pelo menos ${pergunta.minSelections} opções para continuar.`
      : 'Escolha uma opção para continuar.'

  return (
    <div className="quiz">
      {/* ---------------------------------------------------- trilho de progresso */}
      <div className="page quiz__topo">
        <div className="quiz__linha">
          <p className="quiz__etapa mono">{rotuloEtapa}</p>
          <EstadoSalvamento estado={salvamento} />
        </div>

        <div
          className="quiz-trilho"
          role="img"
          aria-label={`Progresso: etapa ${passo + 1} de ${totalPassos}`}
        >
          {Array.from({ length: totalPassos }).map((_, i) => {
            const estado = i < passo ? 'concluida' : i === passo ? 'atual' : 'futura'
            return (
              <span key={i} className="quiz-trilho__etapa" data-estado={estado}>
                <span className="quiz-trilho__gancho" />
                <span className="quiz-trilho__amostra">
                  {estado === 'concluida' ? (
                    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                      <path d="M2.5 6.4 L4.8 8.7 L9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------- corpo */}
      <div className="quiz__corpo">
        <div className="page">
          <article className="quiz-etapa" key={passo}>
            {naTelaDeContato ? (
              <>
                <h1 className="quiz__enunciado" tabIndex={-1} ref={tituloRef}>
                  Seu diagnóstico está quase pronto.
                </h1>
                <p className="quiz__apoio">
                  Preencha seus dados para salvar o resultado e continuar o atendimento.
                </p>

                <div className="formulario">
                  <label className="campo">
                    <span className="campo__rotulo">
                      {coleta.apenasPrimeiroNome ? 'Seu primeiro nome' : 'Seu nome'}
                    </span>
                    <input
                      className="entrada"
                      autoComplete="given-name"
                      value={lead.name}
                      onChange={(e) => setLead({ ...lead, name: e.target.value })}
                    />
                  </label>

                  <label className="campo">
                    <span className="campo__rotulo">WhatsApp</span>
                    <input
                      className="entrada"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      value={lead.phone}
                      aria-invalid={lead.phone.length > 0 && !telefoneValido ? 'true' : undefined}
                      aria-describedby={lead.phone.length > 0 && !telefoneValido ? 'erro-telefone' : undefined}
                      onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                    />
                    {lead.phone.length > 0 && !telefoneValido ? (
                      <span className="campo__erro" id="erro-telefone">
                        Informe DDD e número.
                      </span>
                    ) : null}
                  </label>

                  {(coleta.cidade || coleta.estado) && (
                    <div className="campo-duplo" data-com-uf={coleta.estado ? '1' : undefined}>
                      {coleta.cidade ? (
                        <label className="campo">
                          <span className="campo__rotulo">Cidade</span>
                          <input
                            className="entrada"
                            autoComplete="address-level2"
                            value={lead.city}
                            onChange={(e) => setLead({ ...lead, city: e.target.value })}
                          />
                        </label>
                      ) : null}
                      {coleta.estado ? (
                        <label className="campo">
                          <span className="campo__rotulo">Estado</span>
                          <select
                            className="entrada"
                            value={lead.state}
                            onChange={(e) => setLead({ ...lead, state: e.target.value })}
                          >
                            <option value="">—</option>
                            {UF.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  )}

                  {coleta.email ? (
                    <label className="campo">
                      <span className="campo__rotulo">
                        E-mail <span className="campo__dica">(opcional)</span>
                      </span>
                      <input
                        className="entrada"
                        type="email"
                        autoComplete="email"
                        value={lead.email}
                        aria-invalid={!emailValido ? 'true' : undefined}
                        aria-describedby={!emailValido ? 'erro-email' : undefined}
                        onChange={(e) => setLead({ ...lead, email: e.target.value })}
                      />
                      {!emailValido ? (
                        <span className="campo__erro" id="erro-email">
                          E-mail inválido.
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {/* Nunca pré-marcado: o consentimento precisa ser um ato. */}
                  <label className="consentimento" data-pendente={tentouAvancar && !consent ? '1' : undefined}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      {consentText ??
                        'Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade.'}
                    </span>
                  </label>

                  {erro ? (
                    <div className="quiz-erro" role="alert">
                      <p className="quiz-erro__titulo">Não foi possível enviar suas respostas.</p>
                      <p>{erro}</p>
                      <p className="quiz-erro__conforto">
                        Suas respostas continuam guardadas neste navegador. Você pode tentar de novo.
                      </p>
                      <button type="button" className="botao botao--discreto" onClick={() => void enviar()}>
                        Tentar novamente
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : pergunta ? (
              <>
                <div className="quiz-pergunta">
                  <h1 className="quiz__enunciado" tabIndex={-1} ref={tituloRef}>
                    {pergunta.prompt}
                  </h1>
                  {pergunta.helpText ? <p className="quiz__apoio">{pergunta.helpText}</p> : null}
                </div>

                {pergunta.type === 'multiple' ? (
                  <div className="quiz-limite">
                    <p className="quiz-limite__regra">
                      {pergunta.maxSelections
                        ? `Escolha até ${pergunta.maxSelections} ${pergunta.maxSelections === 1 ? 'opção' : 'opções'}.`
                        : 'Você pode escolher mais de uma opção.'}
                    </p>
                    {pergunta.maxSelections ? (
                      <p className="quiz-limite__contagem mono" aria-live="polite">
                        {selecionadas.length} de {pergunta.maxSelections} selecionadas
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className="quiz__opcoes"
                  role={pergunta.type === 'multiple' ? 'group' : 'radiogroup'}
                  aria-label={pergunta.prompt}
                >
                  {pergunta.opcoes.map((opcao) => {
                    const marcada = selecionadas.includes(opcao.value)
                    const bloqueada = !marcada && limiteAtingido

                    return (
                      <button
                        key={opcao.id}
                        type="button"
                        className="opcao"
                        data-multipla={pergunta.type === 'multiple' ? '1' : undefined}
                        role={pergunta.type === 'multiple' ? 'checkbox' : 'radio'}
                        aria-checked={marcada}
                        aria-disabled={bloqueada || undefined}
                        disabled={bloqueada}
                        onClick={() => responder(pergunta.id, opcao.value, pergunta.type === 'multiple')}
                      >
                        <span className="opcao__marca" aria-hidden="true" />
                        <span className="opcao__texto">
                          {opcao.label}
                          {opcao.helpText ? (
                            <span className="opcao__ajuda">{opcao.helpText}</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {limiteAtingido ? (
                  <p className="quiz-limite__aviso" role="status">
                    Você atingiu o limite de {pergunta.maxSelections}. Para trocar, desmarque uma
                    opção primeiro.
                  </p>
                ) : null}
              </>
            ) : null}

            {tentouAvancar && !podeAvancar ? (
              <p className="quiz-bloqueio" role="alert">
                {bloqueioMotivo}
              </p>
            ) : null}
          </article>
        </div>
      </div>

      {/* ------------------------------------------------------------- navegação */}
      <div className="quiz__rodape">
        <div className="page quiz__rodape-interno">
          <button
            type="button"
            className="botao botao--discreto"
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
            disabled={passo === 0 || enviando}
          >
            Voltar
          </button>

          {/*
            aria-disabled em vez de disabled para o clique poder explicar o
            bloqueio. Mas leitor de tela anuncia "indisponível" e a pessoa não
            vai clicar para descobrir o motivo — por isso o motivo fica sempre
            ligado por aria-describedby, não só depois da tentativa.
          */}
          <button
            type="button"
            className="botao botao--primario"
            data-inativo={!podeAvancar || undefined}
            aria-disabled={!podeAvancar || enviando}
            aria-describedby={!podeAvancar ? 'motivo-bloqueio' : undefined}
            onClick={avancar}
          >
            {enviando ? 'Enviando…' : naTelaDeContato ? 'Ver meu diagnóstico' : 'Continuar'}
          </button>

          {!podeAvancar ? (
            <span id="motivo-bloqueio" className="visually-hidden">
              {bloqueioMotivo}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Estado do rascunho.
 *
 * "salva neste navegador" e não "salvo": o rascunho vive no localStorage. Dizer
 * só "salvo" faria acreditar que já está no servidor — e não está até o envio.
 */
function EstadoSalvamento({ estado }: { estado: Salvamento }) {
  if (estado === 'ocioso') return null

  const texto =
    estado === 'salvando'
      ? 'Salvando resposta…'
      : estado === 'salvo'
        ? 'Resposta salva neste navegador'
        : 'Não foi possível salvar neste navegador'

  return (
    <p className="quiz-salvamento" data-estado={estado} role="status">
      <span className="quiz-salvamento__marca" aria-hidden="true" />
      {texto}
    </p>
  )
}

/** UTM da URL atual — usada para atribuir o lead à origem. */
function lerUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const utm: Record<string, string> = {}
  for (const chave of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const valor = params.get(chave)
    if (valor) utm[chave] = valor
  }
  if (document.referrer) utm.referrer = document.referrer
  return utm
}
