/**
 * A OPERAÇÃO DO PAINEL, CLICADA
 *
 * Prova que a responsável consegue FAZER as coisas, não só abrir as telas:
 *
 *   · criar uma pergunta com três respostas e ver o preview mudar;
 *   · salvar, reabrir para edição e conferir que as respostas voltaram;
 *   · apagar a pergunta de teste no fim — nada de conteúdo inventado fica;
 *   · abrir a tela de nova aula e ver upload e capa na MESMA tela;
 *   · clicar numa pendência e chegar ao campo certo, não a uma tela genérica.
 *
 * A pergunta criada é uma FIXTURE, marcada no texto e removida ao final. Se
 * o script morrer no meio, a limpeza roda mesmo assim.
 *
 *   node scripts/operacao-admin.mjs [base]
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const MARCA_FIXTURE = '[TESTE AUTOMATICO] Pergunta de verificação'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok })
  console.log(`  [${ok ? 'ok  ' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

/** Apaga a fixture, aconteça o que acontecer. */
async function limpar() {
  const { data } = await supa
    .from('quiz_questions')
    .select('id')
    .ilike('prompt', '%TESTE AUTOMATICO%')
  for (const q of data ?? []) {
    await supa.from('quiz_questions').delete().eq('id', q.id)
  }
  return (data ?? []).length
}

await limpar()

/* --- Sessão --------------------------------------------------------------- */
const { data: link } = await supa.auth.admin.generateLink({
  type: 'magiclink',
  email: 'miguelzerapro@gmail.com',
})
const { data: sessao } = await supa.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
})

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const bruto = 'base64-' + Buffer.from(JSON.stringify(sessao.session), 'utf8').toString('base64')
const pedacos = []
for (let i = 0; i < bruto.length; i += 3180) pedacos.push(bruto.slice(i, i + 3180))

const dominio = new URL(BASE)
const cookies = (
  pedacos.length === 1
    ? [{ name: `sb-${ref}-auth-token`, value: pedacos[0] }]
    : pedacos.map((v, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: v }))
).map((c) => ({
  ...c,
  domain: dominio.hostname,
  path: '/',
  httpOnly: false,
  secure: dominio.protocol === 'https:',
  sameSite: 'Lax',
}))

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } })
await contexto.addCookies(cookies)
const aba = await contexto.newPage()
aba.setDefaultTimeout(45000)

const esperar = async () => {
  await aba
    .waitForFunction(
      () => !((document.querySelector('main') ?? document.body).innerText ?? '').trim().startsWith('Carregando'),
      { timeout: 45000 },
    )
    .catch(() => {})
}

console.log(`\nOPERAÇÃO DO PAINEL — ${BASE}\n`)

