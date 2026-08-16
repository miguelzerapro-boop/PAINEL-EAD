/**
 * Executa o reset completo DUAS VEZES e grava a evidência.
 *
 *   node scripts/homolog/01-migrations.mjs
 *
 * Prova pedida no escopo: uma instalação limpa funciona do zero, e o reset
 * repetido também.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, listarMigrations, resetCompleto, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const linhasRelatorio = []
const rodadas = []

for (const numero of [1, 2]) {
  console.log(`\n=== RESET ${numero} ===`)
  const r = await resetCompleto()
  rodadas.push(r)

  for (const passo of r.passos) {
    const marca = passo.ok ? 'ok  ' : 'FALHA'
    console.log(`${marca} ${passo.arquivo.padEnd(46)} ${passo.ms.toFixed(0).padStart(6)} ms`)
    if (!passo.ok) {
      console.log(`      erro: ${passo.erro}`)
      if (passo.detalhe) console.log(`      detalhe: ${passo.detalhe}`)
    }
    for (const aviso of passo.avisos) console.log(`      ${aviso}`)
  }
  console.log(`total: ${r.totalMs.toFixed(0)} ms · ${r.ok ? 'SUCESSO' : 'FALHOU'}`)
}

// --- Inventário do que ficou no banco -------------------------------------
const client = cliente()
await client.connect()

const consultas = {
  extensoes: `select extname from pg_extension where extname not in ('plpgsql') order by 1`,
  enums: `select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typtype = 'e' order by 1`,
  tabelas: `select tablename from pg_tables where schemaname = 'public' order by 1`,
  views: `select viewname from pg_views where schemaname = 'public' order by 1`,
  funcoes: `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' order by 1`,
  triggers: `select distinct trigger_name from information_schema.triggers
             where trigger_schema in ('public','auth') order by 1`,
  indices: `select indexname from pg_indexes where schemaname = 'public' order by 1`,
  policies: `select policyname from pg_policies where schemaname = 'public' order by 1`,
  constraintsCheck: `select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
                     where n.nspname = 'public' and c.contype = 'c' order by 1`,
  foreignKeys: `select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
                where n.nspname = 'public' and c.contype = 'f' order by 1`,
}

const inventario = {}
for (const [chave, sql] of Object.entries(consultas)) {
  const r = await client.query(sql)
  inventario[chave] = r.rows.map((linha) => Object.values(linha)[0])
}

// RLS habilitada em todas as tabelas?
const semRls = await client.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1
`)

// Conteúdo demonstrativo — precisa existir e estar todo em rascunho.
const demo = await client.query(`
  select 'courses' as t, count(*) filter (where is_demo) as demo,
         count(*) filter (where is_demo and status = 'published') as publicado from courses
  union all select 'modules', count(*) filter (where is_demo),
         count(*) filter (where is_demo and status = 'published') from modules
  union all select 'lessons', count(*) filter (where is_demo),
         count(*) filter (where is_demo and status = 'published') from lessons
  union all select 'offers', count(*) filter (where is_demo),
         count(*) filter (where is_demo and status = 'published') from offers
  union all select 'instructors', count(*) filter (where is_demo),
         count(*) filter (where is_demo and status = 'published') from instructors
  order by 1
`)

const bootstrap = await client.query(`
  select
    (select count(*) from settings) as settings,
    (select count(*) from settings where is_required and value is null) as settings_pendentes,
    (select count(*) from cms_block_types) as tipos_bloco,
    (select count(*) from cms_pages) as paginas,
    (select count(*) from image_slots) as vagas_foto,
    (select count(*) from quiz_outcomes) as resultados_quiz,
    (select count(*) from quiz_questions) as perguntas_quiz,
    (select count(*) from testimonials) as depoimentos,
    (select count(*) from retention_policies) as retencao
`)

await client.end()

// --- Relatório -------------------------------------------------------------
linhasRelatorio.push('# Evidência — execução das migrations')
linhasRelatorio.push('')
linhasRelatorio.push('## Ambiente')
linhasRelatorio.push('')
linhasRelatorio.push('| Item | Valor |')
linhasRelatorio.push('| --- | --- |')
linhasRelatorio.push('| Tipo | **HOMOLOGAÇÃO LOCAL** — não é produção, não é o Supabase |')
linhasRelatorio.push('| Motor | PostgreSQL 18.4 embarcado (`@embedded-postgres/windows-x64`) |')
linhasRelatorio.push('| Host | `localhost:55432` (só loopback) |')
linhasRelatorio.push('| Base | `homolog` |')
linhasRelatorio.push('| Autenticação | `trust` em loopback — sem credencial a ocultar |')
linhasRelatorio.push('| Schema `auth` | **shim** de `scripts/homolog/00-auth-shim.sql` |')
linhasRelatorio.push('| Backup | dispensável: base criada do zero por este script |')
linhasRelatorio.push('| Comando | `node scripts/homolog/01-migrations.mjs` |')
linhasRelatorio.push('')
linhasRelatorio.push('> **Divergência conhecida:** o Supabase roda PostgreSQL 15 e aqui a validação')
linhasRelatorio.push('> foi feita em 18.4, porque não há Docker nesta máquina. O DDL usado é padrão')
linhasRelatorio.push('> e não depende de recurso exclusivo de nenhuma das duas versões, mas isto')
linhasRelatorio.push('> **não substitui** rodar `supabase db reset` antes de ir para produção.')
linhasRelatorio.push('')

for (const [i, r] of rodadas.entries()) {
  linhasRelatorio.push(`## Reset ${i + 1} — ${r.ok ? 'SUCESSO' : 'FALHOU'} (${r.totalMs.toFixed(0)} ms)`)
  linhasRelatorio.push('')
  linhasRelatorio.push(
    tabelaMarkdown(
      ['#', 'Arquivo', 'Tipo', 'Resultado', 'Tempo', 'Avisos'],
      r.passos.map((p, n) => [
        String(n + 1),
        `\`${p.arquivo}\``,
        p.tipo,
        p.ok ? 'ok' : `**ERRO** — ${p.erro}`,
        `${p.ms.toFixed(0)} ms`,
        p.avisos.length ? p.avisos.join('<br>') : '—',
      ]),
    ),
  )
  linhasRelatorio.push('')
}

linhasRelatorio.push('## Inventário do banco após o reset')
linhasRelatorio.push('')
linhasRelatorio.push(
  tabelaMarkdown(
    ['Objeto', 'Quantidade', 'Nomes'],
    [
      ['Extensões', inventario.extensoes.length, inventario.extensoes.join(', ')],
      ['Enums', inventario.enums.length, inventario.enums.join(', ')],
      ['Tabelas', inventario.tabelas.length, inventario.tabelas.join(', ')],
      ['Views', inventario.views.length, inventario.views.join(', ') || '—'],
      ['Funções', inventario.funcoes.length, inventario.funcoes.join(', ')],
      ['Triggers', inventario.triggers.length, inventario.triggers.join(', ')],
      ['Índices', inventario.indices.length, '—'],
      ['Policies RLS', inventario.policies.length, '—'],
      ['Constraints CHECK', inventario.constraintsCheck.length, '—'],
      ['Foreign keys', inventario.foreignKeys.length, '—'],
    ],
  ),
)
linhasRelatorio.push('')
linhasRelatorio.push(
  `**Tabelas sem RLS habilitada:** ${semRls.rows.length === 0 ? 'nenhuma ✅' : semRls.rows.map((r) => r.relname).join(', ')}`,
)
linhasRelatorio.push('')
linhasRelatorio.push('## Conteúdo de demonstração (seed)')
linhasRelatorio.push('')
linhasRelatorio.push(
  tabelaMarkdown(
    ['Tabela', 'Registros demo', 'Publicados'],
    demo.rows.map((r) => [r.t, r.demo, r.publicado === '0' ? '0 ✅' : `${r.publicado} ⚠️`]),
  ),
)
linhasRelatorio.push('')
linhasRelatorio.push('## Bootstrap estrutural')
linhasRelatorio.push('')
const b = bootstrap.rows[0]
linhasRelatorio.push(
  tabelaMarkdown(
    ['Item', 'Quantidade'],
    [
      ['Chaves de configuração', b.settings],
      ['…delas obrigatórias e ainda vazias', b.settings_pendentes],
      ['Tipos de bloco do CMS', b.tipos_bloco],
      ['Páginas do CMS', b.paginas],
      ['Vagas de foto', b.vagas_foto],
      ['Resultados do quiz', b.resultados_quiz],
      ['Perguntas do quiz', b.perguntas_quiz],
      ['Depoimentos', b.depoimentos],
      ['Políticas de retenção', b.retencao],
    ],
  ),
)
linhasRelatorio.push('')

await writeFile(`${SAIDA}/01-migrations.md`, linhasRelatorio.join('\n'), 'utf8')
console.log(`\nRelatório em ${SAIDA}/01-migrations.md`)

if (!rodadas.every((r) => r.ok)) process.exitCode = 1
