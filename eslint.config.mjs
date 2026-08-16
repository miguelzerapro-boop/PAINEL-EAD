import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FlatCompat } from '@eslint/eslintrc'
import tseslint from 'typescript-eslint'

/**
 * ESLint — configuração explícita e versionada.
 *
 * Antes desta etapa, `next lint` abria um prompt interativo pedindo
 * "Strict / Base / Cancel". Num terminal não interativo isso trava para
 * sempre; em CI, quebra. Fica resolvido aqui: a configuração está no
 * repositório e `npm run lint` roda sozinho.
 *
 * Usa o formato flat (ESLint 9) com `FlatCompat` para aproveitar as regras do
 * `eslint-config-next`, que ainda são publicadas no formato antigo.
 *
 * PRINCÍPIO: nenhuma regra é desligada para esconder problema. As poucas
 * exceções abaixo têm motivo escrito e escopo estreito.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

export default tseslint.config(
  {
    // Artefatos e dependências: nada aqui é código nosso.
    ignores: [
      '.next/**',
      'node_modules/**',
      '.homolog/**',
      'screenshots/**',
      'docs/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
      'supabase/**',
    ],
  },

  ...compat.extends('next/core-web-vitals'),

  // Regras de tipo só para o código da aplicação.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      /*
       * Variável não usada vira erro, MENOS quando prefixada com `_`. O padrão
       * `_estado` já é usado pelas Server Actions, cuja assinatura exige o
       * primeiro parâmetro mesmo sem lê-lo.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],

      /*
       * `any` é aviso, não erro. As tipagens geradas do Supabase obrigam a
       * alguns escapes pontuais; transformar em erro empurraria para
       * `eslint-disable`, que esconde mais do que resolve.
       */
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Scripts de homologação e utilitários: Node puro, sem TypeScript.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
