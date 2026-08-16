/**
 * AUDITORIA DO PAINEL, COM SESSÃO DE VERDADE
 *
 * A auditoria pública para na porta: /admin e /aluna redirecionam para
 * /entrar, e o auditor conclui "tudo certo" sem nunca ter visto o painel.
 *
 * Aqui a sessão é criada de verdade, pelo caminho oficial do Supabase:
 * `auth.admin.generateLink` devolve o mesmo link que o e-mail levaria, e o
 * navegador entra por ele. Nenhum atalho, nenhuma sessão forjada — é
 * exatamente o que acontece quando a responsável clica no link.
 *
 * O que procura, em cada tela do painel:
 *   · HTTP de erro;
 *   · link morto (href vazio, href="#", âncora sem alvo, 404);
 *   · TELA SEM SAÍDA: nenhuma lista, nenhum formulário e nenhum estado vazio
 *     explicado. É a tela que faz o cliente perguntar "e agora?".
 *
 *   node scripts/auditoria-admin.mjs [base] [email]
 */

import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = process.argv[3] ?? 'miguelzerapro@gmail.com'
const SAIDA = 'docs/validacao'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/* --- Telas do painel e da área da aluna ------------------------------------ */

const TELAS = [
  { rota: '/admin', nome: 'Painel' },
  { rota: '/admin/formacao', nome: 'Formação' },
  { rota: '/admin/cursos', nome: 'Cursos' },
  { rota: '/admin/alunas', nome: 'Alunas' },
  { rota: '/admin/pedidos', nome: 'Pedidos' },
  { rota: '/admin/leads', nome: 'Leads' },
  { rota: '/admin/vendas', nome: 'Vendas' },
  { rota: '/admin/formacao/previa', nome: 'Ver como aluna' },
  { rota: '/admin/funil', nome: 'Funil' },
  { rota: '/admin/quiz', nome: 'Quiz' },
  { rota: '/admin/midia', nome: 'Mídia' },
  { rota: '/admin/paginas', nome: 'Páginas' },
  /*
   * Estas quatro estão no MENU do painel e a primeira auditoria não as
   * testou — auditar só o que eu lembrei de listar é como não auditar. Todas
   * caem na rota genérica /admin/[entidade].
   */
  { rota: '/admin/ofertas', nome: 'Ofertas' },
  { rota: '/admin/faq', nome: 'FAQ' },
  { rota: '/admin/depoimentos', nome: 'Depoimentos' },
  { rota: '/admin/avisos', nome: 'Avisos' },
  { rota: '/admin/mensagens', nome: 'Mensagens' },
  { rota: '/admin/comunidade', nome: 'Comunidade' },
  { rota: '/admin/ajustes', nome: 'Ajustes' },
  { rota: '/admin/lgpd', nome: 'LGPD' },
  { rota: '/aluna', nome: 'Área da aluna' },
  { rota: '/aluna/cursos', nome: 'Cursos da aluna' },
  { rota: '/aluna/perfil', nome: 'Perfil' },
  { rota: '/aluna/mensagens', nome: 'Mensagens da aluna' },
]

/* --- Sessão ---------------------------------------------------------------- */

/*
 * COMO A SESSÃO É CRIADA
 *
 * A primeira tentativa foi mandar o navegador para o link do e-mail. Não
 * funciona: `/auth/v1/verify` devolve os tokens no FRAGMENTO da URL (fluxo
 * implícito), enquanto `/auth/callback` desta aplicação espera `?code=`
 * (PKCE). O navegador chegava com a sessão na mão e o callback dizia
 * "erro=link".
 *
 * O caminho certo é trocar o token por sessão aqui no Node, com `verifyOtp`,
 * e escrever o cookie que o `@supabase/ssr` lê. É a mesma sessão, do mesmo
 * usuário, com as mesmas permissões — só entregue pela porta que esta
 * aplicação usa.
 */
const { data: link, error } = await supa.auth.admin.generateLink({
  type: 'magiclink',
  email: EMAIL,
})

if (error) {
  console.error('Não foi possível gerar o link de acesso:', error.message)
  process.exit(1)
}

const { data: sessaoData, error: erroSessao } = await supa.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
})

if (erroSessao || !sessaoData.session) {
  console.error('Não foi possível trocar o token por sessão:', erroSessao?.message)
  process.exit(1)
}

/* O nome do cookie é derivado da referência do projeto na URL do Supabase. */
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const nomeCookie = `sb-${ref}-auth-token`

