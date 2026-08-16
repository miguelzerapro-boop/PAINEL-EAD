/**
 * Captura de telas para a crítica visual.
 *
 *   node scripts/screenshots.mjs [baseUrl] [sufixo]
 *
 * Usa um Chrome/Edge JÁ INSTALADO — o download do Chromium do Playwright é
 * bloqueado neste ambiente.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4900'
const sufixo = process.argv[3] ?? 'atual'

const NAVEGADORES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

const executablePath = NAVEGADORES.find((c) => existsSync(c))
if (!executablePath) {
  console.error('Nenhum Chrome ou Edge encontrado.')
  process.exit(1)
}

/**
 * Alturas generosas + `fullPage: false`.
 *
 * `fullPage: true` corrompe o layout de elementos `position: sticky` com
 * `height: 100dvh`: o menu de 216px era capturado com 120px e os rótulos
 * apareciam quebrados letra por letra. Medido — no navegador real ele nunca
 * sai de 216px. Viewport alto captura a página inteira sem o artefato.
 */
const VIEWPORTS = [
  { nome: 'desktop-1440', width: 1440, height: 2200 },
  { nome: 'notebook-1280', width: 1280, height: 2000 },
  { nome: 'tablet-834', width: 834, height: 2000 },
  { nome: 'mobile-390', width: 390, height: 1800 },
  { nome: 'mobile-360', width: 360, height: 1800 },
]

const ROTAS = [
  { nome: '01-aluna', path: '/estilo/telas/aluna' },
  { nome: '02-aula', path: '/estilo/telas/aula' },
  { nome: '03-curso', path: '/estilo/telas/curso' },
  { nome: '04-biblioteca', path: '/estilo/telas/biblioteca' },
  { nome: '05-comunidade', path: '/estilo/telas/comunidade' },
  { nome: '06-mensagens', path: '/estilo/telas/mensagens' },
  { nome: '07-atividades', path: '/estilo/telas/atividades' },
  { nome: '08-certificados', path: '/estilo/telas/certificados' },
  { nome: '09-perfil', path: '/estilo/telas/perfil' },
  { nome: '10-admin', path: '/estilo/telas/admin' },
  { nome: '11-quiz', path: '/estilo/telas/quiz' },
  { nome: '12-vendas', path: '/estilo/telas/vendas' },
  { nome: '13-design-system', path: '/estilo' },
  { nome: '14-entrar', path: '/entrar' },
  { nome: '15-404', path: '/rota-que-nao-existe' },
]

const destino = `screenshots/${sufixo}`
await mkdir(destino, { recursive: true })

const browser = await chromium.launch({ executablePath })
const problemas = []

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  })
  const page = await context.newPage()

  for (const rota of ROTAS) {
    try {
      await page.goto(`${base}${rota.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('load').catch(() => {})
      await page.waitForTimeout(500)

      // Rolagem horizontal — o escopo pede explicitamente.
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      if (overflow.scroll > overflow.client + 1) {
        problemas.push(
          `ROLAGEM HORIZONTAL: ${rota.path} @ ${viewport.nome} (${overflow.scroll} > ${overflow.client})`,
        )
      }

      // Alvos de toque pequenos demais no celular.
      if (viewport.width <= 390) {
        const pequenos = await page.evaluate(() => {
          const alvos = [...document.querySelectorAll('a, button, input, select, textarea')]
          return alvos.filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.height < 32
          }).length
        })
        if (pequenos > 0) {
          problemas.push(`ALVOS < 32px: ${rota.path} @ ${viewport.nome} → ${pequenos}`)
        }
      }

      await page.screenshot({ path: `${destino}/${rota.nome}-${viewport.nome}.png`, fullPage: false })
    } catch (erro) {
      problemas.push(`FALHA: ${rota.path} @ ${viewport.nome} — ${erro.message}`)
    }
  }

  await context.close()
  console.log(`ok ${viewport.nome}`)
}

await browser.close()

console.log(`\nCapturas em ./${destino}`)
if (problemas.length) {
  console.log('\nPROBLEMAS DETECTADOS:')
  for (const p of problemas) console.log(`  · ${p}`)
} else {
  console.log('Nenhum problema automático detectado.')
}
