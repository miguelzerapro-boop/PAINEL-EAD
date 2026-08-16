/**
 * PRÉ-VOO DO STORAGE
 *
 *   npm run storage:preflight
 *
 * Responde a uma pergunta só: dá para tentar a prova real de upload?
 *
 * NÃO IMPRIME NENHUM VALOR DE CREDENCIAL. Nem mascarado, nem parcial. O que
 * sai é presença, formato e plausibilidade — o suficiente para saber o que
 * falta configurar, e nada que sirva para vazar chave em log de CI, captura de
 * tela ou cópia de terminal.
 *
 * Também não faz chamada de rede: pré-voo é conferência de bancada. Quem fala
 * com o Supabase é `npm run storage:validate`.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = process.cwd()

/* -------------------------------------------------------------------------- */
/* Carrega .env.local sem depender de dotenv                                   */
/* -------------------------------------------------------------------------- */

async function carregarEnv() {
  const ambiente = { ...process.env }

  for (const arquivo of ['.env.local', '.env']) {
    let bruto
    try {
      bruto = await readFile(path.join(RAIZ, arquivo), 'utf8')
    } catch {
      continue
    }

    for (const linha of bruto.split(/\r?\n/)) {
      const texto = linha.trim()
      if (!texto || texto.startsWith('#')) continue
      const igual = texto.indexOf('=')
      if (igual < 0) continue
      const chave = texto.slice(0, igual).trim()
      let valor = texto.slice(igual + 1).trim()
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1)
      }
      // O que já veio do ambiente real tem precedência.
      if (ambiente[chave] === undefined) ambiente[chave] = valor
    }
  }

  return ambiente
}

/* -------------------------------------------------------------------------- */

const LARGURA = 20
function linha(rotulo, estado, detalhe = '') {
  const pontos = '.'.repeat(Math.max(1, LARGURA - rotulo.length))
  console.log(`${rotulo} ${pontos} ${estado}${detalhe ? `  (${detalhe})` : ''}`)
}

const ambiente = await carregarEnv()

/*
 * A regra de verdade sobre credenciais mora em src/lib/supabase/credenciais.ts
 * e é testada em tests/credenciais.test.ts. Aqui ela é reimplementada em Node
 * puro porque o pré-voo precisa rodar sem passo de compilação — inclusive num
 * runner de CI que ainda não instalou nada além das dependências.
 */
const MARCAS = [
  'placeholder', 'troque', 'exemplo', 'example', 'changeme', 'change-me',
  'your-', 'your_', 'seu-', 'seu_', 'sua-', 'sua_', 'coloque', 'preencha',
  'todo', 'xxxx', 'aaaa', '<', 'dummy', 'fake',
]

const ehPlaceholder = (v) => {
  const t = String(v ?? '').trim().toLowerCase()
  return t === '' || MARCAS.some((m) => t.includes(m))
}

const primeira = (nomes) => {
  for (const n of nomes) {
    const v = ambiente[n]
    if (typeof v === 'string' && v.trim() !== '') return { nome: n, valor: v.trim() }
  }
  return null
}

/*
 * Só a FAMÍLIA da chave é reportada. Comprimento nunca decide validade: uma
 * `sb_secret_` legítima tem menos de 60 caracteres e não é JWT.
 */
const familia = (v) => {
  if (v.startsWith('sb_publishable_')) return 'chave pública nova'
  if (v.startsWith('sb_secret_')) return 'chave de backend nova'
  if (/^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(v)) return 'chave legada JWT'
  return 'formato não reconhecido'
}

const problemas = []
const avisos = []

console.log('\nPRÉ-VOO DO STORAGE — nenhum valor de credencial é exibido\n')

/* --- URL ------------------------------------------------------------------ */

const urlBruta = ambiente.NEXT_PUBLIC_SUPABASE_URL
let tipoDeAmbiente = 'DESCONHECIDO'

if (!urlBruta) {
  linha('Supabase URL', 'FALTA')
  problemas.push('Defina NEXT_PUBLIC_SUPABASE_URL.')
} else if (ehPlaceholder(urlBruta)) {
  linha('Supabase URL', 'EXEMPLO', 'ainda é valor de demonstração')
  problemas.push('NEXT_PUBLIC_SUPABASE_URL ainda é um valor de exemplo.')
} else {
  let url
  try {
    url = new URL(urlBruta)
  } catch {
    url = null
  }

  if (!url) {
    linha('Supabase URL', 'INVÁLIDA')
    problemas.push('NEXT_PUBLIC_SUPABASE_URL não é uma URL válida.')
  } else {
    const host = url.hostname.toLowerCase()
    const local = host === '127.0.0.1' || host === 'localhost' || host === '::1'
    const hospedado = host.endsWith('.supabase.co') || host.endsWith('.supabase.in')
    const ref = host.split('.')[0] ?? ''

    if (local) {
      linha('Supabase URL', 'OK', 'instância local')
      tipoDeAmbiente = 'LOCAL'
    } else if (hospedado && /^[a-z0-9]{8,}$/.test(ref)) {
      linha('Supabase URL', 'OK', 'projeto hospedado')
      tipoDeAmbiente = 'HOSPEDADO'
    } else if (!hospedado && url.protocol === 'https:' && host.includes('.')) {
      linha('Supabase URL', 'OK', 'domínio próprio')
      tipoDeAmbiente = 'PRÓPRIO'
    } else {
      linha('Supabase URL', 'IMPLAUSÍVEL')
      problemas.push('NEXT_PUBLIC_SUPABASE_URL não tem formato de projeto Supabase.')
    }
  }
}

