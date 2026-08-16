/**
 * CONTRASTE MEDIDO, NÃO OPINADO
 *
 * "Está difícil de ler" é impressão. Isto é medição: percorre as telas
 * públicas, do painel e da aluna, calcula a razão de contraste de cada texto
 * visível contra o fundo REAL que está atrás dele, e lista o que reprova.
 *
 * O CÁLCULO segue a WCAG 2.1: luminância relativa de cada cor e a razão
 * (L1 + 0.05) / (L2 + 0.05). O limite é 4.5:1 para texto normal e 3:1 para
 * texto grande (18.66px em negrito, ou 24px).
 *
 * O FUNDO REAL É O PONTO DIFÍCIL. `background-color` do próprio elemento
 * costuma ser `transparent` — a cor que importa é a do primeiro ancestral
 * que pinta alguma coisa. O script sobe a árvore até achar.
 *
 * O que ele NÃO mede, e por isso não reprova: texto sobre imagem ou gradiente
 * (o valor atrás varia pixel a pixel) e elementos invisíveis.
 *
 *   node scripts/auditoria-contraste.mjs [base]
 */

import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const SAIDA = 'docs/validacao'

const PUBLICAS = ['/', '/diagnostico', '/planos', '/checkout/completo', '/entrar']
const COM_SESSAO = [
  '/admin',
  '/admin/formacao',
  '/admin/formacao/aula/nova',
  '/admin/quiz',
  '/admin/quiz/pergunta/nova',
  '/admin/alunas',
  '/admin/vendas',
  '/admin/ajustes',
  '/admin/funil',
  '/aluna',
  '/aluna/perfil',
]

/* --- A medição, dentro do navegador --------------------------------------- */

const MEDIR = () => {
  const luminancia = (r, g, b) => {
    const f = (v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  const cor = (txt) => {
    const m = txt.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n))
    return { r, g, b, a: a === undefined ? 1 : a }
  }

  /** Sobe a árvore até achar quem realmente pinta o fundo. */
  const fundoReal = (el) => {
    let atual = el
    while (atual && atual !== document.documentElement) {
      const estilo = getComputedStyle(atual)
      const c = cor(estilo.backgroundColor)
      // Se tem imagem/gradiente, não dá para medir com segurança.
      if (estilo.backgroundImage && estilo.backgroundImage !== 'none') return { indeterminado: true }
      if (c && c.a >= 0.95) return c
      atual = atual.parentElement
    }
    return cor(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 }
  }

  const razao = (a, b) => {
    const l1 = luminancia(a.r, a.g, a.b)
    const l2 = luminancia(b.r, b.g, b.b)
    const [claro, escuro] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (claro + 0.05) / (escuro + 0.05)
  }

  const achados = []
  const vistos = new Set()

  for (const el of document.querySelectorAll('body *')) {
    // Só elementos com texto próprio.
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (!texto) continue

    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const estilo = getComputedStyle(el)
    if (estilo.visibility === 'hidden' || estilo.opacity === '0') continue

    const frente = cor(estilo.color)
    if (!frente) continue

    const fundo = fundoReal(el)
    if (fundo.indeterminado) continue

    const tamanho = parseFloat(estilo.fontSize)
    const peso = parseInt(estilo.fontWeight, 10) || 400
    const grande = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700)
    const limite = grande ? 3 : 4.5

    const valor = razao(frente, fundo)

    const chave = `${el.className}|${estilo.color}|${texto.slice(0, 30)}`
    if (vistos.has(chave)) continue
    vistos.add(chave)

    if (valor < limite) {
      achados.push({
        texto: texto.slice(0, 60),
        classe: (el.className?.toString?.() ?? '').slice(0, 60),
        cor: estilo.color,
        fundo: `rgb(${fundo.r}, ${fundo.g}, ${fundo.b})`,
        tamanho: Math.round(tamanho),
        razao: Math.round(valor * 100) / 100,
        limite,
      })
    }
  }

  return achados
}

/* --- Sessão de admin ------------------------------------------------------- */

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: link } = await supa.auth.admin.generateLink({
  type: 'magiclink',
  email: 'miguelzerapro@gmail.com',
})
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

/* --- Varredura -------------------------------------------------------------- */

const navegador = await chromium.launch()
const relatorio = []

for (const largura of [1440, 390]) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: 900 } })
  await contexto.addCookies(cookies)
  const aba = await contexto.newPage()
  aba.setDefaultTimeout(60000)

  for (const rota of [...PUBLICAS, ...COM_SESSAO]) {
    try {
      await aba.goto(BASE + rota, { waitUntil: 'load', timeout: 60000 })
      await aba
        .waitForFunction(
          () => !((document.querySelector('main') ?? document.body).innerText ?? '').trim().startsWith('Carregando'),
          { timeout: 30000 },
        )
        .catch(() => {})
      await aba.evaluate(() => document.fonts.ready)
      await aba.waitForTimeout(500)

      const achados = await aba.evaluate(MEDIR)
      relatorio.push({ rota, largura, achados })
    } catch (e) {
      relatorio.push({ rota, largura, erro: String(e).slice(0, 90), achados: [] })
    }
  }

  await contexto.close()
}

await navegador.close()
await mkdir(SAIDA, { recursive: true })
await writeFile(`${SAIDA}/auditoria-contraste.json`, JSON.stringify(relatorio, null, 2))

/* --- Relatório -------------------------------------------------------------- */

let total = 0
console.log(`\nCONTRASTE — ${BASE}\n`)

for (const r of relatorio) {
  if (r.achados.length === 0 && !r.erro) continue
  total += r.achados.length
  console.log(`  ${r.rota} @ ${r.largura}px${r.erro ? ` — erro: ${r.erro}` : ''}`)
  for (const a of r.achados) {
    console.log(
      `      ${a.razao}:1 (mínimo ${a.limite}) · ${a.cor} sobre ${a.fundo} · ${a.tamanho}px`,
    )
    console.log(`      "${a.texto}"  .${a.classe}`)
  }
}

console.log(`\n  ${total} texto(s) abaixo do mínimo da WCAG AA\n`)
process.exit(total ? 1 : 0)
