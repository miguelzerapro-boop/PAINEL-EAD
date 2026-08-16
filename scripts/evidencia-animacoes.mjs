/**
 * EVIDÊNCIA DE MOVIMENTO
 *
 * Screenshot não prova animação. Este script grava vídeo (.webm) e, mais
 * importante, MEDE o que o usuário pediu para verificar:
 *
 *   · quanto tempo o título leva para ficar legível;
 *   · se o movimento desloca layout (CLS real, via PerformanceObserver);
 *   · quais animações são infinitas (as que podem "parecer anúncio");
 *   · quais elementos animados de fato existem na landing;
 *   · desempenho com CPU estrangulada 4x (proxy de celular modesto).
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))
const base = process.argv[2] ?? 'http://localhost:5800'
const OUT = 'docs/validacao/design-forte/animacoes'

const browser = await chromium.launch({ executablePath })
await mkdir(OUT, { recursive: true })
const achados = []

/* ------------------------------------------------------------------ 1. inventário */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const inv = await page.evaluate(() => {
    const conta = (sel) => document.querySelectorAll(sel).length
    const infinitas = []
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.animationName !== 'none' && cs.animationIterationCount.includes('infinite')) {
        infinitas.push({
          nome: cs.animationName,
          dur: cs.animationDuration,
          alvo: el.className || el.tagName,
        })
      }
      const pseudo = getComputedStyle(el, '::after')
      if (pseudo.animationName !== 'none' && pseudo.animationIterationCount.includes('infinite')) {
        infinitas.push({
          nome: pseudo.animationName + ' (::after)',
          dur: pseudo.animationDuration,
          alvo: el.className || el.tagName,
        })
      }
    }
    return {
      palhetas: conta('.palheta'),
      trilhos: conta('.trilho'),
      momentos: conta('.momento'),
      etapas: conta('.etapas > *'),
      grades: conta('.grade > *'),
      infinitas,
    }
  })

  console.log('--- elementos animados presentes na landing ---')
  console.log(`  .palheta        : ${inv.palhetas}`)
  console.log(`  .trilho         : ${inv.trilhos}`)
  console.log(`  .momento        : ${inv.momentos}`)
  console.log(`  .etapas > *     : ${inv.etapas}`)
  console.log(`  .grade > *      : ${inv.grades}`)
  console.log('--- animações infinitas ---')
  if (inv.infinitas.length === 0) console.log('  nenhuma')
  for (const a of inv.infinitas) console.log(`  ${a.nome}  ${a.dur}  em .${a.alvo}`)

  if (inv.palhetas === 0)
    achados.push('A landing NAO contem nenhuma .palheta — a animacao "palheta que assenta" nao tem alvo proprio aqui.')
  if (inv.trilhos === 0)
    achados.push('A landing NAO contem nenhum .trilho — a animacao "trilho que se desenha" nao roda nesta pagina.')
  for (const a of inv.infinitas)
    achados.push(`Animacao INFINITA ativa: ${a.nome} (${a.dur}) em .${a.alvo}.`)

  await page.close()
}

/* ------------------------------------------------------------------ 2. métricas de entrada */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })

  await page.addInitScript(() => {
    window.__cls = 0
    window.__shifts = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) {
          window.__cls += e.value
          window.__shifts.push(e.value)
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })

  // amostra a opacidade do título a cada 40ms até chegar a 1
  const t0 = Date.now()
  let tituloLegivel = null
  for (let i = 0; i < 100 && tituloLegivel === null; i++) {
    const o = await page.evaluate(() => {
      const el = document.querySelector('.capa__titulo')
      return el ? Number(getComputedStyle(el).opacity) : 1
    })
    if (o >= 0.99) tituloLegivel = Date.now() - t0
    else await page.waitForTimeout(40)
  }

  // a página aceita clique imediatamente?
  const clicavel = await page
    .locator('.capa .botao--primario')
    .isEnabled({ timeout: 1000 })
    .catch(() => false)

  await page.waitForTimeout(3000)
  const { cls, shifts } = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }))

  console.log('\n--- entrada ---')
  console.log(`  titulo em opacidade 1 apos : ${tituloLegivel} ms`)
  console.log(`  CTA habilitado de imediato : ${clicavel}`)
  console.log(`  CLS acumulado (3s)         : ${cls.toFixed(4)}  (${shifts.length} deslocamento(s))`)

  if (tituloLegivel !== null && tituloLegivel > 700)
    achados.push(`Titulo demora ${tituloLegivel}ms para ficar opaco — acima de 700ms e percebido como atraso.`)
  if (cls > 0.1) achados.push(`CLS ${cls.toFixed(3)} acima de 0,1 — o movimento esta deslocando layout.`)

  await page.close()
}

