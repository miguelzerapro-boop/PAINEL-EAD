/**
 * Alvos de toque pequenos demais.
 *
 *   node scripts/diag-alvos-toque.mjs [baseUrl]
 *
 * Lista todo elemento interativo com menos de 44 px de altura ou largura no
 * viewport de celular, identificando classe e texto — para que a correção mire
 * o elemento certo em vez de inflar tudo.
 *
 * 44 px é o alvo confortável recomendado; 32 px é o piso abaixo do qual o erro
 * de toque fica frequente. O relatório separa os dois.
 */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3117'

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

const ROTAS = [
  '/entrar',
  '/rota-que-nao-existe',
  '/estilo',
  '/estilo/telas/aluna',
  '/estilo/telas/aula',
  '/estilo/telas/curso',
  '/estilo/telas/formacao',
  '/estilo/telas/nova-aula',
  '/estilo/telas/upload',
  '/estilo/telas/admin',
  '/estilo/telas/quiz',
]

/*
 * `toque: true` emula ponteiro grosso — é o que faz as regras de alvo
 * confortável valerem. Sem isso o navegador é tratado como mouse e a medição
 * não reflete o celular de verdade.
 */
const VIEWPORTS = [
  { nome: 'mobile-360', width: 360, height: 1600, toque: true },
  { nome: 'mobile-390', width: 390, height: 1600, toque: true },
  { nome: 'tablet-834', width: 834, height: 1400, toque: true },
  { nome: 'desktop-1440', width: 1440, height: 1200, toque: false },
]

const browser = await chromium.launch({ executablePath })
const achados = new Map()

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.toque,
    locale: 'pt-BR',
  })
  const page = await context.newPage()

  for (const rota of ROTAS) {
    try {
      await page.goto(`${base}${rota}`, { waitUntil: 'load', timeout: 20000 })
      await page.waitForTimeout(250)
    } catch {
      continue
    }

    const pequenos = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')]
      return alvos
        .map((el) => {
          const r = el.getBoundingClientRect()
          const estilo = getComputedStyle(el)

          /*
           * Alguns alvos crescem por pseudo-elemento: o quadrado continua
           * pequeno aos olhos e a área de toque fica em 44px. Medir só o
           * retângulo do elemento acusaria falso positivo. Então se pergunta
           * ao navegador quem responde ao toque nas quatro bordas de um
           * quadrado de 44px centrado no elemento.
           */
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const alcance = 21
          const areaExpandida = [
            [cx, cy - alcance],
            [cx, cy + alcance],
            [cx - alcance, cy],
            [cx + alcance, cy],
          ].every(([x, y]) => {
            const alvo = document.elementFromPoint(x, y)
            return alvo === el || el.contains(alvo)
          })
          // Link dentro de parágrafo tem tratamento próprio: aumentar a caixa
          // quebraria a entrelinha do texto corrido.
          const dentroDeTexto = Boolean(el.closest('p, li, label, .prose, .lead'))
          return {
            tag: el.tagName.toLowerCase(),
            classe: String(el.className ?? '').slice(0, 60),
            texto: (el.textContent ?? '').trim().slice(0, 45),
            w: Math.round(r.width),
            h: Math.round(r.height),
            display: estilo.display,
            dentroDeTexto,
            areaExpandida,
          }
        })
        // Alvo com área expandida por pseudo-elemento já está resolvido.
        .filter((x) => x.w > 0 && x.h > 0 && (x.h < 44 || x.w < 44) && !x.areaExpandida)
    })

    for (const p of pequenos) {
      const chave = `${p.tag}.${p.classe}|${p.texto}`
      if (!achados.has(chave)) {
        achados.set(chave, { ...p, rotas: new Set(), viewports: new Set(), menorH: p.h })
      }
      const a = achados.get(chave)
      a.rotas.add(rota)
      a.viewports.add(vp.nome)
      a.menorH = Math.min(a.menorH, p.h)
    }
  }

  await context.close()
}

await browser.close()

const lista = [...achados.values()].sort((a, b) => a.menorH - b.menorH)

const criticos = lista.filter((x) => x.menorH < 32 && !x.dentroDeTexto)
const confortaveis = lista.filter((x) => x.menorH >= 32 && x.menorH < 44 && !x.dentroDeTexto)
const emTexto = lista.filter((x) => x.dentroDeTexto)

function imprimir(titulo, itens) {
  console.log(`\n=== ${titulo} (${itens.length}) ===`)
  for (const x of itens) {
    console.log(
      `  ${x.tag} ${x.menorH}px alt · ${x.w}px larg · display:${x.display}\n` +
        `     classe: "${x.classe}"\n` +
        `     texto:  "${x.texto}"\n` +
        `     rotas:  ${[...x.rotas].slice(0, 3).join(', ')}${x.rotas.size > 3 ? ` (+${x.rotas.size - 3})` : ''}`,
    )
  }
}

imprimir('CRÍTICO — abaixo de 32px', criticos)
imprimir('ABAIXO DO CONFORTÁVEL — 32 a 43px', confortaveis)
imprimir('LINKS EM TEXTO CORRIDO — tratamento próprio', emTexto)

if (criticos.length > 0) process.exitCode = 1
