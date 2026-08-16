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
const PREFIXO_ENVIADO = 'funil:enviado:'

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

    const corpo = JSON.stringify({
      nome,
      sessionId: sessaoAtual(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      device: tipoDeAparelho(window.innerWidth),
      utm: extrairUtm(new URLSearchParams(window.location.search)),
      props,
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
