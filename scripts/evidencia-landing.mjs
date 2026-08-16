/**
 * EVIDÊNCIA VISUAL DA LANDING
 *
 * Gera, em docs/validacao/design-forte/landing/:
 *   · página inteira em 1440 / 834 / 390 / 360
 *   · dobra em cada largura
 *   · recortes: mostruário do herói, faixa, como funciona, momentos, CTA final
 *   · menu mobile fechado E aberto
 *   · estado de foco do CTA (via teclado, para valer :focus-visible)
 *   · estado com prefers-reduced-motion: reduce
 *   · vaga de foto em modo de revisão
 *
 * Página inteira é feita com viewport alto e fullPage:false de propósito:
 * fullPage:true quebra sticky e 100dvh e produziria captura mentirosa.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = NAV.find((c) => existsSync(c))
const base = process.argv[2] ?? 'http://localhost:5900'
const OUT = 'docs/validacao/design-forte/landing'

/** Paleta anterior, transcrita de docs/10-direcao-visual.md (linhas 184-195). */
const PALETA_ANTIGA = `:root{
  --brand-primary:#5B1A2E; --brand-deep:#5B1A2E; --brand-secondary:#2A2E2B;
  --brand-accent:#A8232E;  --brand-action:#A8232E; --brand-action-hover:#8d1d26;
  --brand-action-solida:#A8232E; --brand-action-solida-hover:#8d1d26;
  --brand-action-texto:#A8232E;
  --surface-main:#F5F1EA; --surface-soft:#FBF9F5; --surface-strong:#1C1A19;
  --surface-brand:#5B1A2E; --surface-sunken:#EDE7DC;
  --text-primary:#1C1A19; --text-secondary:#5A534E;
  --border-subtle:#E0D8CC; --border-strong:#b3a99c;
  --success:#2F6B4F; --warning:#8A5A12; --error:#A32218;
  --size-display:clamp(2.5rem, 1.5rem + 3.4vw, 3.5rem);
}`

const browser = await chromium.launch({ executablePath })
await mkdir(OUT, { recursive: true })

const problemas = []
const log = (m) => console.log(m)

async function paginaInteira(w, nome) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'pt-BR' })
  let page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(600)
  const alturaTotal = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.close()

  const h = Math.min(Math.ceil(alturaTotal) + 40, 12000)
  page = await ctx.newPage()
  await page.setViewportSize({ width: w, height: h })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1600)

  const o = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }))
  if (o.s > o.c + 1) problemas.push(`ROLAGEM HORIZONTAL em ${nome}: ${o.s} > ${o.c}`)

  await page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: false })
  log(`ok  ${nome}  (${w}x${h})`)
  await page.close()
  await ctx.close()
}

for (const [w, nome] of [
  [1440, '01-completa-1440'],
  [834, '02-completa-834'],
  [390, '03-completa-390'],
  [360, '04-completa-360'],
]) {
  await paginaInteira(w, nome)
}

