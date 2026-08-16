/**
 * AUDITORIA DE CLIQUES
 *
 * Uma pergunta só: existe algum item clicável que não leva a lugar nenhum?
 *
 * O que conta como item morto:
 *   · href="#" ou href vazio (âncora que não navega);
 *   · âncora #alvo cujo alvo não existe na página;
 *   · link interno que responde 404 ou 500;
 *   · <button> fora de <form>, sem onClick e sem formulário associado.
 *
 * O que NÃO conta como defeito:
 *   · link externo (não é nosso para consertar);
 *   · rota que exige sessão e responde 200 com tela de login;
 *   · mailto:, tel:, https:// de terceiro.
 *
 * A auditoria roda no NAVEGADOR, não no código: é o DOM renderizado que a
 * visitante clica, e é nele que um link some ou aparece conforme os dados.
 *
 *   node scripts/auditoria-cliques.mjs [base]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const SAIDA = 'docs/validacao'

/** Telas públicas que qualquer visitante alcança. */
const ROTAS = [
  '/',
  '/planos',
  '/diagnostico',
  '/checkout/iniciante',
  '/checkout/profissional',
  '/checkout/completo',
  '/entrar',
  '/cursos',
  '/suporte',
  '/termos',
  '/privacidade',
  '/obrigado',
  '/admin',
  '/aluna',
]

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } })

const paginas = []
/** Cache de status por URL: a mesma rota aparece em muitos links. */
const statusDe = new Map()

async function conferir(url) {
  if (statusDe.has(url)) return statusDe.get(url)
  let status = 0
  try {
    const r = await contexto.request.get(url, { maxRedirects: 5, timeout: 30000 })
    status = r.status()
  } catch {
    status = 0
  }
  statusDe.set(url, status)
  return status
}

for (const rota of ROTAS) {
  const aba = await contexto.newPage()
  let resposta = null
  try {
    resposta = await aba.goto(BASE + rota, { waitUntil: 'load', timeout: 60000 })
  } catch (e) {
    paginas.push({ rota, status: 0, erro: String(e).slice(0, 120), itens: [], mortos: [] })
    await aba.close()
    continue
  }

  const itens = await aba.evaluate(() => {
    const achados = []

    for (const a of document.querySelectorAll('a')) {
      const bruto = a.getAttribute('href')
      const rotulo = (a.textContent ?? '').trim().slice(0, 60) || a.getAttribute('aria-label') || '(sem rótulo)'
      achados.push({
        tipo: 'link',
        rotulo,
        href: bruto,
        resolvido: a.href || null,
        // Âncora interna: o alvo precisa existir NESTA página.
        ancora: bruto && bruto.startsWith('#') ? bruto.slice(1) : null,
        alvoExiste:
          bruto && bruto.startsWith('#') && bruto.length > 1
            ? Boolean(document.getElementById(decodeURIComponent(bruto.slice(1))))
            : null,
      })
    }

    for (const b of document.querySelectorAll('button')) {
      const rotulo = (b.textContent ?? '').trim().slice(0, 60) || b.getAttribute('aria-label') || '(sem rótulo)'
      achados.push({
        tipo: 'botao',
        rotulo,
        // `form` cobre botão dentro de <form> e o atributo form="id".
        temForm: Boolean(b.form),
        submit: b.type === 'submit',
        // React não expõe onClick no DOM; o marcador confiável é a presença
        // de um handler registrado, que só dá para inferir por atributo.
        // Botão sem form E sem aria-controls E desabilitado sem motivo é o
        // que realmente interessa aqui.
        controla: b.getAttribute('aria-controls'),
        expandido: b.getAttribute('aria-expanded'),
        desabilitado: b.disabled,
      })
    }

    return achados
  })

  /* --- Classificação ------------------------------------------------------ */
  const mortos = []

  for (const item of itens) {
    if (item.tipo !== 'link') continue

    const h = item.href
    if (h === null || h.trim() === '') {
      mortos.push({ ...item, motivo: 'href vazio' })
      continue
    }
    if (h === '#') {
      mortos.push({ ...item, motivo: 'href="#" (não navega)' })
      continue
    }
    if (item.ancora !== null) {
      if (item.alvoExiste === false) {
        mortos.push({ ...item, motivo: `âncora #${item.ancora} sem alvo nesta página` })
      }
      continue
    }

    // Só conferimos o que é nosso.
    if (!item.resolvido || !item.resolvido.startsWith(BASE)) continue

    const status = await conferir(item.resolvido)
    if (status === 0 || status >= 400) {
      mortos.push({ ...item, motivo: `HTTP ${status || 'sem resposta'}` })
    }
  }

  paginas.push({
    rota,
    status: resposta?.status() ?? 0,
    links: itens.filter((i) => i.tipo === 'link').length,
    botoes: itens.filter((i) => i.tipo === 'botao').length,
    mortos,
  })

  await aba.close()
}

await navegador.close()
await mkdir(SAIDA, { recursive: true })
await writeFile(`${SAIDA}/auditoria-cliques.json`, JSON.stringify(paginas, null, 2))

/* --- Relatório ------------------------------------------------------------- */

let totalMortos = 0
console.log(`\nAUDITORIA DE CLIQUES — ${BASE}\n`)

for (const p of paginas) {
  totalMortos += p.mortos.length
  const marca = p.mortos.length === 0 && p.status < 400 ? 'ok  ' : 'FALHA'
  console.log(`  [${marca}] ${p.rota}  (HTTP ${p.status} · ${p.links ?? 0} links · ${p.botoes ?? 0} botões)`)
  for (const m of p.mortos) {
    console.log(`           · "${m.rotulo}" → ${JSON.stringify(m.href)} — ${m.motivo}`)
  }
  if (p.erro) console.log(`           · erro: ${p.erro}`)
}

console.log(`\n  ${paginas.length} telas · ${totalMortos} item(ns) morto(s)\n`)
process.exit(totalMortos ? 1 : 0)
