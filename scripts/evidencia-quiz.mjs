/**
 * EVIDÊNCIA DO QUIZ
 *
 * Cada estado é alcançado CLICANDO no componente real — não há prop de teste
 * nem estado forçado. O limite de múltipla escolha, a validação de avanço, o
 * rascunho e o erro de envio são os do produto.
 *
 * O erro de conexão é produzido abortando a requisição de verdade
 * (`route.abort`), não simulando uma mensagem.
 *
 * Saída: docs/validacao/design-forte/quiz/{1440,834,390,360,estados,acessibilidade}
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const NAV = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const base = process.argv[2] ?? 'http://localhost:5900'
const RAIZ = 'docs/validacao/design-forte/quiz'
const BANCADA = `${base}/estilo/quiz`

const LARGURAS = [
  { nome: '1440', w: 1440, h: 1000 },
  { nome: '834', w: 834, h: 1180 },
  { nome: '390', w: 390, h: 860 },
  { nome: '360', w: 360, h: 780 },
]

const browser = await chromium.launch({ executablePath: NAV.find((c) => existsSync(c)) })
const achados = []

async function novaPagina(v, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    locale: 'pt-BR',
    ...extra,
  })
  const page = await ctx.newPage()
  return { page, ctx }
}

async function semRolagemHorizontal(page, rotulo) {
  const o = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }))
  if (o.s > o.c + 1) achados.push(`ROLAGEM HORIZONTAL em ${rotulo}: ${o.s} > ${o.c}`)
}

/** Leva a bancada até o estado pedido. Só cliques e teclado. */
async function levarAte(page, estado) {
  await page.goto(BANCADA, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  const comecar = page.getByRole('button', { name: 'Começar meu diagnóstico' })

  if (estado === 'inicial') return

  if (estado === 'retomada') {
    // Cria um rascunho de verdade respondendo e recarregando.
    await comecar.click()
    await page.locator('.opcao').first().click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.waitForTimeout(250)
    await page.goto(BANCADA, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    return
  }

  await comecar.click()
  await page.waitForTimeout(350)

  if (estado === 'pergunta-unica') return

  if (estado === 'selecionada') {
    await page.locator('.opcao').first().click()
    await page.waitForTimeout(250)
    return
  }

  if (estado === 'bloqueio') {
    // O botão usa aria-disabled, e o Playwright trata isso como inativo — do
    // mesmo jeito que um leitor de tela. O clique precisa ser forçado.
    await page.getByRole('button', { name: 'Continuar' }).click({ force: true })
    await page.waitForTimeout(250)
    return
  }

  // Daqui para baixo é preciso chegar à pergunta 2 (múltipla escolha).
  await page.locator('.opcao').first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(400)

  if (estado === 'multipla') return

  if (estado === 'limite') {
    for (let i = 0; i < 3; i++) {
      await page.locator('.opcao').nth(i).click()
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(300)
    return
  }

  // Estados finais: percorre até a tela de contato.
  await page.locator('.opcao').first().click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(300)

  for (let i = 0; i < 5; i++) {
    await page.locator('.opcao').first().click()
    await page.waitForTimeout(120)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.waitForTimeout(250)
  }

  if (estado === 'contato') return

  if (estado === 'consentimento-pendente') {
    await page.fill('input[autocomplete="given-name"]', 'Maria')
    await page.fill('input[autocomplete="tel"]', '(11) 99999-0000')
    await page.fill('input[autocomplete="address-level2"]', 'São Paulo')
    await page.selectOption('select.entrada', 'SP')
    await page.waitForTimeout(150)
    // Consentimento desmarcado ⇒ aria-disabled ⇒ clique forçado.
    await page.getByRole('button', { name: 'Ver meu diagnóstico' }).click({ force: true })
    await page.waitForTimeout(300)
    return
  }

  if (estado === 'erro-conexao') {
    await page.fill('input[autocomplete="given-name"]', 'Maria')
    await page.fill('input[autocomplete="tel"]', '(11) 99999-0000')
    await page.fill('input[autocomplete="address-level2"]', 'São Paulo')
    await page.selectOption('select.entrada', 'SP')
    await page.locator('.consentimento input[type="checkbox"]').check()
    await page.waitForTimeout(150)
    // Aborta a requisição real: o estado de erro vem do catch do produto.
    await page.route('**/api/diagnostico', (r) => r.abort('failed'))
    await page.getByRole('button', { name: 'Ver meu diagnóstico' }).click()
    await page.waitForTimeout(900)
    return
  }
}

const ESTADOS = [
  ['01-inicial', 'inicial'],
  ['02-pergunta-unica', 'pergunta-unica'],
  ['03-alternativa-selecionada', 'selecionada'],
  ['04-multipla-escolha', 'multipla'],
  ['05-limite-atingido', 'limite'],
  ['06-retomada', 'retomada'],
  ['07-contato', 'contato'],
  ['08-consentimento-pendente', 'consentimento-pendente'],
  ['09-erro-de-conexao', 'erro-conexao'],
  ['10-bloqueio-explicado', 'bloqueio'],
]

// ------------------------------------------------------------ quatro larguras
for (const v of LARGURAS) {
  await mkdir(`${RAIZ}/${v.nome}`, { recursive: true })
  for (const [nome, estado] of ESTADOS) {
    const { page, ctx } = await novaPagina(v)
    try {
      await levarAte(page, estado)
      await semRolagemHorizontal(page, `${v.nome}/${nome}`)
      await page.screenshot({ path: `${RAIZ}/${v.nome}/${nome}.png` })
      console.log(`ok  ${v.nome}/${nome}`)
    } catch (e) {
      achados.push(`FALHOU ${v.nome}/${nome}: ${e.message.split('\n')[0]}`)
      console.log(`--  ${v.nome}/${nome}: ${e.message.split('\n')[0]}`)
    }
    await page.close()
    await ctx.close()
  }
}

// ------------------------------------------------- estados que dependem de rota
await mkdir(`${RAIZ}/estados`, { recursive: true })
{
  const v = LARGURAS[0]
  for (const [nome, url] of [
    ['11-diagnostico-sem-quiz-publicado', '/diagnostico'],
    ['12-resultado-token-invalido', '/diagnostico/resultado?d=token-que-nao-existe'],
    ['13-resultado-sem-token', '/diagnostico/resultado'],
  ]) {
    const { page, ctx } = await novaPagina(v)
    await page.goto(`${base}${url}`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(500)
    await semRolagemHorizontal(page, nome)
    await page.screenshot({ path: `${RAIZ}/estados/${nome}.png` })
    console.log(`ok  estados/${nome}`)
    await page.close()
    await ctx.close()
  }
}

// -------------------------------------------------------------- acessibilidade
await mkdir(`${RAIZ}/acessibilidade`, { recursive: true })
{
  // Foco por teclado numa alternativa
  const { page, ctx } = await novaPagina(LARGURAS[0])
  await levarAte(page, 'pergunta-unica')
  await page.locator('.opcao').first().focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${RAIZ}/acessibilidade/foco-alternativa.png` })

  const ordem = []
  await page.evaluate(() => document.body.focus())
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    const t = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      return (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 42)
    })
    if (t) ordem.push(t)
  }
  console.log('\n--- ordem de tabulação na pergunta ---')
  console.log('  ' + ordem.join(' > '))

  // Estado com redução de movimento
  await page.close()
  await ctx.close()

  const r = await novaPagina(LARGURAS[0], { reducedMotion: 'reduce' })
  await levarAte(r.page, 'selecionada')
  const opacidade = await r.page.evaluate(() => {
    const el = document.querySelector('.quiz-etapa')
    return el ? Number(getComputedStyle(el).opacity) : 1
  })
  console.log(`--- reducao de movimento: opacidade da etapa = ${opacidade}`)
  if (opacidade < 0.99) achados.push(`Com reduced-motion a etapa ficou translucida (${opacidade}).`)
  await r.page.screenshot({ path: `${RAIZ}/acessibilidade/reducao-de-movimento.png` })
  await r.page.close()
  await r.ctx.close()
}

// ------------------------------------------------------------------- animações
await mkdir(`${RAIZ}/animacoes`, { recursive: true })
{
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 760 },
    locale: 'pt-BR',
    recordVideo: { dir: `${RAIZ}/animacoes`, size: { width: 1100, height: 760 } },
  })
  const page = await ctx.newPage()
  await page.goto(BANCADA, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Começar meu diagnóstico' }).click()
  await page.waitForTimeout(700)
  for (let i = 0; i < 3; i++) {
    await page.locator('.opcao').first().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.waitForTimeout(800)
  }
  const video = page.video()
  await page.close()
  await ctx.close()
  if (video) {
    await video.saveAs(`${RAIZ}/animacoes/transicao-entre-perguntas.webm`)
    await video.delete().catch(() => {})
    console.log('ok  animacoes/transicao-entre-perguntas.webm')
  }
}

await browser.close()

console.log('\n================ ACHADOS ================')
if (achados.length === 0) console.log('nenhum problema automatico detectado')
else achados.forEach((a) => console.log('· ' + a))
