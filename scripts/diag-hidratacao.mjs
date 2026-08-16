/** Por que o menu mobile não responde ao clique? Captura erros do navegador. */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const base = process.argv[2] ?? 'http://localhost:5900'

const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, locale: 'pt-BR' })

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message.slice(0, 400)}`))
page.on('requestfailed', (r) => console.log(`[requestfailed] ${r.url().slice(0, 160)}`))

await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)

const estado = await page.evaluate(() => {
  const b = document.querySelector('.nav-mobile__botao')
  return {
    botaoExiste: !!b,
    ariaExpanded: b?.getAttribute('aria-expanded') ?? null,
    scriptsNext: document.querySelectorAll('script[src*="/_next/static"]').length,
    reactRoot: !!document.querySelector('#__next, [data-reactroot]') || !!window.next,
  }
})
console.log('\nestado:', JSON.stringify(estado, null, 1))

await page.locator('.nav-mobile__botao').click()
await page.waitForTimeout(600)
console.log('apos clique, aria-expanded =', await page.locator('.nav-mobile__botao').getAttribute('aria-expanded'))

await browser.close()
