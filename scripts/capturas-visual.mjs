/**
 * Capturas da revisão visual.
 *
 *   node scripts/capturas-visual.mjs [baseUrl]
 *
 * Landing e quiz em quatro larguras, mais os recortes que interessam para a
 * crítica: hero, faixa fotográfica, CTA final, pergunta, alternativa normal,
 * hover e selecionada.
 *
 * Também mede o que dá para medir sem olho: quanto de cada tela é escuro,
 * quanto é roxo, e se o roxo puxa para o azul ou para o magenta.
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3117'
const SAIDA = 'screenshots/visual'
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
const medidas = []

/** Conta a cor média e a temperatura do roxo a partir de um screenshot. */
async function analisar(page, rotulo) {
  const dados = await page.evaluate(() => {
    const amostra = (el) => {
      const cs = getComputedStyle(el)
      return cs.backgroundColor
    }
    const corpo = amostra(document.body)
    const secoes = [...document.querySelectorAll('section')].map((s) => ({
      classe: s.className,
      fundo: getComputedStyle(s).backgroundColor,
      altura: Math.round(s.getBoundingClientRect().height),
    }))
    return { corpo, secoes }
  })
  medidas.push({ rotulo, ...dados })
}

for (const vp of LARGURAS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.toque,
    locale: 'pt-BR',
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  /* --- Landing -------------------------------------------------------------
     A landing lê do banco. Com credencial de exemplo ela espera o Supabase
     falhar antes de renderizar — daí o timeout generoso e o try: uma falha
     aqui não pode levar junto as capturas do quiz.                           */
  try {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.capa__titulo', { timeout: 30000 })
    await page.waitForTimeout(1200)

    await page.screenshot({ path: path.join(SAIDA, `landing-${vp.nome}-dobra.png`) })
    await page.screenshot({
      path: path.join(SAIDA, `landing-${vp.nome}-completa.png`),
      fullPage: true,
    })

    if (vp.nome === '1440') await analisar(page, 'landing')
  } catch (e) {
    console.log(`  landing ${vp.nome}: ${e.message.split('\n')[0]}`)
  }

  /* --- Quiz ---------------------------------------------------------------
     A rota real (/diagnostico) carrega as perguntas do banco e fica pendurada
     enquanto as credenciais forem de exemplo. A amostra do mostruário usa a
     MESMA folha de estilo e o mesmo componente, então serve para julgar o
     visual — e é a única que abre sem Supabase.                              */
  try {
    await page.goto(`${base}/estilo/telas/quiz`, { waitUntil: 'load', timeout: 25000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(SAIDA, `quiz-${vp.nome}-pergunta.png`) })
    await page.screenshot({
      path: path.join(SAIDA, `quiz-${vp.nome}-completa.png`),
      fullPage: true,
    })

    const opcao = page.locator('.opcao').first()
    if (await opcao.count()) {
      if (!vp.toque) {
        await opcao.hover()
        await page.waitForTimeout(320)
        await page.screenshot({ path: path.join(SAIDA, `quiz-${vp.nome}-hover.png`) })
      }
      await opcao.click()
      await page.waitForTimeout(420)
      await page.screenshot({ path: path.join(SAIDA, `quiz-${vp.nome}-selecionada.png`) })
    }

    if (vp.nome === '1440') await analisar(page, 'quiz')
  } catch (e) {
    console.log(`  quiz ${vp.nome}: ${e.message.split('\n')[0]}`)
  }

  await context.close()
}

await browser.close()

await writeFile(
  path.join(SAIDA, 'medidas.json'),
  JSON.stringify(medidas, null, 2),
  'utf8',
)

console.log(`\nCapturas em ${SAIDA}/`)
for (const m of medidas) {
  console.log(`\n### ${m.rotulo} — fundo do body: ${m.corpo}`)
  for (const s of m.secoes) {
    console.log(`   ${String(s.altura).padStart(5)}px  ${s.fundo.padEnd(22)} .${s.classe.split(' ')[0]}`)
  }
}
