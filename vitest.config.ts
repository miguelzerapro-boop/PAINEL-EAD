import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Suíte de unidade e de componente.
 *
 * NÃO substitui os scripts de `scripts/homolog/`. Os dois convivem e cobrem
 * coisas diferentes:
 *
 *   homolog (`npm run validar`)  PostgreSQL de verdade — RLS, policies,
 *                                constraints, lesson_is_released
 *   vitest  (`npm test`)         a lógica de aplicação e os componentes, sem
 *                                banco e sem rede
 *
 * O que exige Supabase real não está em nenhum dos dois: está em
 * `npm run storage:validate`, que se recusa a rodar com credencial de exemplo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // O ambiente de rede é sempre simulado aqui; nada sai da máquina.
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
