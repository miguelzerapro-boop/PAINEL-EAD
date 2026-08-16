/**
 * A JORNADA DA COMPRA, CLICADA DE VERDADE
 *
 * Não confere HTML: clica. Cada passo é o que a visitante faria, e o script
 * falha se o passo seguinte não estiver onde deveria.
 *
 *   home → "Ver planos" → rola até os planos → vê os três preços
 *        → clica cada plano → confere o preço no checkout → volta
 *        → "Fazer diagnóstico" → o quiz abre
 *
 * O passo do PREÇO é o que mais importa: ele compara o valor mostrado no
 * cartão com o valor mostrado no checkout. Se um dia a vitrine e a cobrança
 * divergirem, é aqui que aparece.
 *
 *   node scripts/jornada-comercial.mjs [base]
 */

import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok, detalhe })
  console.log(`  [${ok ? 'ok  ' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
const aba = await contexto.newPage()
aba.setDefaultTimeout(45000)

console.log(`\nJORNADA COMERCIAL — ${BASE}\n`)

/* 1. Home ------------------------------------------------------------------ */
const r = await aba.goto(BASE + '/', { waitUntil: 'load' })
registrar('Home abre', r?.status() === 200, `HTTP ${r?.status()}`)

registrar(
  'Logo da marca no topo',
  await aba.locator('.topo .marca__selo').isVisible(),
)

/* 2. CTA principal --------------------------------------------------------- */
const cta = aba.locator('.capa__acoes a.botao--cta')
const rotuloCta = (await cta.textContent())?.trim()
registrar('CTA principal é "Ver planos"', rotuloCta === 'Ver planos', `achei: ${JSON.stringify(rotuloCta)}`)

/* 3. Clicar e rolar até os planos ------------------------------------------ */
await cta.click()
await aba.waitForTimeout(1200)

const secao = aba.locator('#planos')
registrar('Seção #planos existe na home', (await secao.count()) > 0)

const visivel = await secao.evaluate((el) => {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight && r.bottom > 0
})
registrar('"Ver planos" rolou até a seção', visivel)

/* 4. Os três preços na HOME ------------------------------------------------ */
const cartoes = aba.locator('#planos .plano')
const quantos = await cartoes.count()
registrar('Três planos na home', quantos === 3, `${quantos} cartão(ões)`)

const precosHome = await aba.locator('#planos .plano__valor').allTextContents()
const normalizar = (s) => s.replace(/ /g, ' ').trim()
const esperados = ['R$ 29,90', 'R$ 39,90', 'R$ 54,90']

for (const esperado of esperados) {
  registrar(
    `Preço ${esperado} visível na home`,
    precosHome.map(normalizar).includes(esperado),
    precosHome.map(normalizar).join(' · '),
  )
}

/* 5. Comparação sem rolagem lateral no celular ----------------------------- */
const celular = await contexto.newPage()
await celular.setViewportSize({ width: 360, height: 780 })
await celular.goto(BASE + '/', { waitUntil: 'load' })
const rolaLado = await celular.evaluate(() => {
  window.scrollTo(9999, 0)
  const x = window.scrollX
  window.scrollTo(0, 0)
  return x
})
registrar('Home não rola na horizontal em 360px', rolaLado === 0, `scrollX=${rolaLado}`)
await celular.close()

/* 6. Cada plano leva ao checkout com o preço certo -------------------------- */
for (let i = 0; i < quantos; i++) {
  /*
   * Sem o `#planos` aqui: navegar para a MESMA página só trocando o hash é
   * navegação no mesmo documento, e o evento `load` nunca dispara — o script
   * ficava 45s esperando um evento que não vinha. A âncora já foi testada no
   * passo 3; aqui só precisamos da página.
   */
  await aba.goto(BASE + '/', { waitUntil: 'load' })
  const cartao = aba.locator('#planos .plano').nth(i)
  const nome = (await cartao.locator('.plano__nome').textContent())?.trim()
  const preco = normalizar((await cartao.locator('.plano__valor').textContent()) ?? '')

  await cartao.locator('a.plano__cta').click()
  // `waitForURL` em vez de ler `url()` logo depois do clique: o clique só
  // agenda a navegação, e a leitura imediata pegava a página anterior.
  const chegou = await aba
    .waitForURL('**/checkout/**', { timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  await aba.waitForLoadState('load')

  registrar(`"${nome}" abre o checkout`, chegou, aba.url().replace(BASE, ''))

  const totalCheckout = normalizar(
    (await aba.locator('.checkout__total span').last().textContent()) ?? '',
  )
  registrar(
    `Checkout de ${nome} cobra ${preco}`,
    totalCheckout === preco,
    `vitrine ${preco} · checkout ${totalCheckout}`,
  )

  // O pagamento tem que estar visivelmente bloqueado, e o botão desabilitado.
  const aviso = await aba.locator('.aviso').first().textContent().catch(() => '')
  const botao = aba.locator('form button').last()
  registrar(
    `Checkout de ${nome} avisa que o pagamento está indisponível`,
    /indispon|não estão abertas|não habilitado/i.test(aviso ?? ''),
    (aviso ?? '').trim().slice(0, 60),
  )
  registrar(`Botão de pagar desabilitado em ${nome}`, await botao.isDisabled())
}

/* 7. O diagnóstico continua acessível -------------------------------------- */
await aba.goto(BASE + '/', { waitUntil: 'load' })
await aba.locator('.capa__acoes a', { hasText: 'Fazer diagnóstico' }).click()
const abriuQuiz = await aba
  .waitForURL('**/diagnostico**', { timeout: 30000 })
  .then(() => true)
  .catch(() => false)
await aba.waitForLoadState('load')
registrar('"Fazer diagnóstico" abre o quiz', abriuQuiz, aba.url().replace(BASE, ''))

/* 8. E leva de volta para os planos ---------------------------------------- */
await aba.goto(BASE + '/planos', { waitUntil: 'load' })
const planosDireto = await aba.locator('#planos .plano').count()
registrar('/planos mostra os três', planosDireto === 3, `${planosDireto} cartão(ões)`)

await navegador.close()

const falhas = passos.filter((p) => !p.ok).length
console.log(`\n  ${passos.length} passos · ${falhas} falha(s)\n`)
process.exit(falhas ? 1 : 0)
