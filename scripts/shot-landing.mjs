import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))
const base = process.argv[2] ?? 'http://localhost:5300'

const browser = await chromium.launch({ executablePath })
await mkdir('screenshots/landing', { recursive: true })

for (const v of [
  { n: 'desktop-1440', w: 1440, h: 2600 },
  { n: 'tablet-834', w: 834, h: 2600 },
  { n: 'mobile-390', w: 390, h: 2400 },
  { n: 'mobile-360', w: 360, h: 2400 },
]) {
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForTimeout(900)

  const o = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }))
  if (o.s > o.c + 1) console.log(`ROLAGEM HORIZONTAL ${v.n}: ${o.s} > ${o.c}`)

  await page.screenshot({ path: `screenshots/landing/${v.n}.png`, fullPage: false })
  console.log('ok', v.n)
  await page.close()
}

await browser.close()