// @supabase/ssr 0.5 grava `base64-` + base64 do JSON da sessão, partido em
// pedaços de 3180 caracteres quando passa do limite de cookie.
const bruto = 'base64-' + Buffer.from(JSON.stringify(sessaoData.session), 'utf8').toString('base64')
const PEDACO = 3180
const pedacos = []
for (let i = 0; i < bruto.length; i += PEDACO) pedacos.push(bruto.slice(i, i + PEDACO))

const dominio = new URL(BASE)
const cookies = (
  pedacos.length === 1
    ? [{ name: nomeCookie, value: pedacos[0] }]
    : pedacos.map((v, i) => ({ name: `${nomeCookie}.${i}`, value: v }))
).map((c) => ({
  ...c,
  domain: dominio.hostname,
  path: '/',
  httpOnly: false,
  secure: dominio.protocol === 'https:',
  sameSite: 'Lax',
}))

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
await contexto.addCookies(cookies)

/* Confere que a sessão pegou ANTES de auditar 18 telas achando que pegou. */
const entrada = await contexto.newPage()
await entrada.goto(`${BASE}/admin`, { waitUntil: 'load', timeout: 60000 })
const urlFinal = entrada.url()
const entrou = !urlFinal.includes('/entrar')
console.log(
  entrou
    ? `\nSessão criada para ${EMAIL} (${pedacos.length} pedaço(s) de cookie).`
    : `\nFALHA ao criar sessão (parou em ${urlFinal}).`,
)
await entrada.close()

if (!entrou) {
  await navegador.close()
  process.exit(1)
}

/* --- Varredura ------------------------------------------------------------- */

const statusDe = new Map()
async function conferir(url) {
  if (statusDe.has(url)) return statusDe.get(url)
  let s = 0
  try {
    s = (await contexto.request.get(url, { maxRedirects: 5, timeout: 30000 })).status()
  } catch {
    s = 0
  }
  statusDe.set(url, s)
  return s
}

const relatorio = []