/* --- Chaves --------------------------------------------------------------- */

const publica = primeira([
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
])

if (!publica) {
  linha('Public key', 'FALTA')
  problemas.push('Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou a legada ..._ANON_KEY).')
} else if (ehPlaceholder(publica.valor)) {
  linha('Public key', 'EXEMPLO', publica.nome)
  problemas.push(`${publica.nome} ainda é um valor de exemplo.`)
} else {
  linha('Public key', 'OK', familia(publica.valor))
}

const backend = primeira(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])

if (!backend) {
  linha('Backend key', 'FALTA')
  problemas.push('Defina SUPABASE_SECRET_KEY (ou a legada SUPABASE_SERVICE_ROLE_KEY).')
} else if (ehPlaceholder(backend.valor)) {
  linha('Backend key', 'EXEMPLO', backend.nome)
  problemas.push(`${backend.nome} ainda é um valor de exemplo.`)
} else {
  linha('Backend key', 'OK', familia(backend.valor))
}

// A chave de backend jamais pode estar num nome que o Next expõe ao navegador.
for (const chave of Object.keys(ambiente)) {
  if (!chave.startsWith('NEXT_PUBLIC_')) continue
  const valor = String(ambiente[chave] ?? '')
  if (valor.startsWith('sb_secret_') || /service_role/i.test(valor)) {
    problemas.push(
      `${chave} parece conter uma chave de BACKEND. Tudo em NEXT_PUBLIC_ vai para o navegador.`,
    )
  }
}

/* --- Dependências --------------------------------------------------------- */

let tusOk = false
try {
  await import('tus-js-client')
  tusOk = true
  linha('TUS client', 'OK', 'tus-js-client instalado')
} catch {
  linha('TUS client', 'FALTA', 'rode npm install')
  problemas.push('tus-js-client não está instalado.')
}

try {
  await import('@supabase/supabase-js')
  linha('Supabase SDK', 'OK')
} catch {
  linha('Supabase SDK', 'FALTA')
  problemas.push('@supabase/supabase-js não está instalado.')
}

/* --- Bucket e configuração do envio --------------------------------------- */

let bucketDeclarado = false
try {
  const sql = await readFile(
    path.join(RAIZ, 'supabase/migrations/20_storage.sql'),
    'utf8',
  )
  bucketDeclarado = sql.includes("'lesson-videos'")
} catch {
  /* segue */
}

linha(
  'Video bucket',
  bucketDeclarado ? 'AINDA NÃO VALIDADO' : 'NÃO DECLARADO',
  bucketDeclarado ? 'declarado na migration 20' : 'ausente das migrations',
)
if (!bucketDeclarado) problemas.push('O bucket lesson-videos não está declarado nas migrations.')

if (tusOk) {
  // O endpoint resumível do Supabase exige blocos de exatamente 6 MB.
  // A conferência do valor está em tests/video-tus.test.ts.
  let blocoOk = false
  try {
    const fonte = await readFile(path.join(RAIZ, 'src/lib/video/tus.ts'), 'utf8')
    blocoOk = fonte.includes('6 * 1024 * 1024')
  } catch {
    /* segue */
  }
  linha('Config TUS', blocoOk ? 'OK' : 'ATENÇÃO', 'blocos de 6 MB')
  if (!blocoOk) avisos.push('Não foi possível confirmar o tamanho de bloco de 6 MB.')
}

/* --- Ambiente ------------------------------------------------------------- */

const pareceProducao =
  ambiente.VERCEL_ENV === 'production' ||
  (ambiente.NODE_ENV === 'production' &&
    tipoDeAmbiente === 'HOSPEDADO' &&
    !ambiente.SUPABASE_HOMOLOG)

if (pareceProducao) {
  linha('Environment', 'ATENÇÃO', 'parece PRODUÇÃO')
  avisos.push(
    'O ambiente tem cara de produção. `storage:validate` cria e apaga dados — não rode aqui.',
  )
} else if (tipoDeAmbiente === 'LOCAL') {
  linha('Environment', 'LOCAL')
} else if (tipoDeAmbiente === 'DESCONHECIDO') {
  linha('Environment', 'DESCONHECIDO')
} else {
  linha('Environment', 'HOMOLOGAÇÃO')
}

/* -------------------------------------------------------------------------- */

console.log('')

if (problemas.length > 0) {
  console.log('PENDÊNCIAS:')
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  console.log('Configure as credenciais de homologação no `.env.local` e rode de novo.')
  console.log('Nunca cole chave secreta em mensagem, documentação ou captura de tela.')
  process.exitCode = 1
} else {
  if (avisos.length > 0) {
    console.log('AVISOS:')
    for (const a of avisos) console.log(`  · ${a}`)
    console.log('')
  }
  console.log('Tudo pronto para `npm run storage:validate`.')
}

console.log('')
