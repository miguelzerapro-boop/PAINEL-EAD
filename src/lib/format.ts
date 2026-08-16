/**
 * Formatadores pt-BR.
 *
 * Regra do projeto: informacao ausente NAO vira zero. Duracao nula devolve
 * null e a interface simplesmente nao mostra o campo, em vez de exibir
 * "0 min" como se fosse um dado real.
 */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const longDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatPrice(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null
  return brl.format(cents / 100)
}

export function formatInstallments(cents: number | null | undefined, max: number | null | undefined) {
  if (cents === null || cents === undefined || !max || max < 2) return null
  return { count: max, value: brl.format(cents / 100 / max) }
}

/** Duracao de aula. Devolve null quando ainda nao foi definida. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Carga horaria do curso. Devolve null quando ainda nao foi definida. */
export function formatWorkload(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = minutes / 60
  const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10
  return `${rounded.toLocaleString('pt-BR')} horas`
}

export function formatDate(value: string | Date | null | undefined, style: 'long' | 'short' = 'long') {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  return style === 'long' ? longDate.format(date) : shortDate.format(date)
}

export function formatProgress(pct: number | null | undefined): string {
  const value = Number(pct ?? 0)
  return `${Math.round(value)}%`
}

/** Telefone brasileiro para exibicao. */
export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}
