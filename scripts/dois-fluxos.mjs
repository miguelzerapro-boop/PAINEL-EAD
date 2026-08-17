/**
 * OS DOIS CAMINHOS DE ENTRADA, E A PAREDE ENTRE ELES
 *
 *   A — admin entra, vê o painel, usa "Ver como aluna", volta;
 *   B — aluna entra e cai na área de estudos, sem nenhum acesso ao painel.
 *
 * O passo que mais importa é o de SEGURANÇA: a aluna digita `/admin` na barra
 * de endereço. Esconder o item do menu não protege nada — quem decide é o
 * middleware, no servidor. Este teste tenta abrir cada tela do painel com a
 * sessão dela e exige que nenhuma responda.
 *
 * Os logins são feitos pela TELA, com e-mail e senha, como qualquer pessoa
 * faria. Nada de sessão injetada aqui.
 *
 *   node scripts/dois-fluxos.mjs [base]
 *
 * As senhas vêm do ambiente:
 *   SENHA_ADMIN='...' SENHA_ALUNA='...' node scripts/dois-fluxos.mjs
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

const ADMIN = { email: 'miguelzerapro@gmail.com', senha: process.env.SENHA_ADMIN }
const ALUNA = { email: 'ainoamesquita@gmail.com', senha: process.env.SENHA_ALUNA }

if (!ADMIN.senha || !ALUNA.senha) {
  console.error('\n  Defina SENHA_ADMIN e SENHA_ALUNA no ambiente.\n')
  process.exit(1)
}

/** Telas do painel que a aluna NÃO pode abrir de jeito nenhum. */
const PROIBIDAS = [
  '/admin',
  '/admin/formacao',
  '/admin/alunas',
  '/admin/vendas',
  '/admin/funil',
  '/admin/ajustes',
  '/admin/quiz',
  '/admin/previa/entrar?plano=completo',
]

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok })
  console.log(`  [${ok ? 'ok  ' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/* --- Os papéis, direto do banco ------------------------------------------- */

const { data: perfis } = await supa.from('profiles').select('email, role')
const papel = (email) =>
  perfis?.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.role ?? '(sem perfil)'

console.log(`\nDOIS FLUXOS — ${BASE}\n`)
console.log('  Papéis no banco:')
for (const p of perfis ?? []) console.log(`    · ${p.email} — ${p.role}`)
console.log('')

registrar(
  'Admin tem papel de equipe',
  ['admin', 'owner'].includes(papel(ADMIN.email)),
  papel(ADMIN.email),
)
registrar('Aluna tem papel student', papel(ALUNA.email) === 'student', papel(ALUNA.email))
registrar(
  'Só uma conta com acesso ao painel',
  (perfis ?? []).filter((p) => ['admin', 'owner', 'instructor'].includes(p.role)).length === 1,
)

const navegador = await chromium.launch()

/** Entra pela tela, como qualquer pessoa. */
async function entrar(contexto, conta) {
  const aba = await contexto.newPage()
  aba.setDefaultTimeout(45000)
  await aba.goto(`${BASE}/entrar`, { waitUntil: 'load' })
  await aba.locator('input[type="email"]').fill(conta.email)
  await aba.locator('input[autocomplete="current-password"]').fill(conta.senha)
  await aba.getByRole('button', { name: /^entrar$/i }).click()
  await aba.waitForTimeout(6000)
  return aba
}

/* ================= FLUXO A — admin ======================================== */
console.log('\n─── FLUXO A: ADMIN ───\n')
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const aba = await entrar(ctx, ADMIN)

  registrar('Admin entra e cai no painel', aba.url().includes('/admin'), aba.url().replace(BASE, ''))

  await aba.goto(`${BASE}/admin/previa/entrar?plano=completo`, { waitUntil: 'load' })
  await aba.waitForTimeout(2500)

  registrar('Ver como aluna abre a área da aluna', aba.url().includes('/aluna'), aba.url().replace(BASE, ''))
  registrar(
    'Menu do painel sumiu',
    (await aba.locator('a[href="/admin/vendas"], a[href="/admin/funil"]').count()) === 0,
  )
  registrar('Barra de preview aparece', (await aba.locator('.barra-modo').count()) > 0)
  /*
   * A contagem e feita em "Minha Formacao", nao no Inicio: o Inicio mostra
   * so os primeiros quatro, com um link para a lista inteira. A primeira
   * versao contava no Inicio e acusava 4 de 8 como se a matriz estivesse
   * quebrada.
   */
  await aba.goto(`${BASE}/aluna/cursos`, { waitUntil: "load" })
  await aba.waitForTimeout(2000)
  registrar(
    "Aluna do plano Completo ve 8 capitulos",
    (await aba.locator(String.raw`.form-aluna__capitulo[data-aberto="sim"]`).count()) === 8,
    `${await aba.locator(String.raw`.form-aluna__capitulo[data-aberto="sim"]`).count()} aberto(s)`,
  )

  await aba.locator('.barra-modo__voltar').click()
  await aba.waitForTimeout(3000)
  registrar('Voltar ao Admin devolve ao painel', aba.url().includes('/admin'), aba.url().replace(BASE, ''))

  await ctx.close()
}

/* ================= FLUXO B — aluna ======================================== */
console.log('\n─── FLUXO B: ALUNA REAL ───\n')
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const aba = await entrar(ctx, ALUNA)

  registrar('Aluna entra e cai na área de estudos', aba.url().includes('/aluna'), aba.url().replace(BASE, ''))
  registrar('Aluna NÃO cai no painel', !aba.url().includes('/admin'))
  registrar(
    'Aluna não vê barra de preview',
    (await aba.locator('.barra-modo').count()) === 0,
  )

  /* O menu dela: quatro itens, nenhum de painel. */
  const itensDeAdmin = await aba.locator('a[href^="/admin"]').count()
  registrar('Nenhum link de painel no menu da aluna', itensDeAdmin === 0, `${itensDeAdmin} link(s)`)
  registrar('Comunidade no menu da aluna', (await aba.locator('a[href="/aluna/comunidade"]').count()) > 0)

  /* --- A parede ---------------------------------------------------------- */
  console.log('')
  for (const rota of PROIBIDAS) {
    await aba.goto(BASE + rota, { waitUntil: 'load' })
    await aba.waitForTimeout(1200)
    const barrada = !aba.url().includes('/admin')
    registrar(`Digitar ${rota} não entra`, barrada, `parou em ${aba.url().replace(BASE, '')}`)
  }

  await ctx.close()
}

await navegador.close()

const falhas = passos.filter((p) => !p.ok).length
console.log(`\n  ${passos.length} verificações · ${falhas} falha(s)\n`)
process.exit(falhas ? 1 : 0)
