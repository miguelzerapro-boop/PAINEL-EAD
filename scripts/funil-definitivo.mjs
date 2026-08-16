/**
 * O FUNIL DEFINITIVO, CLICADO DO COMEÇO
 *
 *   QUIZ → RESULTADO → LANDING COM PLANOS → CHECKOUT
 *
 * A entrada é /diagnostico, que é o link da campanha — não a home. O script
 * entra com UTMs, responde o quiz inteiro, preenche os dados, chega no
 * resultado, segue para a landing e escolhe um plano.
 *
 * DUAS COISAS QUE SÓ ESTE TESTE PEGA:
 *
 *   · A UTM SOBREVIVE? Ela entra em /diagnostico e precisa continuar viva no
 *     evento de checkout, três páginas depois. Se sumir, a campanha inteira
 *     parece não converter.
 *
 *   · O PREÇO DA VITRINE É O PREÇO COBRADO? Compara o valor do cartão com o
 *     total do checkout.
 *
 *   node scripts/funil-definitivo.mjs [base] [plano]
 */

import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const PLANOS = process.argv[3] ? [process.argv[3]] : ['iniciante', 'profissional', 'completo']

const UTM =
  '?utm_source=teste_funil&utm_medium=e2e&utm_campaign=jornada_definitiva&utm_content=variante_a'