/* ------------------------------------------------------------------ 3. vídeos */
async function grava(nome, w, h, roteiro, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    locale: 'pt-BR',
    recordVideo: { dir: OUT, size: { width: w, height: h } },
    ...extra,
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await roteiro(page)
  const video = page.video()
  await page.close()
  await ctx.close()
  if (video) {
    await video.saveAs(`${OUT}/${nome}.webm`)
    await video.delete().catch(() => {})
    console.log(`ok  video ${nome}.webm`)
  }
}

// entrada do herói: 4s desde o load
await grava('01-entrada-heroi', 1280, 720, async (p) => {
  await p.waitForTimeout(4000)
})

// brilho de laca: 13s parado no CTA — cobre duas repeticoes do ciclo de 5,5s
await grava('02-brilho-de-laca-13s', 900, 420, async (p) => {
  await p.evaluate(() => {
    const el = document.querySelector('.capa .botao--primario')
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
  await p.waitForTimeout(13000)
})

// rolagem: etapas e momentos assentando
await grava('03-rolagem-etapas-e-momentos', 1280, 720, async (p) => {
  await p.waitForTimeout(1200)
  for (let i = 0; i < 26; i++) {
    await p.mouse.wheel(0, 130)
    await p.waitForTimeout(90)
  }
  await p.waitForTimeout(1500)
})

// hover no CTA e num momento
await grava('04-hover-cta-e-momento', 1280, 720, async (p) => {
  await p.waitForTimeout(1500)
  await p.locator('.capa .botao--primario').hover()
  await p.waitForTimeout(1800)
  await p.locator('.momento').first().scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)
  await p.locator('.momento').nth(1).hover()
  await p.waitForTimeout(1500)
})

// reducao de movimento
await grava(
  '05-reducao-de-movimento',
  1280,
  720,
  async (p) => {
    await p.waitForTimeout(2500)
    for (let i = 0; i < 14; i++) {
      await p.mouse.wheel(0, 160)
      await p.waitForTimeout(90)
    }
    await p.waitForTimeout(1200)
  },
  { reducedMotion: 'reduce' },
)

/* ------------------------------------------------------------------ 4. celular estrangulado */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'pt-BR',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.addInitScript(() => {
    window.__frames = 0
    const tick = () => {
      window.__frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await page.evaluate(() => (window.__frames = 0))
  await page.waitForTimeout(3000)
  const frames = await page.evaluate(() => window.__frames)
  const fps = frames / 3

  console.log('\n--- celular 390px, CPU 4x mais lenta ---')
  console.log(`  quadros por segundo em repouso: ${fps.toFixed(1)}`)
  if (fps < 45) achados.push(`Com CPU 4x estrangulada o repouso cai para ${fps.toFixed(1)} fps.`)

  await page.screenshot({ path: `${OUT}/06-mobile-cpu-4x.png` })
  await page.close()
  await ctx.close()
}

await browser.close()

console.log('\n================ ACHADOS ================')
if (achados.length === 0) console.log('nenhum problema detectado')
else achados.forEach((a) => console.log('· ' + a))
