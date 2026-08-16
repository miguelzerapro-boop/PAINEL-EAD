/**
 * O CICLO COMPLETO DE "VER COMO ALUNA"
 *
 *   painel → escolher plano → interface REAL da aluna → voltar ao painel
 *
 * O que este teste prova, e que nenhuma captura prova sozinha:
 *
 *   · o menu do ADMIN some — quem confere sai mesmo do painel;
 *   · a contagem de capítulos abertos bate com a matriz 3/6/8;
 *   · o capítulo fechado diz qual plano o abre, em vez de só um cadeado;
 *   · "Voltar ao painel" devolve para /admin em UM clique;
 *   · e o mais importante: NADA foi criado no banco. Matrículas, pedidos e
 *     progresso são contados antes e depois, e têm que ser idênticos.
 *
 *   node scripts/previa-aluna.mjs [base]
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = process.argv[3] ?? 'miguelzerapro@gmail.com'
const ESPERADO = { iniciante: 3, profissional: 6, completo: 8 }

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok })
  console.log(`  [${ok ? 'ok  ' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

/** Fotografa o banco: se a prévia gravar qualquer coisa, isto muda. */
async function contarEstado() {
  const alvos = ['enrollments', 'orders', 'lesson_progress']
  const contagem = {}
  for (const t of alvos) {
    const { count } = await supa.from(t).select('*', { count: 'exact', head: true })
    contagem[t] = count ?? 0
  }
  return contagem
}

const antes = await contarEstado()
console.log(`\nPRÉVIA COMO ALUNA — ${BASE}`)
console.log(`  Banco antes: ${JSON.stringify(antes)}\n`)

/* --- Sessão de admin, pela porta oficial ---------------------------------- */
const { data: link } = await supa.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
const { data: sessao } = await supa.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
})

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const bruto = 'base64-' + Buffer.from(JSON.stringify(sessao.session), 'utf8').toString('base64')
const pedacos = []
for (let i = 0; i < bruto.length; i += 3180) pedacos.push(bruto.slice(i, i + 3180))

const dominio = new URL(BASE)
const cookies = (
  pedacos.length === 1
    ? [{ name: `sb-${ref}-auth-token`, value: pedacos[0] }]
    : pedacos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v }))
).map((c) => ({
  ...c,
  domain: dominio.hostname,
  path: '/',
  httpOnly: false,
  secure: dominio.protocol === 'https:',
  sameSite: 'Lax',
}))

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
await contexto.addCookies(cookies)
const aba = await contexto.newPage()
aba.setDefaultTimeout(45000)

for (const [plano, esperado] of Object.entries(ESPERADO)) {
  console.log(`\n─── ${plano.toUpperCase()} ───\n`)

  await aba.goto(`${BASE}/admin/formacao/previa?plano=${plano}`, { waitUntil: 'load' })

  const entrar = aba.locator(`a[href="/admin/previa/entrar?plano=${plano}"]`)
  registrar('Painel oferece abrir a área da aluna', (await entrar.count()) > 0)

  await entrar.click()
  const chegou = await aba
    .waitForURL('**/aluna**', { timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  registrar('Abre a área da aluna', chegou, aba.url().replace(BASE, ''))

  /* O menu do ADMIN tem que ter sumido. */
  const menuAdmin = await aba.locator('a[href="/admin/vendas"], a[href="/admin/funil"]').count()
  registrar('Menu do painel sumiu', menuAdmin === 0, `${menuAdmin} item(ns) de admin na tela`)

  /* A barra de modo, com o plano certo. */
  const barra = await aba.locator('.barra-modo__texto').textContent().catch(() => '')
  registrar(
    'Barra diz qual plano está sendo visto',
    /visualizando como aluna/i.test(barra ?? ''),
    (barra ?? '').trim(),
  )

  /* A matriz 3/6/8, vinda de offer_module_access. */
  const abertos = await aba.locator('.capitulo[data-aberto="sim"]').count()
  const fechados = await aba.locator('.capitulo[data-aberto="nao"]').count()
  registrar(
    `Mostra ${esperado} capítulos abertos`,
    abertos === esperado,
    `${abertos} abertos · ${fechados} fechados`,
  )

  /* O bloqueio precisa convidar, não só travar. */
  if (fechados > 0) {
    const texto = await aba.locator('.capitulo[data-aberto="nao"] .capitulo__meta').first().textContent()
    registrar(
      'Capítulo fechado diz qual plano o abre',
      /disponível no plano/i.test(texto ?? ''),
      (texto ?? '').trim(),
    )
  }

  /* Voltar em UM clique. */
  await aba.locator('.barra-modo__voltar').click()
  const voltou = await aba
    .waitForURL('**/admin**', { timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  registrar('"Voltar ao painel" devolve ao admin', voltou, aba.url().replace(BASE, ''))

  /* E a prévia tem que ter acabado de verdade. */
  await aba.goto(`${BASE}/aluna`, { waitUntil: 'load' })
  const aindaEmPrevia = await aba.locator('.barra-modo').count()
  registrar('Modo de visualização foi desligado', aindaEmPrevia === 0)
}

await navegador.close()

/* --- O banco não pode ter mudado ------------------------------------------ */
const depois = await contarEstado()
const igual = JSON.stringify(antes) === JSON.stringify(depois)
console.log(`\n  Banco depois: ${JSON.stringify(depois)}`)
registrar('Nada foi criado no banco', igual, igual ? 'idêntico' : 'MUDOU')

const falhas = passos.filter((p) => !p.ok).length
console.log(`\n  ${passos.length} verificações · ${falhas} falha(s)\n`)
process.exit(falhas ? 1 : 0)