// ---------------------------------------------------------------- acima da dobra
for (const [w, h, nome] of [
  [1440, 900, '05-dobra-1440'],
  [834, 1112, '06-dobra-834'],
  [390, 844, '07-dobra-390'],
  [360, 740, '08-dobra-360'],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/${nome}.png` })
  log(`ok  ${nome}  (dobra ${w}x${h})`)
  await page.close()
}

// ---------------------------------------------------------------- recortes
const SECOES = [
  ['.capa__mostruario', '09-mostruario-do-heroi', 1440],
  ['.faixa-marca', '10-faixa-jeito-comum-x-aqui', 1440],
  ['#como-funciona', '11-como-funciona', 1440],
  ['.momentos-composicao', '12-momentos', 1440],
  ['.bancada', '13-bancada-vaga-de-foto', 1440],
  ['.fechamento', '14-cta-final', 1440],
  ['.capa__mostruario', '15-mostruario-360', 360],
]

for (const [sel, nome, larg] of SECOES) {
  const page = await browser.newPage({ viewport: { width: larg, height: 1500 }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1600)
  const alvo = page.locator(sel).first()
  if ((await alvo.count()) === 0) {
    problemas.push(`SELETOR NAO ENCONTRADO: ${sel} (${nome})`)
    log(`--  ${nome}: seletor nao encontrado`)
  } else {
    // As animações de entrada usam `animation-timeline: view()`: o progresso
    // depende da posição de rolagem, não do tempo. Sem levar a seção bem para
    // dentro da tela, o recorte sai com a palheta a meio caminho — foi o que
    // aconteceu na primeira rodada.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await alvo.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -60))
    await page.waitForTimeout(1200)
    await alvo.screenshot({ path: `${OUT}/${nome}.png` })
    log(`ok  ${nome}`)
  }
  await page.close()
}

// ---------------------------------------------------------------- menu mobile
{
  const page = await browser.newPage({ viewport: { width: 390, height: 700 }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(900)

  const botao = page.locator('.nav-mobile__botao')
  if ((await botao.count()) === 0) {
    problemas.push('NAO EXISTE BOTAO DE MENU MOBILE.')
    log('--  menu mobile: botao ausente')
  } else {
    await page.screenshot({ path: `${OUT}/16-menu-mobile-fechado.png`, clip: { x: 0, y: 0, width: 390, height: 120 } })

    const antes = await botao.getAttribute('aria-expanded')
    await botao.click()
    await page.waitForTimeout(400)
    const depois = await botao.getAttribute('aria-expanded')
    await page.screenshot({ path: `${OUT}/17-menu-mobile-aberto.png`, clip: { x: 0, y: 0, width: 390, height: 420 } })
    log(`--  aria-expanded: ${antes} -> ${depois}`)
    if (antes !== 'false' || depois !== 'true') problemas.push('aria-expanded nao alterna corretamente.')

    // rolagem de fundo travada?
    const travada = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden')
    if (!travada) problemas.push('Rolagem de fundo NAO esta travada com o menu aberto.')

    // foco entrou no painel?
    const focoNoPainel = await page.evaluate(
      () => !!document.activeElement?.closest('.nav-mobile__painel'),
    )
    if (!focoNoPainel) problemas.push('O foco nao entrou no painel ao abrir.')

    // Escape fecha e devolve o foco
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const fechou = (await botao.getAttribute('aria-expanded')) === 'false'
    const focoNoBotao = await page.evaluate(
      () => document.activeElement?.classList.contains('nav-mobile__botao') ?? false,
    )
    log(`--  Escape fecha: ${fechou}   foco volta ao botao: ${focoNoBotao}   fundo travado: ${travada}   foco no painel: ${focoNoPainel}`)
    if (!fechou) problemas.push('Escape nao fecha o menu.')
    if (!focoNoBotao) problemas.push('O foco nao volta ao botao ao fechar com Escape.')

    const destravada = await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden')
    if (!destravada) problemas.push('A rolagem de fundo continuou travada apos fechar.')
  }
  await page.close()
}

// ---------------------------------------------------------------- foco do CTA
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)

  let achou = false
  const trilha = []
  for (let i = 0; i < 12 && !achou; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      return el ? { txt: (el.textContent || '').trim().slice(0, 40) } : null
    })
    if (info) trilha.push(info.txt)
    if (info && info.txt.startsWith('Descobrir meu momento')) achou = true
  }
  log(`--  ordem de tabulacao: ${trilha.join(' > ')}`)
  if (!achou) problemas.push('Nao foi possivel alcancar o CTA do heroi com 12 Tabs.')

  const cta = page.locator('.capa .botao--primario').first()
  const bb = await cta.boundingBox()
  if (bb) {
    await page.screenshot({
      path: `${OUT}/18-foco-cta.png`,
      clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 24), width: bb.width + 48, height: bb.height + 48 },
    })
    log('ok  18-foco-cta')
  }
  await page.close()
}

// ---------------------------------------------------------------- redução de movimento
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(300)

  const invisiveis = await page.evaluate(() => {
    const alvos = [
      ...document.querySelectorAll('.capa__titulo, .capa__apoio, .capa .botao, .palheta, .trilho'),
    ]
    return alvos
      .map((el) => ({ t: (el.textContent || '').trim().slice(0, 26), o: getComputedStyle(el).opacity }))
      .filter((x) => Number(x.o) < 0.99)
  })
  if (invisiveis.length > 0) {
    problemas.push(
      `Com reduced-motion, ${invisiveis.length} elemento(s) translucidos apos 300ms: ` +
        invisiveis.map((x) => `"${x.t}"=${x.o}`).join(', '),
    )
  }
  log(`--  reduced-motion: ${invisiveis.length} elemento(s) abaixo de opacidade 1 apos 300ms`)

  await page.screenshot({ path: `${OUT}/19-reducao-movimento-1440.png` })
  log('ok  19-reducao-movimento-1440')
  await page.close()
  await ctx.close()
}

// ---------------------------------------------------------------- vaga de foto em revisão
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, locale: 'pt-BR' })
  await page.goto(`${base}/?revisao=1`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  const alvo = page.locator('.vaga-foto').first()
  if ((await alvo.count()) > 0) {
    await alvo.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    await alvo.screenshot({ path: `${OUT}/20-vaga-foto-revisao.png` })
    log('ok  20-vaga-foto-revisao')
  } else {
    problemas.push('Vaga de foto nao encontrada.')
  }
  await page.close()
}

// ---------------------------------------------------------------- A/B de paleta
for (const [nome, css] of [
  ['21-ab-paleta-ANTIGA', PALETA_ANTIGA],
  ['22-ab-paleta-ATUAL', null],
]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 45000 })
  if (css) await page.addStyleTag({ content: css })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${OUT}/${nome}.png` })
  log(`ok  ${nome}`)
  await page.close()
}

await browser.close()

console.log('\n================ ACHADOS ================')
if (problemas.length === 0) console.log('nenhum problema automatico detectado')
else problemas.forEach((p) => console.log('· ' + p))
