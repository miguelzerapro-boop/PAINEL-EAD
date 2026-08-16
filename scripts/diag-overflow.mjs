/** Encontra a origem do estouro horizontal, subindo a cadeia de elementos. */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3117'
const alvos = [
  { path: '/estilo/telas/aluna', width: 360 },
  { path: '/estilo/telas/aluna', width: 390 },
  { path: '/estilo', width: 834 },
  { path: '/estilo/telas/vendas', width: 360 },
  { path: '/estilo/telas/curso', width: 360 },
  { path: '/estilo/telas/aula', width: 360 },
  { path: '/estilo/telas/quiz', width: 360 },
  { path: '/estilo/telas/admin', width: 360 },
  { path: '/estilo/telas/resultado', width: 360 },
]

const exe = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync)

const browser = await chromium.launch({ executablePath: exe })

for (const alvo of alvos) {
  const ctx = await browser.newContext({ viewport: { width: alvo.width, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${base}${alvo.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  const r = await page.evaluate((largura) => {
    const html = document.documentElement
    const info = {
      scroll: html.scrollWidth,
      client: html.clientWidth,
      body: document.body.getBoundingClientRect().width,
      bodyScroll: document.body.scrollWidth,
      cadeia: [],
    }
    if (info.scroll <= info.client + 1) return info

    // Elemento mais profundo que ultrapassa a viewport
    let pior = null
    for (const el of document.querySelectorAll('*')) {
      const box = el.getBoundingClientRect()
      if (box.right > largura + 1) {
        if (!pior || el.contains(pior) === false) pior = el
      }
    }
    let atual = pior
    while (atual && atual !== html) {
      const box = atual.getBoundingClientRect()
      const cs = getComputedStyle(atual)
      info.cadeia.push({
        tag: atual.tagName.toLowerCase(),
        classe: (atual.className || '').toString().slice(0, 40),
        w: Math.round(box.width),
        scrollW: atual.scrollWidth,
        overflowX: cs.overflowX,
        padding: cs.paddingInlineStart + '/' + cs.paddingInlineEnd,
        margin: cs.marginInlineStart + '/' + cs.marginInlineEnd,
        display: cs.display,
        minW: cs.minWidth,
      })
      atual = atual.parentElement
    }
    return info
  }, alvo.width)

  console.log(`\n${alvo.path} @ ${alvo.width} → scroll ${r.scroll} / client ${r.client} / body ${r.body} (scrollW ${r.bodyScroll})`)
  for (const c of r.cadeia.slice(0, 10)) {
    console.log(
      `   <${c.tag} class="${c.classe}"> w=${c.w} scrollW=${c.scrollW} ovf=${c.overflowX} pad=${c.padding} mar=${c.margin} disp=${c.display} minW=${c.minW}`,
    )
  }
  await ctx.close()
}

await browser.close()
