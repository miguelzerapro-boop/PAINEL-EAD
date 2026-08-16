import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5100'
const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`${base}/estilo/telas/aluna`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)

const info = await page.evaluate(() => {
  const menu = document.querySelector('.menu')
  const shell = document.querySelector('.app-shell')
  if (!menu || !shell) return { erro: 'nao encontrado' }
  const cs = getComputedStyle(menu)
  const css = getComputedStyle(shell)
  return {
    menuLargura: menu.getBoundingClientRect().width,
    widthDeclarado: cs.width,
    position: cs.position,
    varLargura: cs.getPropertyValue('--menu-largura'),
    recolhido: menu.getAttribute('data-recolhido'),
    shellColunas: css.gridTemplateColumns,
    shellDisplay: css.display,
  }
})

console.log(info)
await browser.close()
