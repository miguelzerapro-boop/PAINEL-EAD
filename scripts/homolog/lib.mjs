/**
 * Utilitários do ambiente de HOMOLOGAÇÃO local.
 *
 * Banco: PostgreSQL 18.4 embarcado, porta 55432, base `homolog`.
 * NÃO é produção. NÃO é o Supabase. O schema `auth` é um shim
 * (scripts/homolog/00-auth-shim.sql).
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

/**
 * Porta escolhida pela variável PGHOMOLOG_PORT.
 *   55432 → PostgreSQL 18.4 (padrão)
 *   55433 → PostgreSQL 15.18, a linha que o Supabase roda
 */
export const CONFIG = {
  host: 'localhost',
  port: Number(process.env.PGHOMOLOG_PORT ?? 55432),
  user: 'postgres',
  database: 'homolog',
  manutencao: 'postgres',
}

/** Versão do servidor conectado, para carimbar os relatórios. */
export async function versaoDoServidor() {
  const c = new pg.Client({ ...CONFIG, database: CONFIG.manutencao })
  await c.connect()
  const { rows } = await c.query('show server_version')
  await c.end()
  return rows[0].server_version
}

export const RAIZ = path.resolve(process.cwd())
export const DIR_MIGRATIONS = path.join(RAIZ, 'supabase', 'migrations')
export const DIR_SHIM = path.join(RAIZ, 'scripts', 'homolog')

/**
 * Aponta para um banco externo (ex.: Supabase de homologação) quando
 * PGHOMOLOG_URL estiver definida. Nunca versione essa variável.
 */
const URL_EXTERNA = process.env.PGHOMOLOG_URL

export function cliente(database = CONFIG.database) {
  if (URL_EXTERNA) {
    return new pg.Client({ connectionString: URL_EXTERNA, ssl: { rejectUnauthorized: false } })
  }
  return new pg.Client({ ...CONFIG, database })
}

/** Rótulo do ambiente para carimbar relatórios, sem vazar credencial. */
export function rotuloDoAmbiente() {
  if (!URL_EXTERNA) return `local PostgreSQL @ ${CONFIG.host}:${CONFIG.port}/${CONFIG.database}`
  try {
    const u = new URL(URL_EXTERNA)
    const host = u.hostname.replace(/^([^.]{0,4})[^.]*/, '$1***')
    return `externo @ ${host} (credenciais ocultas)`
  } catch {
    return 'externo (credenciais ocultas)'
  }
}

/** Executa um arquivo SQL inteiro, medindo tempo e coletando NOTICE/WARNING. */
export async function rodarArquivo(client, arquivo) {
  const sql = await readFile(arquivo, 'utf8')
  const avisos = []
  const ouvinte = (msg) => {
    if (msg.severity && msg.severity !== 'NOTICE') avisos.push(`${msg.severity}: ${msg.message}`)
    else if (msg.message && !/(already exists|does not exist, skipping)/i.test(msg.message)) {
      avisos.push(`NOTICE: ${msg.message}`)
    }
  }
  client.on('notice', ouvinte)

  const inicio = process.hrtime.bigint()
  try {
    await client.query(sql)
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6
    return { ok: true, ms, avisos, arquivo: path.basename(arquivo) }
  } catch (erro) {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6
    return {
      ok: false,
      ms,
      avisos,
      arquivo: path.basename(arquivo),
      erro: `${erro.code ?? ''} ${erro.message}`.trim(),
      detalhe: erro.detail ?? erro.hint ?? erro.where ?? null,
    }
  } finally {
    client.off('notice', ouvinte)
  }
}

export async function listarMigrations() {
  const arquivos = await readdir(DIR_MIGRATIONS)
  return arquivos.filter((a) => a.endsWith('.sql')).sort()
}

/** Derruba e recria a base — equivalente ao `supabase db reset`. */
export async function recriarBase() {
  const admin = new pg.Client({ ...CONFIG, database: CONFIG.manutencao })
  await admin.connect()
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = '${CONFIG.database}' and pid <> pg_backend_pid()
  `)
  await admin.query(`drop database if exists ${CONFIG.database}`)
  await admin.query(`create database ${CONFIG.database}`)
  await admin.end()
}

/**
 * Reset completo: recria a base, aplica o shim, as 13 migrations e o seed.
 * Devolve o relatório passo a passo.
 */
export async function resetCompleto({ comSeed = true } = {}) {
  const relatorio = { passos: [], ok: true, totalMs: 0 }
  const inicioTudo = process.hrtime.bigint()

  await recriarBase()

  const client = cliente()
  await client.connect()

  try {
    const shim = await rodarArquivo(client, path.join(DIR_SHIM, '00-auth-shim.sql'))
    relatorio.passos.push({ ...shim, tipo: 'shim' })
    if (!shim.ok) relatorio.ok = false

    if (relatorio.ok) {
      for (const nome of await listarMigrations()) {
        const r = await rodarArquivo(client, path.join(DIR_MIGRATIONS, nome))
        relatorio.passos.push({ ...r, tipo: 'migration' })
        if (!r.ok) {
          relatorio.ok = false
          break
        }
      }
    }

    if (relatorio.ok && comSeed) {
      const r = await rodarArquivo(client, path.join(RAIZ, 'supabase', 'seed.sql'))
      relatorio.passos.push({ ...r, tipo: 'seed' })
      if (!r.ok) relatorio.ok = false
    }
  } finally {
    await client.end()
  }

  relatorio.totalMs = Number(process.hrtime.bigint() - inicioTudo) / 1e6
  return relatorio
}

/** Executa como um papel/usuário específico, respeitando RLS. */
export async function comoUsuario(client, { userId = null, papel = 'authenticated' }, fn) {
  await client.query('begin')
  try {
    await client.query(`set local role ${papel}`)
    if (userId) {
      await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId])
    } else {
      await client.query(`select set_config('request.jwt.claim.sub', '', true)`)
    }
    return await fn()
  } finally {
    await client.query('rollback')
  }
}

/** Roda uma query esperando FALHA. Devolve o código do erro. */
export async function esperaFalhar(client, sql, params = []) {
  await client.query('savepoint teste')
  try {
    await client.query(sql, params)
    await client.query('release savepoint teste')
    return { falhou: false }
  } catch (erro) {
    await client.query('rollback to savepoint teste')
    return {
      falhou: true,
      codigo: erro.code,
      mensagem: (erro.message ?? '').split('\n')[0],
      constraint: erro.constraint ?? null,
    }
  }
}

/** Roda uma query esperando SUCESSO. */
export async function esperaPassar(client, sql, params = []) {
  await client.query('savepoint teste')
  try {
    const r = await client.query(sql, params)
    await client.query('release savepoint teste')
    return { passou: true, linhas: r.rowCount, dados: r.rows }
  } catch (erro) {
    await client.query('rollback to savepoint teste')
    return { passou: false, erro: `${erro.code} ${(erro.message ?? '').split('\n')[0]}` }
  }
}

export function tabelaMarkdown(cabecalho, linhas) {
  const sep = cabecalho.map(() => '---')
  return [
    `| ${cabecalho.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...linhas.map((l) => `| ${l.join(' | ')} |`),
  ].join('\n')
}