for (const tela of TELAS) {
  const aba = await contexto.newPage()
  let resposta = null
  try {
    resposta = await aba.goto(BASE + tela.rota, { waitUntil: 'load', timeout: 60000 })

    /*
     * ESPERAR O SUSPENSE RESOLVER.
     *
     * A primeira versão media logo depois do `load` e encontrou "Carregando…"
     * em 13 das 18 telas — e concluiu que o painel inteiro estava vazio. Era
     * erro do auditor: quase todas as telas do admin têm uma fronteira de
     * Suspense, e o esqueleto ainda estava no ar quando a medição rodou.
     *
     * Agora ele espera o esqueleto sumir. Se em 30s ainda estiver lá, aí sim
     * é defeito de verdade — e vira "presa em Carregando".
     */
    await aba
      .waitForFunction(
        () => !((document.querySelector('main') ?? document.body).innerText ?? '').trim().startsWith('Carregando'),
        { timeout: 30000 },
      )
      .catch(() => {})
    await aba.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  } catch (e) {
    relatorio.push({ ...tela, status: 0, erro: String(e).slice(0, 100), mortos: [], semSaida: true })
    await aba.close()
    continue
  }

  const dados = await aba.evaluate(() => {
    const links = [...document.querySelectorAll('main a, a')].map((a) => ({
      rotulo: (a.textContent ?? '').trim().slice(0, 50) || '(sem rótulo)',
      href: a.getAttribute('href'),
      resolvido: a.href || null,
      ancora: a.getAttribute('href')?.startsWith('#') ? a.getAttribute('href').slice(1) : null,
      alvoExiste: a.getAttribute('href')?.startsWith('#')
        ? Boolean(document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))))
        : null,
    }))

    const principal = document.querySelector('main') ?? document.body
    const texto = (principal.innerText ?? '').trim()

    return {
      links,
      redirecionouParaLogin: location.pathname === '/entrar',
      // Sinais de que a tela DIZ alguma coisa: tabela, lista, formulário,
      // cartão, ou um estado vazio explicado.
      temTabela: Boolean(principal.querySelector('table tbody tr')),
      temLista: principal.querySelectorAll('li').length > 0,
      temFormulario: Boolean(principal.querySelector('form input, form textarea, form select')),
      /*
       * A primeira lista de seletores estava incompleta e acusou "sem estado
       * vazio" em telas que TINHAM um — `.vazio-explicado` e
       * `.lista-admin__vazia` não estavam aqui. Auditor com seletor
       * desatualizado inventa defeito.
       */
      temEstadoVazio: Boolean(
        principal.querySelector(
          '.estado-vazio, .aviso, [data-vazio], .vazio-explicado, .lista-admin__vazia, .funil',
        ),
      ),
      temBotaoDeAcao: principal.querySelectorAll('a.botao, button').length > 0,
      caracteres: texto.length,
      titulo: document.querySelector('h1')?.textContent?.trim() ?? null,
      amostra: texto.slice(0, 160).replace(/\s+/g, ' '),
    }
  })

  const mortos = []
  for (const l of dados.links) {
    const h = l.href
    if (h === null || h.trim() === '') { mortos.push({ ...l, motivo: 'href vazio' }); continue }
    if (h === '#') { mortos.push({ ...l, motivo: 'href="#"' }); continue }
    if (l.ancora !== null) {
      /*
       * Reconfere a âncora AGORA, e não no instante da coleta.
       *
       * A primeira versão acusou "#conteudo sem alvo" em três telas — e
       * `curl` mostrou que o `id` estava lá nas três. O que acontecia: a
       * coleta rodava enquanto o React ainda remontava o <main>, e o
       * `getElementById` pegava o intervalo em que o elemento estava
       * destacado do documento. Uma segunda leitura, depois de assentar,
       * mata o falso positivo sem esconder defeito real.
       */
      const existeAgora = await aba.evaluate(
        (id) => Boolean(document.getElementById(id)),
        l.ancora,
      )
      if (!existeAgora) mortos.push({ ...l, motivo: `âncora #${l.ancora} sem alvo` })
      continue
    }
    if (!l.resolvido?.startsWith(BASE)) continue
    const s = await conferir(l.resolvido)
    if (s === 0 || s >= 400) mortos.push({ ...l, motivo: `HTTP ${s || 'sem resposta'}` })
  }

  /*
   * "Sem saída": a tela abriu, não redirecionou, mas não mostra lista, nem
   * formulário, nem estado vazio explicado, nem ação. É a tela que faz o
   * cliente parar e perguntar o que aconteceu.
   */
  const presoCarregando = dados.amostra.startsWith('Carregando')

  /*
   * O limite de 220 caracteres acusava /admin/leads (133 chars, listando um
   * lead de verdade) e /admin/mensagens (213, com estado vazio explicado). O
   * sinal que importa não é o tamanho: é a tela DIZER alguma coisa. Um título
   * com uma frase de contexto — cerca de 120 caracteres — já diz.
   */
  const semSaida =
    !presoCarregando &&
    !dados.redirecionouParaLogin &&
    !dados.temTabela &&
    !dados.temLista &&
    !dados.temFormulario &&
    !dados.temEstadoVazio &&
    !dados.temBotaoDeAcao &&
    dados.caracteres < 120

  relatorio.push({
    ...tela,
    status: resposta?.status() ?? 0,
    titulo: dados.titulo,
    redirecionouParaLogin: dados.redirecionouParaLogin,
    temTabela: dados.temTabela,
    temFormulario: dados.temFormulario,
    temLista: dados.temLista,
    temEstadoVazio: dados.temEstadoVazio,
    temBotaoDeAcao: dados.temBotaoDeAcao,
    caracteres: dados.caracteres,
    amostra: dados.amostra,
    presoCarregando,
    mortos,
    semSaida,
  })

  await aba.close()
}

await navegador.close()
await mkdir(SAIDA, { recursive: true })
await writeFile(`${SAIDA}/auditoria-admin.json`, JSON.stringify(relatorio, null, 2))

/* --- Relatório ------------------------------------------------------------- */

let problemas = 0
console.log(`\nAUDITORIA DO PAINEL — ${BASE}\n`)

for (const r of relatorio) {
  const falhas = []
  if (r.status >= 400 || r.status === 0) falhas.push(`HTTP ${r.status}`)
  if (r.redirecionouParaLogin) falhas.push('caiu no login (sem permissão?)')
  if (r.presoCarregando) falhas.push('presa em "Carregando…" por mais de 30s')
  if (r.semSaida) falhas.push('tela sem lista, sem formulário e sem estado vazio explicado')
  for (const m of r.mortos) falhas.push(`link morto: "${m.rotulo}" → ${JSON.stringify(m.href)} (${m.motivo})`)

  problemas += falhas.length
  console.log(`  [${falhas.length ? 'FALHA' : 'ok  '}] ${r.nome.padEnd(20)} ${r.rota}`)
  if (!falhas.length) {
    console.log(`           ${r.amostra || '(sem texto)'}`)
  }
  for (const f of falhas) console.log(`           · ${f}`)
}

console.log(`\n  ${relatorio.length} telas · ${problemas} problema(s)\n`)
process.exit(problemas ? 1 : 0)
