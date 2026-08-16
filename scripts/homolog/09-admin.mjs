/**
 * Bootstrap do primeiro administrador e controle de papéis.
 *
 *   node scripts/homolog/09-admin.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, esperaFalhar, rotuloDoAmbiente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()
await client.query('begin')

const q = async (sql, p = []) => (await client.query(sql, p)).rows
const casos = []
function reg(cenario, esperado, obtido, nota = '') {
  const ok = JSON.stringify(esperado) === JSON.stringify(obtido)
  casos.push({ cenario, esperado, obtido, ok, nota })
}

// Ponto de partida: nenhum administrador no banco.
await q(`update profiles set role = 'student' where role in ('admin','owner')`)

const [status0] = await q(`select public.admin_bootstrap_status() s`)
reg('Janela de bootstrap aberta quando não há administrador', true, status0.s.janela_aberta)

// --- Conta inexistente ------------------------------------------------------
const semConta = await esperaFalhar(client, `select public.bootstrap_first_admin('ninguem@homolog.local')`)
reg('Recusa e-mail sem conta', true, semConta.falhou, semConta.mensagem)

// --- Cria as contas ---------------------------------------------------------
const [dona] = await q(`insert into auth.users (email) values ('dona@homolog.local') returning id`)
const [aluna] = await q(`insert into auth.users (email) values ('aluna.papel@homolog.local') returning id`)
const [outra] = await q(`insert into auth.users (email) values ('outra@homolog.local') returning id`)

// --- Bootstrap de servidor --------------------------------------------------
const [r1] = await q(`select public.bootstrap_first_admin('dona@homolog.local') r`)
reg('Bootstrap promove a primeira pessoa a owner', 'owner', r1.r.role, JSON.stringify(r1.r.user_id))

const [papel] = await q(`select role::text from profiles where id = $1`, [dona.id])
reg('O papel realmente persistiu no banco', 'owner', papel.role,
  'era exatamente aqui que a versão anterior falhava em silêncio')

const [auditoria] = await q(
  `select action, entity_id, after_data from audit_log where action = 'bootstrap_first_admin' order by created_at desc limit 1`)
reg('Bootstrap ficou registrado na auditoria', 'bootstrap_first_admin', auditoria.action,
  `entity_id ${auditoria.entity_id}`)

// --- Janela fecha -----------------------------------------------------------
const segundaVez = await esperaFalhar(client, `select public.bootstrap_first_admin('outra@homolog.local')`)
reg('Segunda chamada é recusada', true, segundaVez.falhou, segundaVez.mensagem)

const [status1] = await q(`select public.admin_bootstrap_status() s`)
reg('Janela fechada depois do bootstrap', false, status1.s.janela_aberta)

// --- A partir de sessão autenticada ----------------------------------------
await client.query('savepoint sessao')
await client.query(`set local role authenticated`)
await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [aluna.id])
const deSessao = await esperaFalhar(client, `select public.bootstrap_first_admin('outra@homolog.local')`)
reg('Recusa quando chamada de uma sessão de navegador', true, deSessao.falhou, deSessao.mensagem)

// A aluna também não consegue via EXECUTE (o grant foi revogado).
const semGrant = await esperaFalhar(client,
  `select has_function_privilege('authenticated','public.bootstrap_first_admin(text)','execute')`)
await client.query('rollback to savepoint sessao')

const [privilegio] = await q(
  `select has_function_privilege('authenticated','public.bootstrap_first_admin(text)','execute') p`)
reg('authenticated NÃO tem EXECUTE na função de bootstrap', false, privilegio.p)
const [privAnon] = await q(
  `select has_function_privilege('anon','public.bootstrap_first_admin(text)','execute') p`)
reg('anon NÃO tem EXECUTE na função de bootstrap', false, privAnon.p)

// --- Aluna não altera o próprio papel ---------------------------------------
await client.query('savepoint aluna')
await client.query(`set local role authenticated`)
await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [aluna.id])
await client.query(`update profiles set role = 'owner' where id = $1`, [aluna.id])
const [depoisDaTentativa] = await q(`select role::text from profiles where id = $1`, [aluna.id])
reg('Aluna tentando se promover: papel continua "student"', 'student', depoisDaTentativa.role,
  'o UPDATE é aceito, mas o trigger descarta a mudança')

const proprioPapel = await esperaFalhar(client,
  `select public.set_user_role('aluna.papel@homolog.local','owner')`)
reg('Aluna não pode usar set_user_role', true, proprioPapel.falhou, proprioPapel.mensagem)
await client.query('rollback to savepoint aluna')

// --- Admin concede e revoga -------------------------------------------------
await client.query('savepoint dona')
await client.query(`set local role authenticated`)
await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [dona.id])

const [concessao] = await q(`select public.set_user_role('outra@homolog.local','admin') r`)
reg('Owner concede papel de admin', 'admin', concessao.r.para)

const [revogacao] = await q(`select public.set_user_role('outra@homolog.local','student') r`)
reg('Owner revoga o acesso', 'student', revogacao.r.para)

const autoAlteracao = await esperaFalhar(client, `select public.set_user_role('dona@homolog.local','student')`)
reg('Owner não altera o próprio papel', true, autoAlteracao.falhou, autoAlteracao.mensagem)

const [auditoriaPapel] = await q(
  `select count(*)::int n from audit_log where action = 'set_user_role'`)
reg('Concessão e revogação ficaram auditadas', true, auditoriaPapel.n >= 2, `${auditoriaPapel.n} registros`)
await client.query('rollback to savepoint dona')

await client.query('rollback')
await client.end()

/* -------------------------------------------------------------------------- */
const total = casos.length
const passaram = casos.filter((c) => c.ok).length

