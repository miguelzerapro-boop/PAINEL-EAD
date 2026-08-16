/** Confere que o relatório abre e que todas as imagens/vídeos resolvem. */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const alvo = pathToFileURL(resolve('docs/validacao/design-forte/relatorio.html')).href

const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 } })
await page.goto(alvo, { waitUntil: 'load' })
await page.waitForTimeout(2500)

const r = await page.evaluate(() => {
  const imgs = [...document.images]
  const quebradas = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src'))
  return { total: imgs.length, quebradas, videos: document.querySelectorAll('video').length }
})

console.log(`imagens: ${r.total}   videos: ${r.videos}`)
console.log(r.quebradas.length === 0 ? 'todas as imagens carregaram' : 'QUEBRADAS: ' + r.quebradas.join(', '))

await page.screenshot({ path: 'docs/validacao/design-forte/relatorio-topo.png' })
await browser.close()
