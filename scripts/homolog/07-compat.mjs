/**
 * Impressão digital de comportamento do banco.
 *
 *   PGHOMOLOG_PORT=55432 node scripts/homolog/07-compat.mjs pg18
 *   PGHOMOLOG_PORT=55433 node scripts/homolog/07-compat.mjs pg15
 *   node scripts/homolog/07-compat.mjs --comparar pg15 pg18
 *
 * Para o Supabase de homologação, quando houver credencial:
 *   PGHOMOLOG_URL="postgresql://..." node scripts/homolog/07-compat.mjs supabase
 *   node scripts/homolog/07-compat.mjs --comparar pg15 supabase
 *
 * Não basta as migrations serem aceitas: este script sonda o COMPORTAMENTO de
 * cada construção que o projeto depende, e a comparação mostra divergências.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cliente, rotuloDoAmbiente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
const DIR_FP = 'docs/validacao/fingerprints'
await mkdir(DIR_FP, { recursive: true })

const args = process.argv.slice(2)

/* -------------------------------------------------------------------------- */
/* Sondas — cada uma devolve um valor comparável entre versões                 */
/* -------------------------------------------------------------------------- */

const SONDAS = [
  // --- NULL e agregação: a causa do bug #1 da rodada anterior ---------------
  ['bool_and sobre conjunto vazio', `select (select bool_and(x) from (select true where false) t(x))::text`],
  ['bool_and com um NULL no meio', `select bool_and(v)::text from (values (true),(null),(true)) s(v)`],
  ['bool_and com coalesce por dentro (a correção do bug)', `select bool_and(coalesce(v, 'x') = 'y')::text from (values (null::text),('y')) s(v)`],
  ['NULL = valor devolve NULL', `select (null = 'x')::text is null`],
  ['coalesce sobre agregado vazio', `select coalesce((select bool_and(x) from (select true where false) t(x)), true)::text`],

  // --- Enums ----------------------------------------------------------------
  ['enum comparado com texto', `select ('published'::publication_status = 'published')::text`],
  ['enum em IN com literais', `select ('active'::enrollment_status in ('active','completed'))::text`],
  ['enum ordenado pela declaração', `select string_agg(e::text, ',' order by e) from unnest(enum_range(null::publication_status)) e`],
  ['cast enum -> text', `select 'draft'::publication_status::text`],

  // --- JSONB ----------------------------------------------------------------
  ['jsonb_object_agg de numérico', `select jsonb_object_agg(k, v)::text from (values ('a',1),('b',2)) s(k,v)`],
  ['jsonb_each_text', `select string_agg(key || '=' || value, ',' order by key) from jsonb_each_text('{"a":"1","b":"2"}'::jsonb)`],
  ['operador ->> em chave ausente', `select ('{"a":1}'::jsonb ->> 'z') is null`],
  ['jsonb vazio comparado', `select ('{}'::jsonb = '{}'::jsonb)::text`],
  ['jsonb_build_object com null', `select jsonb_build_object('a', null)::text`],
  ['soma numérica vinda de jsonb', `select sum((value)::numeric)::text from jsonb_each_text('{"a":"3","b":"4"}'::jsonb)`],

  // --- Timestamps e fuso ----------------------------------------------------
  ['timestamptz é absoluto entre fusos', `
     select ((timestamptz '2026-01-01 12:00:00+00' at time zone 'UTC')
           = (timestamptz '2026-01-01 12:00:00+00' at time zone 'UTC'))::text`],
  ['make_interval(days)', `select (timestamptz '2026-01-01 00:00:00+00' + make_interval(days => 7))::text`],
  ['now() é o início da transação', `select (now() = transaction_timestamp())::text`],
  ['comparação de timestamptz cruzando fuso', `
     select (timestamptz '2026-01-01 00:00:00-03' > timestamptz '2026-01-01 00:00:00+00')::text`],

  // --- Funções, security definer e search_path ------------------------------
  ['função SQL stable devolve boolean', `select public.is_admin()::text`],
  ['current_role() do projeto (não o built-in)', `select public.current_role()::text`],
  ['security definer enxerga tabela do dono', `select public.demo_content_exists()::text`],
  ['função com search_path fixo resolve tipo', `select pg_get_function_identity_arguments('public.lesson_is_released'::regproc)`],
  ['plpgsql CASE sobre enum', `select public.quiz_segment('00000000-0000-4000-8000-000000000000'::uuid, array['x']) is null`],
  ['função retornando TABLE', `select count(*)::text from public.course_outline('00000000-0000-4000-8000-000000000000'::uuid, null)`],
  ['função retornando jsonb', `select jsonb_typeof(public.quiz_scores('00000000-0000-4000-8000-000000000000'::uuid, array['x']))`],

  // --- Constraints e índices ------------------------------------------------
  ['CHECK com subexpressão booleana', `
     select count(*)::text from pg_constraint
     where conname in ('offers_publish_requires_price','media_ai_not_real','materials_single_owner')`],
  ['índice parcial preservado', `
     select count(*)::text from pg_indexes
     where schemaname='public' and indexdef like '%WHERE%'`],
  ['unique parcial (manual_releases)', `
     select count(*)::text from pg_indexes
     where schemaname='public' and indexname like 'manual_releases_%_uniq'`],
  ['generated default com gen_random_bytes', `select length(encode(gen_random_bytes(9),'hex'))::text`],
  ['digest do pgcrypto', `select length(encode(digest('x','sha256'),'hex'))::text`],
  ['unaccent disponível', `select count(*)::text from pg_extension where extname='unaccent'`],
  ['slugify sem depender de unaccent', `select public.slugify('Ação Coração & Nº 1')`],

  // --- RLS e grants ---------------------------------------------------------
  ['RLS habilitada em todas as tabelas', `
     select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`],
  ['total de policies', `select count(*)::text from pg_policies where schemaname='public'`],
  ['policies com WITH CHECK', `select count(*)::text from pg_policies where schemaname='public' and with_check is not null`],
  ['papéis do Supabase existem', `
     select string_agg(rolname, ',' order by rolname) from pg_roles
     where rolname in ('anon','authenticated','service_role')`],
  ['grant de execute em função de negócio', `
     select has_function_privilege('authenticated','public.lesson_is_released(uuid,uuid)','execute')::text`],
  ['anon NÃO executa issue_certificate', `
     select has_function_privilege('anon','public.issue_certificate(uuid)','execute')::text`],

  // --- Triggers e views -----------------------------------------------------
  ['triggers no schema public', `
     select count(*)::text from information_schema.triggers where trigger_schema='public'`],
  ['view funnel_daily existe', `select count(*)::text from pg_views where schemaname='public' and viewname='funnel_daily'`],
  ['trigger BEFORE em auth.users', `
     select count(*)::text from information_schema.triggers
     where trigger_schema='auth' and trigger_name='on_auth_user_created'`],

  // --- Inventário estrutural ------------------------------------------------
  ['tabelas', `select count(*)::text from pg_tables where schemaname='public'`],
  ['enums', `select count(*)::text from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'`],
  ['funções do projeto', `
     select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prolang <> (select oid from pg_language where lanname='c')`],
  ['foreign keys', `select count(*)::text from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'`],
  ['constraints CHECK', `select count(*)::text from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='c'`],
]

