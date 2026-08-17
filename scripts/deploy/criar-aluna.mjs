/**
 * CRIA UMA CONTA DE ALUNA
 *
 *   SENHA_NOVA='...' node scripts/deploy/criar-aluna.mjs email@da-aluna.com
 *
 * A senha vem do ambiente, nunca por argumento: argumento fica no histórico do
 * shell e aparece na lista de processos para qualquer usuário da máquina.
 *
 * O QUE ESTE SCRIPT NÃO FAZ, de propósito:
 *
 *   · não dá papel administrativo — a conta nasce e permanece `student`;
 *   · não cria matrícula;
 *   · não cria pedido nem pagamento;
 *   · não escolhe plano.
 *
 * O último ponto é o que mais importa. Dar acesso a um pacote sem compra
 * significaria inventar qual pacote a pessoa comprou — e depois ninguém
 * saberia dizer se aquele acesso veio de uma venda real ou de um script. O
 * script informa o que falta e para por aí.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const email = (process.argv[2] ?? '').trim().toLowerCase()
const senha = process.env.SENHA_NOVA
const nome = process.argv[3] ?? null

if (!email.includes('@')) {
  console.error("\n  Uso: SENHA_NOVA='...' node scripts/deploy/criar-aluna.mjs email@exemplo.com [Nome]\n")
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

console.log('\nCONTA DE ALUNA\n')

/* --- A conta -------------------------------------------------------------- */

const { data: existentes } = await db.auth.admin.listUsers()
let conta = existentes.users.find((u) => u.email?.toLowerCase() === email)

if (conta) {
  // Já existe: só garante a senha e o e-mail confirmado, sem mexer no papel.
  const { error } = await db.auth.admin.updateUserById(conta.id, {
    password: senha,
    email_confirm: true,
  })
  if (error) {
    console.error('  Não foi possível atualizar a conta:', error.message)
    process.exit(1)
  }
  console.log(`  ${email}: já existia, senha atualizada`)
} else {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: nome ? { display_name: nome } : undefined,
  })
  if (error || !data.user) {
    console.error('  Não foi possível criar a conta:', error?.message)
    process.exit(1)
  }
  conta = data.user
  console.log(`  ${email}: conta criada`)
}

/* --- O papel -------------------------------------------------------------- */

const { data: perfil } = await db
  .from('profiles')
  .select('id, role, email')
  .eq('id', conta.id)
  .maybeSingle()

if (!perfil) {
  console.error('  A conta existe no auth mas não tem perfil. Verifique o gatilho de criação.')
  process.exit(1)
}

/*
 * Se por qualquer motivo o perfil tiver vindo com papel elevado, ele volta
 * para `student`. Esta conta é de aluna e não pode ter permissão nenhuma de
 * painel.
 */
if (perfil.role !== 'student') {
  const { error } = await db.from('profiles').update({ role: 'student' }).eq('id', conta.id)
  if (error) {
    console.error('  Não foi possível ajustar o papel:', error.message)
    process.exit(1)
  }
  console.log(`  papel corrigido: ${perfil.role} → student`)
} else {
  console.log('  papel: student')
}

/* --- O que ela enxerga hoje ----------------------------------------------- */

const [{ data: matriculas }, { data: pedidos }] = await Promise.all([
  db.from('enrollments').select('id, status').eq('user_id', conta.id),
  db.from('orders').select('id, status').eq('user_id', conta.id),
])

console.log(`\n  Matrículas: ${matriculas?.length ?? 0}`)
console.log(`  Pedidos: ${pedidos?.length ?? 0}`)

if ((matriculas?.length ?? 0) === 0) {
  console.log(
    '\n  A conta foi criada como aluna, mas ainda precisa receber um dos planos:\n' +
      '  Iniciante / Profissional / Completo.\n\n' +
      '  Nenhum plano foi atribuído por este script: escolher um significaria\n' +
      '  inventar qual pacote ela comprou.\n',
  )
}

/* --- Quem é admin, afinal ------------------------------------------------- */

const { data: staff } = await db
  .from('profiles')
  .select('email, role')
  .in('role', ['admin', 'owner', 'instructor'])

console.log('  Contas com acesso ao painel:')
for (const p of staff ?? []) console.log(`    · ${p.email} — ${p.role}`)
console.log('')