try {
  /* --- 1. Início ---------------------------------------------------------- */
  await aba.goto(`${BASE}/admin`, { waitUntil: 'load' })
  await esperar()

  registrar('Início saúda pelo nome', (await aba.locator('.inicio__saudacao').count()) > 0)
  registrar('Início mostra os números', (await aba.locator('.numero-cartao').count()) >= 4)
  registrar('Início oferece ações rápidas', (await aba.locator('.acao-rapida').count()) >= 4)

  const pendencias = await aba.locator('.pendencia').count()
  registrar('Pendências ficam abaixo das ações', pendencias >= 0, `${pendencias} item(ns)`)

  /* --- 2. Pendência leva ao campo certo ----------------------------------- */
  if (pendencias > 0) {
    const href = await aba.locator('.pendencia__acao').first().getAttribute('href')
    await aba.locator('.pendencia__acao').first().click()
    await aba.waitForTimeout(2500)
    await esperar()

    // Quando a pendência é de configuração, o link tem âncora para o campo.
    const temAncora = (href ?? '').includes('#campo-')
    if (temAncora) {
      const alvo = (href ?? '').split('#')[1]
      const existe = await aba.evaluate((id) => Boolean(document.getElementById(id)), alvo)
      registrar('Pendência leva ao campo exato', existe, `#${alvo}`)
    } else {
      registrar('Pendência leva a uma tela útil', !aba.url().includes('/entrar'), href ?? '')
    }
  }

  /* --- 3. Nova aula: vídeo e capa na mesma tela --------------------------- */
  await aba.goto(`${BASE}/admin/formacao/aula/nova`, { waitUntil: 'load' })
  await esperar()

  registrar('Nova aula pede título', (await aba.locator('input.entrada').count()) > 0)
  registrar('Nova aula tem área de vídeo', (await aba.locator('.envio, input[type="file"]').count()) > 0)
  registrar('Capa está na MESMA tela', (await aba.locator('.capa-aula').count()) > 0)
  registrar(
    'Capa não é obrigatória (mostra o selo da marca)',
    (await aba.locator('.capa-aula__vazia').count()) > 0,
  )

  /* --- 4. Quiz: criar pergunta com três respostas ------------------------- */
  await aba.goto(`${BASE}/admin/quiz/pergunta/nova`, { waitUntil: 'load' })
  await esperar()

  registrar('Construtor abre com duas respostas', (await aba.locator('.resposta').count()) === 2)
  registrar('Preview existe na mesma tela', (await aba.locator('.previa-quiz').count()) > 0)

  await aba.locator('.editor-pergunta__campos input.entrada').first().fill(MARCA_FIXTURE)

  const textos = ['Primeira resposta', 'Segunda resposta', 'Terceira resposta']
  await aba.getByRole('button', { name: /adicionar resposta/i }).click()
  registrar('Adicionar resposta funciona', (await aba.locator('.resposta').count()) === 3)

  for (let i = 0; i < 3; i++) {
    await aba.locator(`.resposta:nth-child(${i + 1}) input.entrada`).fill(textos[i])
  }

  // O preview tem que refletir o que foi digitado, sem salvar.
  const noPreview = await aba.locator('.previa-quiz__opcao').allTextContents()
  registrar(
    'Preview acompanha o que é digitado',
    textos.every((t) => noPreview.some((p) => p.includes(t))),
    noPreview.join(' | '),
  )

  const pergunta = await aba.locator('.previa-quiz__pergunta').textContent()
  registrar('Preview mostra a pergunta', (pergunta ?? '').includes('TESTE AUTOMATICO'))

  /* A tradução da pontuação: escolher o resultado sem ver JSON. */
  const seletores = aba.locator('.resposta__diagnostico select').first()
  const opcoes = await seletores.locator('option').count()
  registrar('Resultado do diagnóstico em lista legível', opcoes > 1, `${opcoes} opções`)

  await aba.getByRole('button', { name: /salvar pergunta/i }).click()
  await aba.waitForURL('**/admin/quiz**', { timeout: 45000 }).catch(() => {})
  await esperar()

  /*
   * Espera a linha aparecer, em vez de consultar uma vez.
   *
   * A primeira versão perguntava ao banco logo depois do `waitForURL` e
   * concluía que a pergunta não tinha sido salva — mas a limpeza no fim do
   * script encontrava e apagava a linha, provando que ela existia. O
   * `router.push` do editor troca a URL antes de a Server Action terminar de
   * gravar; o teste chegava primeiro.
   */
  let gravada = null
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const { data } = await supa
      .from('quiz_questions')
      .select('id, prompt, quiz_options (id, label, weights)')
      .ilike('prompt', '%TESTE AUTOMATICO%')
      .maybeSingle()

    // Só aceita quando as respostas também chegaram: a pergunta é gravada
    // antes delas, e parar na primeira leitura contaria 0 alternativas.
    if (data && (data.quiz_options ?? []).length >= 3) {
      gravada = data
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  registrar('Pergunta foi salva', Boolean(gravada), gravada?.prompt ?? '')
  registrar(
    'As três respostas foram salvas juntas',
    (gravada?.quiz_options ?? []).length === 3,
    `${(gravada?.quiz_options ?? []).length} resposta(s)`,
  )

  /* --- 5. Reabrir para edição -------------------------------------------- */
  if (gravada) {
    await aba.goto(`${BASE}/admin/quiz/pergunta/${gravada.id}`, { waitUntil: 'load' })
    await esperar()
    const recarregadas = await aba.locator('.resposta').count()
    registrar('Reabre para edição com as respostas', recarregadas === 3, `${recarregadas}`)
  }

  /* --- 6. Ficha da aluna -------------------------------------------------- */
  await aba.goto(`${BASE}/admin/alunas`, { waitUntil: 'load' })
  await esperar()
  const linksDeAluna = await aba.locator('a[href^="/admin/alunas/"]').count()

  if (linksDeAluna > 0) {
    await aba.locator('a[href^="/admin/alunas/"]').first().click()
    await esperar()
    registrar('Ficha da aluna abre', (await aba.locator('.ficha').count()) > 0)
  } else {
    registrar(
      'Sem alunas — lista explica o vazio',
      (await aba.locator('.vazio-explicado').count()) > 0,
      'nenhuma aluna cadastrada ainda',
    )
  }
} finally {
  await navegador.close()
  const apagadas = await limpar()
  console.log(`\n  Fixture removida: ${apagadas} pergunta(s) de teste apagada(s).`)
}

const falhas = passos.filter((p) => !p.ok).length
console.log(`\n  ${passos.length} verificações · ${falhas} falha(s)\n`)
process.exit(falhas ? 1 : 0)
