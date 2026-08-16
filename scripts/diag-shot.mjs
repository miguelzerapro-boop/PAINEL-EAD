import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))

const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const medir = () =>
  page.evaluate(() => ({
    menu: Math.round(document.querySelector('.menu').getBoundingClientRect().width),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    mediaOk: window.matchMedia('(min-width: 1024px)').matches,
  }))

await page.goto('http://localhost:5200/estilo/telas/aluna', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)

console.log('antes          :', await medir())
await page.screenshot({ path: 'screenshots/teste-viewport.png', fullPage: false })
console.log('após viewport  :', await medir())
await page.screenshot({ path: 'screenshots/teste-fullpage.png', fullPage: true })
console.log('após fullPage  :', await medir())

// Viewport alto + fullPage:false — alternativa à captura de página inteira.
await page.setViewportSize({ width: 1440, height: 2400 })
await page.waitForTimeout(400)
console.log('viewport alto  :', await medir())
await page.screenshot({ path: 'screenshots/teste-alto.png', fullPage: false })
console.log('após alto      :', await medir())

await browser.close()
