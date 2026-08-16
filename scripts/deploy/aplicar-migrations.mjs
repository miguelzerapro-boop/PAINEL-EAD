/**
 * APLICA O SCHEMA NUM PROJETO SUPABASE NOVO
 *
 *   npm run deploy:schema
 *
 * Roda as migrations de `supabase/migrations/` em ordem, uma vez cada, contra
 * o banco apontado por SUPABASE_DB_URL.
 *
 * Por que não o CLI do Supabase: `supabase db push` exige `supabase login` e
 * `supabase link`, que abrem navegador e pedem token pessoal. Isto aqui só
 * precisa da string de conexão que já está no `.env.local`.
 *
 * IDEMPOTENTE. Registra o que já rodou em `public.schema_migrations`; rodar de
 * novo aplica só o que falta. Seguro para repetir.
 *
 * NÃO roda o seed de demonstração. O seed cria conteúdo fictício — útil em
 * teste local, veneno num projeto que vai virar produção.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const RAIZ = process.cwd()
const DIR = path.join(RAIZ, 'supabase', 'migrations')

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
    for (const l of bruto.split(/\r?\n/)) {
      const t = l.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (ambiente[k] === undefined) ambiente[k] = v
    }
  }
  return ambiente
}

const MARCAS = [
  'placeholder', 'troque', 'exemplo', 'example', 'changeme', 'your-', 'your_',
  'seu-', 'seu_', 'sua-', 'sua_', 'coloque', 'preencha', 'xxxx', '<', 'SENHA',
]
const ehExemplo = (v) => {
  const t = String(v ?? '').trim()
  if (t === '') return true
  const min = t.toLowerCase()
  return MARCAS.some((m) => min.includes(m.toLowerCase()))
}

const ambiente = await carregarEnv()
const URL_BANCO = ambiente.SUPABASE_DB_URL

if (!URL_BANCO || ehExemplo(URL_BANCO)) {
  console.error('\nSUPABASE_DB_URL ainda não está configurada (ou é o valor de exemplo).\n')
  console.error('No painel do Supabase: Project Settings → Database → Connection string → URI.')
  console.error('Cole no `.env.local` e rode de novo.\n')
  console.error('Nunca cole essa string em mensagem, documentação ou captura de tela.\n')
  process.exit(1)
}

/* -------------------------------------------------------------------------- */

const client = new pg.Client({
  connectionString: URL_BANCO,
  // O Supabase exige TLS. O certificado é de uma CA que o Node nem sempre traz.
  ssl: { rejectUnauthorized: false },
})

console.log('\nAPLICANDO O SCHEMA\n')

try {
  await client.connect()
} catch (e) {
  console.error(`Não foi possível conectar: ${e.message}`)
  console.error('Confira a senha na string de conexão e se o projeto já terminou de provisionar.\n')
  process.exit(1)
}

// Registro do que já rodou. Nome de arquivo é a chave.
await client.query(`
  create table if not exists public.schema_migrations (
    nome        text primary key,
    aplicada_em timestamptz not null default now()
  )
`)

const { rows: aplicadas } = await client.query('select nome from public.schema_migrations')
const jaRodou = new Set(aplicadas.map((r) => r.nome))

const arquivos = (await readdir(DIR)).filter((a) => a.endsWith('.sql')).sort()

let rodadas = 0
let puladas = 0

for (const nome of arquivos) {
  if (jaRodou.has(nome)) {
    puladas += 1
    continue
  }

  const sql = await readFile(path.join(DIR, nome), 'utf8')
  const inicio = Date.now()

  try {
    // Cada migration numa transação: ou entra inteira, ou não entra.
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into public.schema_migrations (nome) values ($1)', [nome])
    await client.query('commit')
    console.log(`  ok    ${nome.padEnd(46)} ${Date.now() - inicio} ms`)
    rodadas += 1
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error(`  FALHA ${nome}`)
    console.error(`        ${e.message.split('\n')[0]}`)
    if (e.hint) console.error(`        dica: ${e.hint}`)
    console.error('\nNada foi aplicado desta migration. Corrija e rode de novo.\n')
    await client.end()
    process.exit(1)
  }
}

/* --- Conferência --------------------------------------------------------- */

const { rows: [capitulos] } = await client.query(`
  select count(*)::int as n from public.modules m
  join public.courses c on c.id = m.course_id where c.slug = 'formacao'
`)

const { rows: [buckets] } = await client.query(`
  select count(*)::int as n from storage.buckets where id = 'lesson-videos'
`)

const { rows: [aulas] } = await client.query(`select count(*)::int as n from public.lessons`)

console.log('')
console.log(`${rodadas} migration(s) aplicada(s), ${puladas} já estavam.`)
console.log('')
console.log(`  capítulos da formação ..... ${capitulos.n}  (esperado: 8)`)
console.log(`  bucket lesson-videos ...... ${buckets.n === 1 ? 'criado' : 'AUSENTE'}`)
console.log(`  aulas cadastradas ......... ${aulas.n}  (esperado: 0 — nenhuma é inventada)`)

const tudoCerto = capitulos.n === 8 && buckets.n === 1

await client.end()

console.log('')
if (!tudoCerto) {
  console.log('Algo não bateu. Confira as mensagens acima.\n')
  process.exitCode = 1
} else {
  console.log('Schema no ar.\n')
  console.log('Próximos passos:')
  console.log('  1. npm run deploy:admin -- seu-email@exemplo.com')
  console.log('  2. npm run storage:preflight')
  console.log('  3. npm run storage:validate')
  console.log('')
}
