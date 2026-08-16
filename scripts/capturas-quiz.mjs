/**
 * Capturas do quiz nas quatro larguras + auditoria de contraste real.
 *
 *   node scripts/capturas-quiz.mjs [baseUrl]
 *
 * A auditoria mede o contraste do TEXTO RENDERIZADO contra o fundo que está
 * de fato atrás dele — subindo a árvore até achar um fundo opaco. É a única
 * forma de pegar o caso que quebrou aqui: texto branco sobre um cartão claro
 * herdado do tema antigo.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3117'
const SAIDA = 'screenshots/quiz'
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

const LARGURAS = [
  { nome: '1440', width: 1440, height: 1000, toque: false },
  { nome: '834', width: 834, height: 1180, toque: true },
  { nome: '390', width: 390, height: 844, toque: true },
  { nome: '360', width: 360, height: 800, toque: true },
]

const browser = await chromium.launch({ executablePath })
const problemas = []

for (const vp of LARGURAS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.toque,
    locale: 'pt-BR',
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto(`${base}/estilo/telas/quiz`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(800)

  await page.screenshot({ path: path.join(SAIDA, `quiz-${vp.nome}.png`) })
  await page.screenshot({
    path: path.join(SAIDA, `quiz-${vp.nome}-completa.png`),
    fullPage: true,
  })

  // Selecionada
  const opcao = page.locator('.opcao').first()
  if (await opcao.count()) {
    await opcao.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SAIDA, `quiz-${vp.nome}-selecionada.png`) })
  }

  /* --- Contraste do que está realmente na tela -------------------------- */

  const medidas = await page.evaluate(() => {
    function paraRgb(cor) {
      const m = cor.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map((n) => parseFloat(n.trim()))
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    function lum({ r, g, b }) {
      const c = [r, g, b].map((v) => {
        v /= 255
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    /** Sobe a árvore até achar um fundo opaco de verdade. */
    function fundoReal(el) {
      let n = el
      while (n && n !== document.documentElement) {
        const bg = paraRgb(getComputedStyle(n).backgroundColor)
        if (bg && bg.a > 0.85) return bg
        n = n.parentElement
      }
      return { r: 255, g: 255, b: 255, a: 1 }
    }

    const saida = []
    const alvos = document.querySelectorAll(
      '.quiz__enunciado, .quiz__apoio, .opcao, .opcao__texto, .opcao__ajuda, ' +
        '.quiz__etapa, .campo__rotulo, .campo__dica, .consentimento, ' +
        '.botao, .quiz-limite__regra, .quiz-bloqueio, .quiz-salvamento',
    )

    for (const el of alvos) {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      const texto = (el.textContent ?? '').trim()
      if (!texto) continue

      const cs = getComputedStyle(el)
      const fg = paraRgb(cs.color)
      if (!fg) continue
      const bg = fundoReal(el)

      const lf = lum(fg)
      const lb = lum(bg)
      const razao = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)

      const tamanho = parseFloat(cs.fontSize)
      const peso = parseInt(cs.fontWeight, 10) || 400
      // WCAG: texto grande (>=24px, ou >=18.66px em negrito) exige 3:1
      const grande = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700)
      const minimo = grande ? 3 : 4.5

      saida.push({
        classe: el.className.toString().split(' ')[0],
        texto: texto.slice(0, 40),
        razao: Math.round(razao * 100) / 100,
        minimo,
        passa: razao >= minimo,
        px: Math.round(tamanho),
      })
    }
    return saida
  })

  const reprovados = medidas.filter((m) => !m.passa)
  console.log(
    `${vp.nome.padEnd(6)} ${String(medidas.length).padStart(3)} elementos medidos` +
      (reprovados.length ? `   ⚠️ ${reprovados.length} REPROVAM` : '   todos passam'),
  )
  for (const r of reprovados) {
    console.log(`         ${r.razao}:1 (min ${r.minimo}) ${r.px}px .${r.classe} "${r.texto}"`)
    problemas.push({ vp: vp.nome, ...r })
  }

  await context.close()
}

await browser.close()

console.log(`\nCapturas em ${SAIDA}/`)
console.log(problemas.length === 0 ? 'CONTRASTE: nenhum reprovado.' : `CONTRASTE: ${problemas.length} reprovações.`)
if (problemas.length > 0) process.exitCode = 1
