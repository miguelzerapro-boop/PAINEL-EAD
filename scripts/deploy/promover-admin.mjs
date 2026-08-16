/**
 * PROMOVE A PRIMEIRA ADMINISTRADORA
 *
 *   npm run deploy:admin -- email@da-responsavel.com
 *
 * O projeto não nasce com ninguém dentro, de propósito: um admin criado por
 * migration seria uma conta com senha conhecida por quem leu o repositório.
 *
 * ORDEM CERTA:
 *   1. a pessoa entra UMA VEZ pelo site (/entrar) e recebe o link por e-mail;
 *   2. só então este comando promove a conta dela a admin.
 *
 * A função `bootstrap_first_admin` (migration 21) recusa rodar se já existir
 * qualquer administrador — depois do primeiro, acesso se concede pelo painel.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const RAIZ = process.cwd()
const email = process.argv[2]

if (!email || !email.includes('@')) {
  console.error('\nInforme o e-mail:\n')
  console.error('  npm run deploy:admin -- email@da-responsavel.com\n')
  process.exit(1)
}

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

const ambiente = await carregarEnv()
const URL_BANCO = ambiente.SUPABASE_DB_URL

if (!URL_BANCO || URL_BANCO.includes('SENHA') || URL_BANCO.includes('exemplo')) {
  console.error('\nSUPABASE_DB_URL não está configurada no `.env.local`.\n')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: URL_BANCO,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const { rows } = await client.query('select public.bootstrap_first_admin($1) as ok', [email])
  console.log(`\n${email} agora é administradora.\n`)
  void rows
} catch (e) {
  const msg = e.message.split('\n')[0]

  if (/Nenhuma conta encontrada/i.test(msg)) {
    console.error(`\nNão existe conta para ${email}.\n`)
    console.error('Peça para a pessoa entrar uma vez em /entrar (o link chega por e-mail)')
    console.error('e rode este comando de novo.\n')
  } else if (/administrador/i.test(msg)) {
    console.error(`\n${msg}\n`)
    console.error('Já existe administrador. Conceda acesso pelo painel, em Alunas.\n')
  } else {
    console.error(`\n${msg}\n`)
  }
  process.exitCode = 1
} finally {
  await client.end()
}
