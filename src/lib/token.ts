import 'server-only'

import crypto from 'node:crypto'

/**
 * Token curto e assinado, usado para:
 *  - abrir o resultado do diagnóstico sem expor o id da resposta
 *  - autorizar a pré-visualização de rascunho do CMS
 *
 * Formato: base64url(payload).base64url(hmac)
 */

function secret(name: 'CMS_PREVIEW_SECRET' | 'DIAGNOSTIC_SECRET') {
  const value = process.env[name] ?? process.env.CMS_PREVIEW_SECRET
  if (!value) {
    throw new Error(`${name} ausente. Defina um segredo no .env.local.`)
  }
  return value
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 3600) {
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })
  const data = Buffer.from(body).toString('base64url')
  const mac = crypto.createHmac('sha256', secret('DIAGNOSTIC_SECRET')).update(data).digest('base64url')
  return `${data}.${mac}`
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const [data, mac] = token.split('.')
  if (!data || !mac) return null

  const expected = crypto
    .createHmac('sha256', secret('DIAGNOSTIC_SECRET'))
    .update(data)
    .digest('base64url')

  const a = Buffer.from(expected)
  const b = Buffer.from(mac)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null
    return payload as T
  } catch {
    return null
  }
}
