/**
 * AUDITORIA DO FUNIL PÚBLICO
 *
 *   node scripts/auditoria-funil.mjs [baseUrl]
 *
 * Duas coisas, nesta ordem:
 *
 *   1. VARREDURA DE ROTAS — abre cada rota, mede o tempo, anota o código e
 *      classifica: responde, redireciona, trava ou quebra.
 *
 *   2. AUDITORIA DE CLIQUES — em cada página que responde, olha TODO elemento
 *      clicável e procura os que não levam a lugar nenhum: href vazio, href
 *      "#", botão sem handler, link para rota que não existe.
 *
 * Não navega o funil "por dentro" (isso exige banco). Aqui se estabelece o
 * que está de pé antes de qualquer afirmação sobre o fluxo.
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3117'
const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))
if (!executablePath) {
  console.error('Nenhum Chrome ou Edge encontrado.')
  process.exit(1)
}

/** Rotas públicas + as protegidas, para conferir o redirecionamento. */
const ROTAS = [
  { url: '/', nome: 'Landing', grupo: 'publica' },
  { url: '/diagnostico', nome: 'Quiz — abertura', grupo: 'publica' },
  { url: '/diagnostico/resultado', nome: 'Quiz — resultado (sem token)', grupo: 'publica' },
  { url: '/cursos', nome: 'Catálogo', grupo: 'publica' },
  { url: '/entrar', nome: 'Login', grupo: 'publica' },
  { url: '/termos', nome: 'Termos', grupo: 'legal' },
  { url: '/privacidade', nome: 'Privacidade', grupo: 'legal' },
  { url: '/reembolso', nome: 'Reembolso', grupo: 'legal' },
  { url: '/suporte', nome: 'Suporte', grupo: 'legal' },
  { url: '/obrigado', nome: 'Obrigado (pós-compra)', grupo: 'publica' },
  { url: '/checkout/oferta-inexistente', nome: 'Checkout — oferta inexistente', grupo: 'borda' },
  { url: '/cursos/curso-inexistente', nome: 'Curso inexistente', grupo: 'borda' },
  { url: '/preview/chave-invalida', nome: 'Preview — token inválido', grupo: 'borda' },
  { url: '/rota-que-nao-existe', nome: '404', grupo: 'borda' },
  { url: '/admin', nome: 'Admin (visitante)', grupo: 'protegida' },
  { url: '/admin/formacao', nome: 'Admin formação (visitante)', grupo: 'protegida' },
  { url: '/aluna', nome: 'Área da aluna (visitante)', grupo: 'protegida' },
  { url: '/aluna/cursos', nome: 'Meus cursos (visitante)', grupo: 'protegida' },
  { url: '/estilo', nome: 'Mostruário', grupo: 'interna' },
]

const LIMITE_MS = 60000

const browser = await chromium.launch({ executablePath })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'pt-BR',
})

const resultados = []

for (const rota of ROTAS) {
  const page = await context.newPage()
  const inicio = Date.now()
  let registro = {
    ...rota,
    status: null,
    ms: 0,
    destino: null,
    redirecionou: false,
    estado: '',
    titulo: null,
    erroConsole: [],
  }

  page.on('console', (m) => {
    if (m.type() === 'error') registro.erroConsole.push(m.text().slice(0, 120))
  })

  try {
    const resposta = await page.goto(`${base}${rota.url}`, {
      waitUntil: 'domcontentloaded',
      timeout: LIMITE_MS,
    })
    registro.ms = Date.now() - inicio
    registro.status = resposta?.status() ?? null

    const final = new URL(page.url())
    registro.destino = final.pathname + final.search
    registro.redirecionou = registro.destino !== rota.url

    registro.titulo = (await page.title()).slice(0, 60)

    // Uma página que responde 200 mas está vazia não está "funcionando".
    const temConteudo = await page.evaluate(
      () => (document.body?.innerText ?? '').trim().length > 40,
    )

    if (!temConteudo) registro.estado = 'VAZIA'
    else if (registro.redirecionou) registro.estado = 'REDIRECIONA'
    else if (registro.status && registro.status >= 400) registro.estado = 'ERRO'
    else registro.estado = 'OK'
  } catch (e) {
    registro.ms = Date.now() - inicio
    registro.estado = /timeout/i.test(e.message) ? 'TRAVA' : 'FALHA'
  }

  resultados.push(registro)
  console.log(
    `${registro.estado.padEnd(11)} ${String(registro.status ?? '—').padEnd(4)} ` +
      `${String(registro.ms).padStart(6)}ms  ${rota.url}` +
      (registro.redirecionou ? `  →  ${registro.destino}` : ''),
  )

  await page.close()
}

