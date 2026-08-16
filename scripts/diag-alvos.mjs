import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4900'
const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))

const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 360, height: 780 } })

for (const rota of ['/estilo/telas/aula', '/estilo/telas/curso', '/estilo/telas/admin', '/entrar']) {
  await page.goto(`${base}${rota}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  const alvos = await page.evaluate(() => {
    return [...document.querySelectorAll('a, button, input, select, textarea')]
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 40) ?? '',
          txt: (el.textContent ?? '').trim().slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height),
          visivel: r.width > 0 && r.height > 0,
        }
      })
      .filter((e) => e.visivel && e.h < 32)
  })

  console.log(`\n${rota}`)
  for (const a of alvos) console.log(`   <${a.tag} class="${a.cls}"> ${a.w}x${a.h} :: ${a.txt}`)
}

await browser.close()
