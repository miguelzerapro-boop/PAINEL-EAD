/**
 * Relações embutidas do PostgREST.
 *
 * Sem os tipos gerados (`npm run db:types`), o cliente infere toda relação
 * embutida como array — mesmo as de cardinalidade 1. Estes dois helpers
 * concentram a conversão num lugar só, em vez de espalhar `as unknown as`
 * por todas as páginas.
 *
 * Quando os tipos gerados existirem, o `unknown` daqui pode ser trocado pelo
 * tipo da tabela e os helpers continuam funcionando.
 */

/** Relação 1:1 ou N:1 — devolve o único registro, ou null. */
export function um<T>(valor: unknown): T | null {
  if (Array.isArray(valor)) return (valor[0] as T) ?? null
  return (valor as T) ?? null
}

/** Relação 1:N — devolve sempre um array. */
export function varios<T>(valor: unknown): T[] {
  if (Array.isArray(valor)) return valor as T[]
  if (valor === null || valor === undefined) return []
  return [valor as T]
}