/* ========================================================================== */
/* Auditoria de cliques nas páginas que abriram                               */
/* ========================================================================== */

console.log('\n--- elementos clicáveis ---\n')

const rotasVivas = resultados.filter((r) => r.estado === 'OK' || r.estado === 'REDIRECIONA')
const problemas = []

for (const rota of rotasVivas) {
  const page = await context.newPage()
  try {
    await page.goto(`${base}${rota.url}`, { waitUntil: 'domcontentloaded', timeout: LIMITE_MS })
    await page.waitForTimeout(500)

    const achados = await page.evaluate(() => {
      const saida = []

      for (const a of document.querySelectorAll('a')) {
        const href = a.getAttribute('href')
        const texto = (a.textContent ?? '').trim().slice(0, 40)
        const visivel = a.getBoundingClientRect().width > 0

        if (!visivel) continue

        if (href === null || href === '') {
          saida.push({ tipo: 'link sem href', texto, href: String(href) })
        } else if (href === '#') {
          saida.push({ tipo: 'link para #', texto, href })
        } else if (href.startsWith('http') && !href.includes(location.host)) {
          saida.push({ tipo: 'externo', texto, href: href.slice(0, 80) })
        } else if (href.startsWith('/')) {
          saida.push({ tipo: 'interno', texto, href })
        }
      }

      for (const b of document.querySelectorAll('button')) {
        const texto = (b.textContent ?? '').trim().slice(0, 40)
        const visivel = b.getBoundingClientRect().width > 0
        if (!visivel) continue
        const tipo = b.getAttribute('type')
        // Botão fora de <form> e sem type=submit depende de handler JS. Num
        // componente de servidor isso normalmente significa botão morto.
        const dentroDeForm = Boolean(b.closest('form'))
        if (!dentroDeForm && tipo !== 'submit') {
          saida.push({ tipo: 'botao-js', texto, href: '' })
        }
      }

      return saida
    })

    const internos = achados.filter((a) => a.tipo === 'interno')
    const suspeitos = achados.filter((a) => a.tipo === 'link sem href' || a.tipo === 'link para #')

    for (const s of suspeitos) {
      problemas.push({ rota: rota.url, ...s })
    }

    console.log(
      `${rota.url.padEnd(34)} ${String(internos.length).padStart(3)} links internos` +
        (suspeitos.length ? `  ⚠️ ${suspeitos.length} sem destino` : ''),
    )

    // Guarda os destinos internos para conferir se a rota existe.
    rota.linksInternos = [...new Set(internos.map((i) => i.href))]
  } catch (e) {
    console.log(`${rota.url.padEnd(34)} falhou: ${e.message.split('\n')[0]}`)
  }
  await page.close()
}

/* --- Todo destino interno leva a algum lugar? ----------------------------- */

console.log('\n--- destinos internos ---\n')

const destinos = [...new Set(rotasVivas.flatMap((r) => r.linksInternos ?? []))].sort()
const destinosQuebrados = []

for (const destino of destinos) {
  // Âncora na mesma página não é rota.
  const semAncora = destino.split('#')[0]
  if (!semAncora || semAncora === '/') continue

  const page = await context.newPage()
  try {
    const r = await page.goto(`${base}${semAncora}`, {
      waitUntil: 'domcontentloaded',
      timeout: LIMITE_MS,
    })
    const status = r?.status() ?? 0
    const final = new URL(page.url()).pathname
    const ok = status < 400
    if (!ok) destinosQuebrados.push({ destino, status })
    console.log(`  ${ok ? 'ok  ' : 'QUEBRADO'} ${String(status).padEnd(4)} ${destino}` +
      (final !== semAncora ? ` → ${final}` : ''))
  } catch (e) {
    const travou = /timeout/i.test(e.message)
    destinosQuebrados.push({ destino, status: travou ? 'TRAVA' : 'FALHA' })
    console.log(`  ${travou ? 'TRAVA   ' : 'FALHA   '} —    ${destino}`)
  }
  await page.close()
}

await browser.close()

await writeFile(
  path.join(SAIDA, 'auditoria-funil.json'),
  JSON.stringify({ resultados, problemas, destinosQuebrados }, null, 2),
  'utf8',
)

/* -------------------------------------------------------------------------- */

console.log('\n=== RESUMO ===\n')
const porEstado = {}
for (const r of resultados) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1
for (const [estado, n] of Object.entries(porEstado)) console.log(`  ${estado.padEnd(12)} ${n}`)

console.log(`\n  links sem destino: ${problemas.length}`)
console.log(`  destinos quebrados: ${destinosQuebrados.length}`)
console.log(`\nDetalhe em ${SAIDA}/auditoria-funil.json\n`)
