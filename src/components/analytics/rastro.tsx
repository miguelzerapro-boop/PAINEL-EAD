'use client'

import { useEffect, useRef } from 'react'

import {
  UMA_VEZ_POR_SESSAO,
  extrairUtm,
  tipoDeAparelho,
  type NomeDeEvento,
  type PropsDoEvento,
} from '@/lib/analytics/eventos'

/**
 * REGISTRO DE EVENTO NO NAVEGADOR
 *
 * Três cuidados que decidem se a medição vale alguma coisa:
 *
 *   1. NÃO DUPLICAR. React em modo estrito monta o componente duas vezes em
 *      desenvolvimento, e um refresh reenviaria tudo. Os eventos de etapa
 *      ficam marcados no sessionStorage e só saem uma vez por sessão.
 *
 *   2. NÃO ATRASAR. `sendBeacon` entrega em segundo plano e sobrevive à
 *      navegação — clicar num plano e sair da página não perde o evento nem
 *      segura o clique.
 *
 *   3. NÃO QUEBRAR. Qualquer falha é engolida. Analytics fora do ar não pode
 *      impedir ninguém de comprar.
 */

const CHAVE_SESSAO = 'funil:sessao'
const CHAVE_UTM = 'funil:utm'
const CHAVE_ORIGEM = 'funil:origem'
const PREFIXO_ENVIADO = 'funil:enviado:'

/**
 * AS UTMs PRECISAM SOBREVIVER À JORNADA INTEIRA.
 *
 * O anúncio leva para /diagnostico?utm_source=... . Dali a pessoa passa pelo
 * resultado, pela landing comercial e pelo checkout — e em nenhuma dessas
 * páginas a query string original existe mais. Ler a URL do momento fazia o
 * `checkout_start` chegar sem origem nenhuma, e a campanha inteira parecia
 * não converter.
 *
 * Agora a primeira página da visita guarda as UTMs e a origem (`referrer`), e
 * todo evento seguinte carrega as mesmas. Só a PRIMEIRA gravação vale: se a
 * pessoa navegar depois para uma URL com outra UTM dentro da mesma sessão, a
 * origem que trouxe ela continua sendo a que conta.
 */
function guardarOrigemUmaVez() {
  try {
    if (sessionStorage.getItem(CHAVE_UTM) !== null) return

    const utm = extrairUtm(new URLSearchParams(window.location.search))
    sessionStorage.setItem(CHAVE_UTM, JSON.stringify(utm))
    sessionStorage.setItem(
      CHAVE_ORIGEM,
      JSON.stringify({
        referrer: document.referrer || null,
        entrada: window.location.pathname,
      }),
    )
  } catch {
    /* storage bloqueado: segue sem memória de origem */
  }
}

function origemDaSessao(): { utm: Record<string, string>; entrada: string | null } {
  try {
    guardarOrigemUmaVez()
    const utm = JSON.parse(sessionStorage.getItem(CHAVE_UTM) ?? '{}')
    const origem = JSON.parse(sessionStorage.getItem(CHAVE_ORIGEM) ?? '{}')
    return { utm, entrada: origem.entrada ?? null }
  } catch {
    return { utm: extrairUtm(new URLSearchParams(window.location.search)), entrada: null }
  }
}

/** Id de sessão anônimo, só para ligar as etapas de uma mesma visita. */
function sessaoAtual(): string {
  try {
    let id = sessionStorage.getItem(CHAVE_SESSAO)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(CHAVE_SESSAO, id)
    }
    return id
  } catch {
    return 'sem-sessao'
  }
}

function jaEnviado(nome: NomeDeEvento): boolean {
  try {
    return sessionStorage.getItem(PREFIXO_ENVIADO + nome) === '1'
  } catch {
    return false
  }
}

function marcarEnviado(nome: NomeDeEvento) {
  try {
    sessionStorage.setItem(PREFIXO_ENVIADO + nome, '1')
  } catch {
    /* modo anônimo com storage bloqueado: segue sem deduplicar */
  }
}

/**
 * Registra um evento. Seguro para chamar de qualquer lugar.
 *
 * Eventos de etapa (ver `UMA_VEZ_POR_SESSAO`) são ignorados se já saíram
 * nesta sessão. Ações repetíveis — escolher plano, ver um plano — passam
 * sempre.
 */
export function registrar(nome: NomeDeEvento, props: PropsDoEvento = {}) {
  if (typeof window === 'undefined') return

  try {
    if (UMA_VEZ_POR_SESSAO.includes(nome)) {
      if (jaEnviado(nome)) return
      marcarEnviado(nome)
    }

    // UTMs da PRIMEIRA página da visita, não da atual — ver
    // `guardarOrigemUmaVez` acima.
    const origem = origemDaSessao()

    const corpo = JSON.stringify({
      nome,
      sessionId: sessaoAtual(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      device: tipoDeAparelho(window.innerWidth),
      utm: origem.utm,
      props: { ...props, entrada: origem.entrada ?? undefined },
      leadId: props.leadId ?? undefined,
    })

    // sendBeacon sobrevive à navegação — o clique no plano leva embora a
    // página, e o evento chega mesmo assim.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/eventos', new Blob([corpo], { type: 'application/json' }))
      return
    }

    void fetch('/api/eventos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* medir nunca pode quebrar navegar */
  }
}

/**
 * GUARDA A ORIGEM ASSIM QUE A VISITA COMEÇA.
 *
 * Fica montado no layout raiz, em toda página. Sem ele, a captura só
 * acontecia no primeiro evento registrado — e a primeira página da jornada é
 * o quiz, que não registrava evento nenhum. Resultado medido: nenhum dos 7
 * eventos do funil carregava a UTM, e a campanha inteira parecia não
 * converter.
 *
 * Não envia nada. Só lê a URL e grava.
 */
export function CapturaDeOrigem() {
  useEffect(() => {
    guardarOrigemUmaVez()
  }, [])
  return null
}

/**
 * Marca a visualização de uma etapa. Monte no topo da página.
 *
 * O `useRef` evita o disparo duplo do modo estrito do React, e o
 * sessionStorage cobre o refresh.
 */
export function VisualizacaoDeEtapa({
  evento,
  props,
}: {
  evento: NomeDeEvento
  props?: PropsDoEvento
}) {
  const jaRodou = useRef(false)

  useEffect(() => {
    if (jaRodou.current) return
    jaRodou.current = true
    registrar(evento, props ?? {})
  }, [evento, props])

  return null
}
