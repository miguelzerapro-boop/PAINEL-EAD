import 'server-only'

/**
 * Limite de requisições por IP, em memória.
 *
 * HONESTIDADE SOBRE O QUE ISTO É: um balde por processo. Em serverless, cada
 * instância tem o próprio balde, então o limite real é
 * `limite × número de instâncias`. Serve para conter repetição acidental
 * (duplo clique, script ingênuo, retry em loop) — **não** é proteção contra
 * ataque distribuído.
 *
 * Para valer como defesa de verdade, trocar por um contador compartilhado
 * (Upstash Redis, Vercel KV) ou pelo rate limit da borda. Está registrado como
 * pendência em docs/20-pendencias.md.
 */

type Balde = { contagem: number; reiniciaEm: number }

const BALDES = new Map<string, Balde>()
const LIMPEZA_A_CADA = 5 * 60 * 1000
let ultimaLimpeza = 0

export type ResultadoLimite =
  | { permitido: true; restante: number }
  | { permitido: false; esperarSegundos: number }

export function limitar(
  chave: string,
  { limite, janelaSegundos }: { limite: number; janelaSegundos: number },
): ResultadoLimite {
  const agora = Date.now()

  // Faxina preguiçosa: sem isto o Map cresce para sempre.
  if (agora - ultimaLimpeza > LIMPEZA_A_CADA) {
    for (const [k, b] of BALDES) if (b.reiniciaEm < agora) BALDES.delete(k)
    ultimaLimpeza = agora
  }

  const balde = BALDES.get(chave)

  if (!balde || balde.reiniciaEm < agora) {
    BALDES.set(chave, { contagem: 1, reiniciaEm: agora + janelaSegundos * 1000 })
    return { permitido: true, restante: limite - 1 }
  }

  if (balde.contagem >= limite) {
    return { permitido: false, esperarSegundos: Math.ceil((balde.reiniciaEm - agora) / 1000) }
  }

  balde.contagem += 1
  return { permitido: true, restante: limite - balde.contagem }
}

/**
 * IP de quem chamou. Atrás de proxy (Vercel, Cloudflare) vem em cabeçalho.
 * Se nenhum estiver presente, cai num balde comum — o que é conservador de
 * propósito: prefere limitar demais a não limitar nada.
 */
export function ipDaRequisicao(request: Request): string {
  const encaminhado = request.headers.get('x-forwarded-for')
  if (encaminhado) return encaminhado.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'desconhecido'
}
