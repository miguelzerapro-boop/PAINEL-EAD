import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Preparação comum dos testes.
 *
 * Regra: nenhum teste desta suíte toca a rede. O que precisar de Supabase real
 * é responsabilidade de `npm run storage:validate`, que roda separado e exige
 * credenciais de verdade.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// jsdom não implementa estes dois, e o componente de envio os usa.
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:teste')
  globalThis.URL.revokeObjectURL = vi.fn()
}