const normalizar = (s) => (s ?? '').replace(/ /g, ' ').trim()

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok })
  console.log(`  [${ok ? 'ok  ' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

const navegador = await chromium.launch()

let jornada = 0

for (const plano of PLANOS) {
  /*
   * PAUSA ENTRE JORNADAS.
   *
   * `/api/diagnostico` aceita 10 envios por IP a cada 10 minutos. Rodar as
   * três seguidas, somadas às execuções anteriores, estoura o limite e a
   * terceira falha — o que parece defeito do funil e é a proteção
   * funcionando. A pausa mantém o teste dentro do orçamento de envios.
   */
  if (jornada++ > 0) {
    console.log('\n  (pausa de 20s para não esbarrar no limite de envios)')
    await new Promise((r) => setTimeout(r, 20000))
  }

  console.log(`\n─── JORNADA: ${plano.toUpperCase()} ───\n`)

  // Contexto novo por jornada: sessionStorage limpo, como uma pessoa nova.
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const aba = await contexto.newPage()
  aba.setDefaultTimeout(45000)

  /* Captura o que o site manda para /api/eventos, para conferir a UTM. */
  const eventos = []
  await aba.route('**/api/eventos', async (rota) => {
    try {
      eventos.push(JSON.parse(rota.request().postData() ?? '{}'))
    } catch {
      /* corpo ilegível: não é o que estamos medindo */
    }
    await rota.continue()
  })

  /* 1. O link da campanha ------------------------------------------------- */
  const r = await aba.goto(BASE + '/diagnostico' + UTM, { waitUntil: 'load' })
  registrar('Link de campanha abre o quiz', r?.status() === 200, `HTTP ${r?.status()}`)

  /* 2. Começar ------------------------------------------------------------ */
  await aba.getByRole('button', { name: /começar meu diagnóstico/i }).click()
  await aba.waitForTimeout(1200)

  /*
   * 3. Responder tudo
   *
   * A alternativa é um <button class="opcao"> — não um label nem um radio. A
   * primeira versão deste script procurava por `.quiz-opcao` e `fieldset
   * label`, não achava nada e concluía que o quiz não abria. O quiz estava
   * certo; o seletor é que era inventado.
   */
  let respondidas = 0
  for (let volta = 0; volta < 25; volta++) {
    if (aba.url().includes('/resultado')) break

    const opcoes = aba.locator('button.opcao')
    if ((await opcoes.count()) > 0) {
      await opcoes.first().click()
      await aba.waitForTimeout(250)

      const continuar = aba.getByRole('button', { name: /^(continuar|finalizar|ver meu)/i }).first()
      if (await continuar.count()) await continuar.click().catch(() => {})

      respondidas++
      await aba.waitForTimeout(600)
      continue
    }

    // Sem alternativa na tela: ou é o formulário de dados, ou o resultado.
    if ((await aba.locator('input[type="email"]').count()) > 0) break
    await aba.waitForTimeout(400)
  }
  registrar('Respondeu as perguntas', respondidas >= 7, `${respondidas} pergunta(s)`)

  /*
   * 4. Dados da lead
   *
   * O formulário pede primeiro nome, WhatsApp, cidade, estado, e-mail e a
   * autorização de contato. O `autocomplete` é o seletor estável aqui: os
   * campos não têm `name`, e depender da ordem quebraria ao inserir um campo
   * novo.
   */
  if ((await aba.locator('input[type="email"]').count()) > 0) {
    const carimbo = Date.now()

    await aba.locator('input[autocomplete="given-name"]').first().fill('Teste')
    await aba.locator('input[autocomplete="tel"]').first().fill('34988887777')
    await aba.locator('input[autocomplete="address-level2"]').first().fill('Uberlândia')
    await aba.locator('select').first().selectOption('MG').catch(() => {})
    await aba.locator('input[type="email"]').first().fill(`teste.funil.${carimbo}@exemplo.com`)

    const aceites = aba.locator('input[type="checkbox"]')
    for (let i = 0; i < (await aceites.count()); i++) {
      await aceites.nth(i).check().catch(() => {})
    }

    await aba.getByRole('button', { name: /ver meu diagnóstico/i }).click()
    await aba.waitForURL('**/resultado**', { timeout: 60000 }).catch(() => {})
  }

  const noResultado = aba.url().includes('/resultado')
  registrar('Chegou no resultado', noResultado, aba.url().replace(BASE, '').slice(0, 60))

  if (!noResultado) {
    await contexto.close()
    continue
  }

  /* 5. Resultado → landing comercial -------------------------------------- */
  const ctaResultado = aba.locator('a').filter({ hasText: /ver planos e preços/i }).first()
  registrar('Resultado oferece "Ver planos e preços"', (await ctaResultado.count()) > 0)

  await ctaResultado.click()
  const naLanding = await aba
    .waitForURL('**/planos**', { timeout: 45000 })
    .then(() => true)
    .catch(() => false)
  registrar('CTA leva à landing comercial', naLanding, aba.url().replace(BASE, '').slice(0, 40))

  /* O token do diagnóstico precisa ter viajado junto. */
  registrar('Token do diagnóstico preservado na landing', aba.url().includes('d='))

  /* 6. Os três planos, sem novo formulário -------------------------------- */
  const cartoes = aba.locator('#planos .plano')
  registrar('Landing mostra os três planos', (await cartoes.count()) === 3, `${await cartoes.count()}`)

  /* 7. Escolher o plano da vez -------------------------------------------- */
  const cartao = aba.locator(`#planos .plano:has(a[href*="/checkout/${plano}"])`)
  const preco = normalizar(await cartao.locator('.plano__valor').textContent())
  await cartao.locator('a.plano__cta').click()

  const noCheckout = await aba
    .waitForURL(`**/checkout/${plano}**`, { timeout: 45000 })
    .then(() => true)
    .catch(() => false)
  registrar(`Abre /checkout/${plano}`, noCheckout, aba.url().replace(BASE, '').slice(0, 50))

  const total = normalizar(await aba.locator('.checkout__total span').last().textContent())
  registrar(`Checkout cobra o preço da vitrine`, total === preco, `vitrine ${preco} · checkout ${total}`)

  /* 8. O campo de senha existe -------------------------------------------- */
  registrar(
    'Checkout pede senha (login por e-mail e senha)',
    (await aba.locator('input[autocomplete="new-password"]').count()) > 0,
  )

  /* 9. A UTM sobreviveu a três páginas ------------------------------------ */
  await aba.waitForTimeout(1500)
  const comUtm = eventos.filter((e) => e?.utm?.utm_source === 'teste_funil')
  const noCheckoutEvento = eventos.find((e) => e?.nome === 'checkout_start')

  registrar(
    'UTM presente nos eventos do funil',
    comUtm.length > 0,
    `${comUtm.length} de ${eventos.length} evento(s)`,
  )
  registrar(
    'UTM chegou até o evento de checkout',
    noCheckoutEvento?.utm?.utm_source === 'teste_funil',
    JSON.stringify(noCheckoutEvento?.utm ?? null),
  )

  await contexto.close()
}

await navegador.close()

const falhas = passos.filter((p) => !p.ok).length
console.log(`\n  ${passos.length} passos · ${falhas} falha(s)\n`)
process.exit(falhas ? 1 : 0)
