/**
 * DEFINE A SENHA DE UMA CONTA
 *
 *   node scripts/deploy/definir-senha.mjs email@da-pessoa.com
 *
 * A senha NÃO vai por argumento e NÃO fica neste arquivo. O script lê da
 * variável de ambiente `SENHA_NOVA`, e por um motivo prático: argumento de
 * linha de comando fica no histórico do shell e aparece na lista de processos
 * para qualquer usuário da máquina.
 *
 *   SENHA_NOVA='...' node scripts/deploy/definir-senha.mjs email@exemplo.com
 *
 * O script também marca o e-mail como confirmado. Sem isso, a conta criada
 * antes da troca para senha continuaria presa esperando um link de e-mail que
 * nunca mais será usado.
 *
 * Nada é impresso além do e-mail e de "ok".
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const email = process.argv[2]
const senha = process.env.SENHA_NOVA

if (!email || !email.includes('@')) {
  console.error("\n  Uso: SENHA_NOVA='...' node scripts/deploy/definir-senha.mjs email@exemplo.com\n")
  process.exit(1)
}

if (!senha || senha.length < 8) {
  console.error('\n  Defina SENHA_NOVA no ambiente, com pelo menos 8 caracteres.\n')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data, error } = await db.auth.admin.listUsers()
if (error) {
  console.error('  Não foi possível listar contas:', error.message)
  process.exit(1)
}

const conta = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!conta) {
  console.error(`  Não existe conta com o e-mail ${email}.`)
  process.exit(1)
}

const { error: erro } = await db.auth.admin.updateUserById(conta.id, {
  password: senha,
  email_confirm: true,
})

if (erro) {
  console.error('  Não foi possível definir a senha:', erro.message)
  process.exit(1)
}

console.log(`\n  Senha definida para ${email}. E-mail confirmado.\n`)