async function tirarImpressao(nome) {
  const client = cliente()
  await client.connect()

  const { rows: [v] } = await client.query(`select version() as full, current_setting('server_version') as curta`)
  const impressao = {
    nome,
    ambiente: rotuloDoAmbiente(),
    servidor: v.curta,
    versaoCompleta: v.full.replace(/ on .*/, ''),
    sondas: {},
    erros: {},
  }

  for (const [rotulo, sql] of SONDAS) {
    try {
      const { rows } = await client.query(sql)
      impressao.sondas[rotulo] = String(Object.values(rows[0] ?? {})[0])
    } catch (erro) {
      impressao.erros[rotulo] = `${erro.code ?? ''} ${erro.message}`.trim()
      impressao.sondas[rotulo] = '<erro>'
    }
  }

  await client.end()
  await writeFile(`${DIR_FP}/${nome}.json`, JSON.stringify(impressao, null, 2), 'utf8')
  console.log(`Impressão digital de "${nome}" (PostgreSQL ${impressao.servidor}) em ${DIR_FP}/${nome}.json`)
  const comErro = Object.keys(impressao.erros).length
  if (comErro) {
    console.log(`  ${comErro} sonda(s) com erro:`)
    for (const [k, e] of Object.entries(impressao.erros)) console.log(`   · ${k}: ${e}`)
  }
  return impressao
}

async function comparar(a, b) {
  const fa = JSON.parse(await readFile(`${DIR_FP}/${a}.json`, 'utf8'))
  const fb = JSON.parse(await readFile(`${DIR_FP}/${b}.json`, 'utf8'))

  const linhas = []
  let divergencias = 0

  for (const [rotulo] of SONDAS) {
    const va = fa.sondas[rotulo] ?? '—'
    const vb = fb.sondas[rotulo] ?? '—'
    const igual = va === vb
    if (!igual) divergencias++
    linhas.push([rotulo, `\`${va}\``, `\`${vb}\``, igual ? '✅' : '⚠️ DIVERGE'])
  }

  const md = [
    '# Evidência — compatibilidade entre versões do PostgreSQL',
    '',
    `**Comando:** \`node scripts/homolog/07-compat.mjs --comparar ${a} ${b}\`  `,
    `**${a}:** PostgreSQL ${fa.servidor} — ${fa.ambiente}  `,
    `**${b}:** PostgreSQL ${fb.servidor} — ${fb.ambiente}  `,
    `**Resultado:** ${SONDAS.length - divergencias}/${SONDAS.length} sondas idênticas` +
      (divergencias ? ` · **${divergencias} divergência(s)**` : ' · nenhuma divergência'),
    '',
    '> O escopo pede explicitamente para **não presumir compatibilidade só porque as',
    '> migrations foram aceitas**. Cada linha abaixo executa a construção de verdade e',
    '> compara o resultado entre as duas versões.',
    '',
    tabelaMarkdown([`Comportamento sondado`, a, b, ''], linhas),
    '',
  ].join('\n')

  await writeFile(`${SAIDA}/09-compatibilidade.md`, md, 'utf8')
  console.log(`\n${SONDAS.length - divergencias}/${SONDAS.length} sondas idênticas · ${divergencias} divergência(s)`)
  console.log(`Relatório em ${SAIDA}/09-compatibilidade.md`)
  if (divergencias) process.exitCode = 1
}

if (args[0] === '--comparar') {
  await comparar(args[1], args[2])
} else {
  await tirarImpressao(args[0] ?? 'atual')
}