const md = [
  '# Evidência — primeiro administrador e controle de papéis',
  '',
  '**Comando:** `node scripts/homolog/09-admin.mjs`  ',
  `**Ambiente:** ${rotuloDoAmbiente()}  `,
  `**Resultado:** ${passaram}/${total} verificações conforme o esperado.`,
  '',
  '## Procedimento oficial',
  '',
  '1. A pessoa entra no site uma vez pelo link mágico — isso cria a conta em `auth.users`.',
  '2. No **SQL Editor do Supabase** (ou por service role), rodar:',
  '',
  '```sql',
  "select public.bootstrap_first_admin('email@dominio.com');",
  '```',
  '',
  '3. Conferir:',
  '',
  '```sql',
  'select public.admin_bootstrap_status();',
  "-- {\"janela_aberta\": false, \"administradores\": 1, ...}",
  '```',
  '',
  '4. Daí em diante, conceder e revogar pelo painel:',
  '',
  '```sql',
  "select public.set_user_role('outra@dominio.com', 'admin');   -- concede",
  "select public.set_user_role('outra@dominio.com', 'student'); -- revoga",
  '```',
  '',
  '5. Opcional, para fechar de vez: `drop function public.bootstrap_first_admin(text);`',
  '   Não é necessário — a função já se recusa a rodar enquanto existir administrador.',
  '',
  '## Travas',
  '',
  '| Trava | O que impede |',
  '| --- | --- |',
  '| Janela única | Só roda enquanto não houver nenhum admin ou owner |',
  '| Só do servidor | Recusa se `auth.uid()` não for nulo |',
  '| Sem `EXECUTE` para `anon` e `authenticated` | Não há como sequer tentar pelo navegador |',
  '| Conta obrigatória | Não cria usuário; a pessoa precisa ter entrado antes |',
  '| Auditoria | Grava em `audit_log` quem virou owner e quando |',
  '| Sem auto-alteração | Ninguém muda o próprio papel, nem o owner |',
  '',
  '## Verificações',
  '',
  tabelaMarkdown(
    ['Cenário', 'Esperado', 'Obtido', '', 'Nota'],
    casos.map((c) => [
      c.cenario,
      `\`${JSON.stringify(c.esperado)}\``,
      `\`${JSON.stringify(c.obtido)}\``,
      c.ok ? '✅' : '❌',
      c.nota || '—',
    ]),
  ),
  '',
].join('\n')

await writeFile(`${SAIDA}/11-admin.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const c of casos.filter((x) => !x.ok)) {
  console.log(`  FALHOU: ${c.cenario} → esperado ${JSON.stringify(c.esperado)}, obtido ${JSON.stringify(c.obtido)}`)
}
console.log(`Relatório em ${SAIDA}/11-admin.md`)
if (passaram !== total) process.exitCode = 1
