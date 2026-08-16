/**
 * CAPTURAS DA MARCA
 *
 * Prova visual do cabeçalho novo, da assinatura na landing e da página de
 * planos — desktop e celular.
 *
 * Também mede duas coisas que screenshot nenhuma prova sozinha:
 *
 *   · ROLAGEM HORIZONTAL. Em 360px é o defeito mais comum e o mais invisível
 *     numa captura recortada.
 *   · A SEÇÃO REMOVIDA. Confere que "O jeito comum / Aqui" não sobrou no DOM.
 *
 * Uso: node scripts/capturas-marca.mjs [http://localhost:3000]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const SAIDA = 'docs/validacao/capturas/marca'

const TELAS = [
  { nome: 'desktop', width: 1440, height: 900, dpr: 2 },
  { nome: 'tablet', width: 834, height: 1112, dpr: 2 },
  { nome: 'celular', width: 390, height: 844, dpr: 3 },
  { nome: 'celular-360', width: 360, height: 780, dpr: 3 },
]

const PAGINAS = [
  { nome: 'landing', url: '/' },
  { nome: 'planos', url: '/planos' },
  /*
   * O checkout entra aqui de propósito: é onde o portão de venda aparece.
   * A tela precisa continuar NAVEGÁVEL e legível com o pagamento bloqueado —
   * é isso que a captura prova.
   */
  { nome: 'checkout-iniciante', url: '/checkout/iniciante', apenas: ['desktop', 'celular'] },
  { nome: 'checkout-completo', url: '/checkout/completo', apenas: ['desktop', 'celular'] },
]

const relatorio = []

await mkdir(SAIDA, { recursive: true })

const navegador = await chromium.launch()

for (const tela of TELAS) {
  const contexto = await navegador.newContext({
    viewport: { width: tela.width, height: tela.height },
    deviceScaleFactor: tela.dpr,
    isMobile: tela.width < 700,
    hasTouch: tela.width < 700,
  })

  for (const pagina of PAGINAS) {
    if (pagina.apenas && !pagina.apenas.includes(tela.nome)) continue

    const aba = await contexto.newPage()
    const resposta = await aba.goto(BASE + pagina.url, { waitUntil: 'networkidle' })

    // Fontes carregadas antes de fotografar: senão a captura pega o fallback
    // e a assinatura sai com a métrica errada.
    await aba.evaluate(() => document.fonts.ready)

    /*
     * ACORDAR AS IMAGENS PREGUIÇOSAS.
     *
     * `fullPage: true` fotografa a página inteira mas NÃO rola por ela, então
     * as imagens abaixo da dobra com `loading="lazy"` nunca são pedidas — e
     * saem como retângulo vazio na captura. Foi o que aconteceu com a foto da
     * bancada: o site estava certo (`naturalWidth=662`), a captura é que
     * mentia.
     *
     * Rolar até o fim e voltar resolve. O `scrollTo(0,0)` no fim importa: sem
     * ele o cabeçalho fixo aparece no meio da imagem.
     */
    await aba.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 100))
      }
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 400))
    })
    await aba
      .waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 15000 })
      .catch(() => {})

    const medidas = await aba.evaluate(() => {
      const doc = document.documentElement
      const topo = document.querySelector('.topo')
      const selo = document.querySelector('.topo .marca__selo')
      const assinatura = document.querySelector('.assinatura-marca')

      /*
       * ROLAGEM HORIZONTAL, medida do jeito certo.
       *
       * A primeira versão comparava `documentElement.scrollWidth` com
       * `clientWidth` e acusou 113px de excesso em /planos a 360px. Era falso:
       * no Chromium esse número soma o conteúdo que está DENTRO de um
       * contêiner com rolagem própria — no caso, a tabela de comparação, que
       * rola sozinha de propósito.
       *
       * O teste honesto é tentar rolar. Se `scrollX` não sai de zero, a
       * visitante não consegue arrastar a página, e é só isso que importa.
       */
      const antes = window.scrollX
      window.scrollTo(9999, window.scrollY)
      const rolou = window.scrollX
      window.scrollTo(antes, window.scrollY)

      return {
        rolagemHorizontal: rolou > 0,
        excesso: rolou,
        topoAltura: topo ? Math.round(topo.getBoundingClientRect().height) : null,
        topoFundo: topo ? getComputedStyle(topo).backgroundColor : null,
        seloVisivel: Boolean(selo && selo.getBoundingClientRect().width > 0),
        seloLargura: selo ? Math.round(selo.getBoundingClientRect().width) : null,
        seloRaio: selo ? getComputedStyle(selo).borderRadius : null,
        nomeNoTopo: document.querySelector('.topo .marca__nome')?.textContent?.trim() ?? null,
        assinaturaNaLanding: Boolean(assinatura),
        // A seção que a responsável mandou remover não pode existir mais.
        jeitoComum: document.body.innerText.includes('O jeito comum'),
        contrasteNoDom: Boolean(document.querySelector('.contraste, .faixa-marca')),
      }
    })

    const arquivo = `${SAIDA}/${pagina.nome}-${tela.nome}.png`
    await aba.screenshot({ path: arquivo, fullPage: true })

    // Recorte só do cabeçalho, para conferir o topo sem rolar a captura toda.
    if (pagina.nome === 'landing') {
      const topo = aba.locator('.topo')
      if (await topo.count()) {
        await topo.screenshot({ path: `${SAIDA}/topo-${tela.nome}.png` })
      }
    }

    relatorio.push({
      pagina: pagina.nome,
      tela: tela.nome,
      largura: tela.width,
      status: resposta?.status() ?? null,
      arquivo,
      ...medidas,
    })

    await aba.close()
  }

  await contexto.close()
}

await navegador.close()

await writeFile(`${SAIDA}/relatorio.json`, JSON.stringify(relatorio, null, 2))

/* --- Saída legível --------------------------------------------------------- */

let falhas = 0
console.log('\nCAPTURAS DA MARCA\n')

for (const r of relatorio) {
  const problemas = []
  if (r.status !== 200) problemas.push(`HTTP ${r.status}`)
  if (r.rolagemHorizontal) problemas.push(`rolagem horizontal (+${r.excesso}px)`)
  if (!r.seloVisivel) problemas.push('logo ausente no topo')
  if (r.jeitoComum) problemas.push('seção "O jeito comum" ainda no DOM')
  if (r.contrasteNoDom) problemas.push('markup .contraste/.faixa-marca ainda no DOM')
  if (r.pagina === 'landing' && !r.assinaturaNaLanding) {
    problemas.push('assinatura da marca ausente na landing')
  }

  if (problemas.length) falhas += problemas.length
  const marca = problemas.length ? 'FALHA' : 'ok'
  console.log(`  [${marca}] ${r.pagina} @ ${r.largura}px — ${r.arquivo}`)
  for (const p of problemas) console.log(`         · ${p}`)
}

const primeiro = relatorio[0]
if (primeiro) {
  console.log('\n  Topo:', primeiro.topoAltura + 'px de altura, fundo', primeiro.topoFundo)
  console.log('  Selo:', primeiro.seloLargura + 'px, raio', primeiro.seloRaio)
  console.log('  Nome no topo:', JSON.stringify(primeiro.nomeNoTopo))
}

console.log(`\n  ${relatorio.length} capturas · ${falhas} problema(s)\n`)
process.exit(falhas ? 1 : 0)
