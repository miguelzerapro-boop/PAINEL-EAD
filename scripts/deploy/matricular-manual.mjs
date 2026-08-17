/**
 * MATRÍCULA MANUAL, PARA DEMONSTRAÇÃO
 *
 *   node scripts/deploy/matricular-manual.mjs email@da-aluna.com completo
 *
 * Usa o mecanismo que já existe: `enrollments.source = 'manual'`, um dos
 * valores que a migration 05 aceita. NÃO cria pedido, pagamento, evento de
 * conversão nem qualquer registro financeiro — e é justamente `source` que
 * permite distinguir depois o que veio de venda do que foi concedido à mão.
 *
 * O QUE VOCÊ PRECISA SABER SOBRE OS DIREITOS
 *
 * A regra de acesso (migration 28) trata matrícula manual assim:
 *
 *     -- Matrícula que não nasceu de compra não é limitada por pacote:
 *     -- quem concedeu manualmente sabia o que estava concedendo.
 *     if v_origem is not null and v_origem <> 'order' then return true;
 *
 * Ou seja: com `source='manual'` a pessoa enxerga TODOS os capítulos do
 * curso — o resultado bate com o plano Completo, mas o caminho é o desvio da
 * regra, não a matriz de `offer_module_access`.
 *
 * Este script não muda essa regra. Ele mede e informa o que a pessoa passa a
 * enxergar, para a diferença ficar registrada em vez de descoberta depois.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const email = (process.argv[2] ?? '').trim().toLowerCase()
const slugDoPlano = (process.argv[3] ?? 'completo').trim()

if (!email.includes('@')) {
  console.error('\n  Uso: node scripts/deploy/matricular-manual.mjs email@exemplo.com [plano]\n')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

console.log('\nMATRÍCULA MANUAL\n')

/* --- Quem ----------------------------------------------------------------- */

const { data: perfil } = await db
  .from('profiles')
  .select('id, email, role')
  .ilike('email', email)
  .maybeSingle()

if (!perfil) {
  console.error(`  Não existe conta com o e-mail ${email}.`)
  process.exit(1)
}

// Trava: este script é para aluna. Não é caminho para conceder painel.
if (perfil.role !== 'student') {
  console.error(`  ${email} tem papel "${perfil.role}". Este script só matricula alunas.`)
  process.exit(1)
}

console.log(`  ${email} — papel ${perfil.role}`)

/* --- Onde ----------------------------------------------------------------- */

const { data: curso } = await db
  .from('courses')
  .select('id, name')
  .eq('slug', 'formacao')
  .maybeSingle()

if (!curso) {
  console.error('  A formação não foi encontrada.')
  process.exit(1)
}

const { data: oferta } = await db
  .from('offers')
  .select('id, name, slug')
  .eq('slug', slugDoPlano)
  .maybeSingle()

if (!oferta) {
  console.error(`  Não existe plano com o slug "${slugDoPlano}".`)
  process.exit(1)
}

/* --- A matrícula ----------------------------------------------------------- */

const { data: jaTem } = await db
  .from('enrollments')
  .select('id, source, status')
  .eq('user_id', perfil.id)
  .eq('course_id', curso.id)
  .maybeSingle()

if (jaTem) {
  console.log(`  Já existia matrícula (origem: ${jaTem.source}, situação: ${jaTem.status})`)
} else {
  const { error } = await db.from('enrollments').insert({
    user_id: perfil.id,
    course_id: curso.id,
    status: 'active',
    // O valor oficial da arquitetura. `order_id` fica nulo porque não houve
    // pedido — é assim que se distingue depois venda de concessão.
    source: 'manual',
  })

  if (error) {
    console.error('  Não foi possível matricular:', error.message)
    process.exit(1)
  }
  console.log(`  Matrícula criada em "${curso.name}" — origem manual, sem pedido`)
}

/* --- O que ela passa a enxergar, medido ------------------------------------ */

const { data: modulos } = await db
  .from('modules')
  .select('id, name, position')
  .eq('course_id', curso.id)
  .order('position')

let abertos = 0
for (const m of modulos ?? []) {
  const { data } = await db.rpc('user_has_module_access', {
    p_user_id: perfil.id,
    p_module_id: m.id,
  })
  if (data === true) abertos += 1
}

const { data: doPlano } = await db
  .from('offer_module_access')
  .select('module_id')
  .eq('offer_id', oferta.id)

console.log(`\n  Capítulos que a regra libera para ela: ${abertos} de ${modulos?.length ?? 0}`)
console.log(`  Capítulos que o plano ${oferta.name} inclui: ${doPlano?.length ?? 0}`)

if (abertos !== (doPlano?.length ?? 0)) {
  console.log(
    '\n  Os dois números diferem porque matrícula manual NÃO passa pela matriz\n' +
      '  de pacotes: a regra da migration 28 libera o curso inteiro para quem\n' +
      '  foi matriculado à mão. Ver o comentário no topo deste arquivo.',
  )
}

/* --- Nada financeiro foi criado ------------------------------------------- */

const [{ count: pedidos }, { count: eventos }] = await Promise.all([
  db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', perfil.id),
  db
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', perfil.id)
    .in('name', ['payment_approved', 'enrollment_created']),
])

console.log(`\n  Pedidos desta conta: ${pedidos ?? 0}`)
console.log(`  Eventos de pagamento/conversão: ${eventos ?? 0}\n`)
