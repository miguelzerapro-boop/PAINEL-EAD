/**
 * Teste sem ambiguidade: a faixa de brilho chega a pintar?
 *
 * A faixa é parada sobre o centro do botão e pintada de BRANCO OPACO. Se nem
 * assim ela aparecer, o pseudo-elemento não está sendo desenhado — e aí o
 * "brilho de laca" é um recurso que existe só no CSS, não na tela.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const base = process.argv[2] ?? 'http://localhost:5900'
const OUT = 'docs/validacao/design-forte/animacoes/laca-diagnostico'

const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
await mkdir(OUT, { recursive: true })

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

const cta = page.locator('.capa .botao--primario').first()
const bb = await cta.boundingBox()
const clip = { x: bb.x - 12, y: bb.y - 12, width: bb.width + 24, height: bb.height + 24 }

const CASOS = [
  ['A-sem-a-faixa', 'display:none'],
  ['B-faixa-branca-zindex--1', 'background:#fff; z-index:-1'],
  ['C-faixa-branca-zindex-1', 'background:#fff; z-index:1'],
]

/*
 * Recarrega entre os casos de propósito: addStyleTag empilha folhas, e um
 * `display:none !important` do caso anterior sobreviveria aos seguintes,
 * fazendo os três quadros saírem iguais por motivo errado.
 */
for (const [nome, regra] of CASOS) {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.addStyleTag({
    content: `.capa .botao--primario::after{
      animation: none !important;
      translate: 150% 0 !important;
      ${regra} !important;
    }`,
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/${nome}.png`, clip })
  console.log(`ok  ${nome}`)
}

await browser.close()
