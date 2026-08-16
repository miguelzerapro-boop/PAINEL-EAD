/**
 * TIRA DE QUADROS DO BRILHO DE LACA
 *
 * Congelar por `animation-delay` negativo não se mostrou confiável aqui: o
 * quadro saía sempre em repouso. Então a faixa é PARADA (animation:none) em
 * posições sucessivas do percurso. Não são quadros cronometrados — são as
 * posições por onde a faixa passa, que é o que interessa para julgar a
 * aparência do acabamento.
 *
 * uso: node scripts/evidencia-laca.mjs <base> <pasta-de-saida>
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const base = process.argv[2] ?? 'http://localhost:5900'
const OUT = process.argv[3] ?? 'docs/validacao/design-forte/animacoes/laca'

const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
await mkdir(OUT, { recursive: true })

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const cta = page.locator('.capa .botao--primario').first()
const bb = await cta.boundingBox()
if (!bb) throw new Error('CTA do heroi nao encontrado')
const clip = { x: bb.x - 12, y: bb.y - 12, width: bb.width + 24, height: bb.height + 24 }

const POSICOES = [0, 60, 120, 180, 240, 300, 360, 420]

for (const p of POSICOES) {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(350)
  await page.addStyleTag({
    content: `.capa .botao--primario::after{
      animation: none !important;
      translate: ${p}% 0 !important;
    }`,
  })
  await page.waitForTimeout(180)
  await page.screenshot({ path: `${OUT}/pos-${String(p).padStart(3, '0')}.png`, clip })
  console.log(`ok  translate ${p}%`)
}

// repouso real, sem nenhuma intervenção
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2600)
await page.screenshot({ path: `${OUT}/repouso.png`, clip })
console.log('ok  repouso')

await browser.close()
