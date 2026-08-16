/**
 * Tipos das ações do painel.
 *
 * Vivem fora de `acoes.ts` porque um arquivo `'use server'` só pode exportar
 * funções assíncronas — exportar um tipo de lá quebra o build.
 */
export type ResultadoAcao = { ok: true; id?: string } | { ok: false; message: string }
