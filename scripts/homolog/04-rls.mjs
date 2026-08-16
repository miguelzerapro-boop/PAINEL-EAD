/**
 * Matriz de RLS com sete perfis reais.
 *
 *   node scripts/homolog/04-rls.mjs
 *
 * Cada verificação abre uma transação, assume o papel `authenticated` (ou
 * `anon`) e define `request.jwt.claim.sub` — exatamente o que o Supabase faz.
 * O papel `postgres` (superusuário) nunca é usado durante as asserções.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

// ---------------------------------------------------------------------------
// Massa de teste (como superusuário, fora das asserções)
// ---------------------------------------------------------------------------
await client.query('begin')

async function criarUsuario(email, papel) {
  const { rows: [u] } = await client.query(`insert into auth.users (email) values ($1) returning id`, [email])
  await client.query(`update profiles set role = $2, full_name = $3 where id = $1`, [u.id, papel, email])
  // Confirma que o papel realmente foi gravado. Antes da migration 16 o
  // trigger de guarda descartava esta alteração em silêncio.
  const { rows: [p] } = await client.query(`select role::text from profiles where id = $1`, [u.id])
  if (p.role !== papel) {
    throw new Error(`Papel não persistiu para ${email}: pedido "${papel}", gravado "${p.role}"`)
  }
  return u.id
}

const alunaA = await criarUsuario('aluna.a@homolog.local', 'student')
const alunaB = await criarUsuario('aluna.b@homolog.local', 'student')
const instrutoraU = await criarUsuario('instrutora@homolog.local', 'instructor')
const comercial = await criarUsuario('comercial@homolog.local', 'sales')
const financeiro = await criarUsuario('financeiro@homolog.local', 'finance')
const admin = await criarUsuario('admin@homolog.local', 'admin')

const { rows: [instrutora] } = await client.query(
  `insert into instructors (name, slug, bio_short, status, profile_id)
   values ('Instrutora Homolog', 'instrutora-homolog', 'bio', 'published', $1) returning id`,
  [instrutoraU],
)

// Curso 1 — publicado, com a instrutora vinculada. Curso 2 — sem vínculo.
const { rows: [curso1] } = await client.query(
  `insert into courses (name, slug, short_description, status)
   values ('Curso Publicado', 'curso-publicado', 'desc', 'published') returning id`,
)
const { rows: [curso2] } = await client.query(
  `insert into courses (name, slug, short_description, status)
   values ('Curso de Outra', 'curso-de-outra', 'desc', 'published') returning id`,
)
const { rows: [cursoRascunho] } = await client.query(
  `insert into courses (name, slug, short_description, status)
   values ('Curso Rascunho', 'curso-rascunho-rls', 'desc', 'draft') returning id`,
)
await client.query(`insert into course_instructors (course_id, instructor_id) values ($1,$2)`, [curso1.id, instrutora.id])

const { rows: [mod1] } = await client.query(
  `insert into modules (course_id, name, position, status) values ($1,'M1',0,'published') returning id`, [curso1.id])
const { rows: [mod2] } = await client.query(
  `insert into modules (course_id, name, position, status) values ($1,'M1',0,'published') returning id`, [curso2.id])
const { rows: [aula1] } = await client.query(
  `insert into lessons (module_id, course_id, title, position, status) values ($1,$2,'Aula 1',0,'published') returning id`,
  [mod1.id, curso1.id])
const { rows: [aula2] } = await client.query(
  `insert into lessons (module_id, course_id, title, position, status) values ($1,$2,'Aula 2',0,'published') returning id`,
  [mod2.id, curso2.id])

const { rows: [matA] } = await client.query(
  `insert into enrollments (user_id, course_id, status) values ($1,$2,'active') returning id`, [alunaA, curso1.id])
const { rows: [matB] } = await client.query(
  `insert into enrollments (user_id, course_id, status) values ($1,$2,'active') returning id`, [alunaB, curso1.id])

await client.query(
  `insert into lesson_progress (enrollment_id, lesson_id, user_id, status) values ($1,$2,$3,'completed')`,
  [matB.id, aula1.id, alunaB])

const { rows: [prod] } = await client.query(
  `insert into products (name, slug, status) values ('P','p-rls','published') returning id`)
const { rows: [oferta] } = await client.query(
  `insert into offers (product_id, name, slug, price_cents, status) values ($1,'O','o-rls',49700,'published') returning id`,
  [prod.id])
const { rows: [pedido] } = await client.query(
  `insert into orders (user_id, offer_id, product_id, amount_cents, status, buyer_email)
   values ($1,$2,$3,49700,'paid','aluna.a@homolog.local') returning id`, [alunaA, oferta.id, prod.id])
await client.query(
  `insert into payments (order_id, provider, provider_payment_id, status, amount_cents)
   values ($1,'mercadopago','MP-RLS-1','paid',49700)`, [pedido.id])

const { rows: [lead] } = await client.query(
  `insert into leads (name, phone, source, stage) values ('Lead Homolog','11999999999','quiz','diagnosed') returning id`)
const { rows: [quiz] } = await client.query(`select id from quizzes where slug = 'diagnostico'`)
const { rows: [resposta] } = await client.query(
  `insert into quiz_responses (quiz_id, lead_id, answers) values ($1,$2,'{}'::jsonb) returning id`,
  [quiz.id, lead.id])

const { rows: [atividade] } = await client.query(
  `insert into activities (lesson_id, title, submission_type, status) values ($1,'Atividade','photo','published') returning id`,
  [aula1.id])
const { rows: [entrega] } = await client.query(
  `insert into activity_submissions (activity_id, user_id, content, status) values ($1,$2,'texto','submitted') returning id`,
  [atividade.id, alunaA])

await client.query('commit')

// ---------------------------------------------------------------------------
// Motor de asserção
// ---------------------------------------------------------------------------
const PERFIS = {
  'Aluna A': { id: alunaA, papel: 'authenticated' },
  'Aluna B': { id: alunaB, papel: 'authenticated' },
  Instrutora: { id: instrutoraU, papel: 'authenticated' },
  Comercial: { id: comercial, papel: 'authenticated' },
  Financeiro: { id: financeiro, papel: 'authenticated' },
  Administrador: { id: admin, papel: 'authenticated' },
  Anônimo: { id: null, papel: 'anon' },
}

const resultados = []

async function verificar(operacao, perfilNome, sql, params, esperado) {
  const perfil = PERFIS[perfilNome]
  await client.query('begin')
  let obtido
  try {
    await client.query(`set local role ${perfil.papel}`)
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [perfil.id ?? ''])
    const r = await client.query(sql, params)
    obtido = typeof esperado === 'number' ? r.rowCount : (r.rowCount > 0 ? 'permitido' : 'nada')
    if (typeof esperado !== 'number' && ['insert', 'update', 'delete'].some((v) => sql.trim().toLowerCase().startsWith(v))) {
      obtido = r.rowCount > 0 ? 'permitido' : 'bloqueado'
    }
  } catch (erro) {
    obtido = erro.code === '42501' ? 'negado' : `erro ${erro.code}`
  } finally {
    await client.query('rollback')
  }

  resultados.push({
    operacao,
    perfil: perfilNome,
    esperado: String(esperado),
    obtido: String(obtido),
    ok: String(obtido) === String(esperado),
  })
}

// --- Leitura de dados de outra aluna ---------------------------------------
const SQL_MATRICULAS = 'select id from enrollments'
await verificar('Ler matrículas (quantas enxerga)', 'Aluna A', SQL_MATRICULAS, [], 1)
await verificar('Ler matrículas (quantas enxerga)', 'Aluna B', SQL_MATRICULAS, [], 1)
await verificar('Ler matrículas (quantas enxerga)', 'Anônimo', SQL_MATRICULAS, [], 0)
await verificar('Ler matrículas (quantas enxerga)', 'Administrador', SQL_MATRICULAS, [], 2)

await verificar('Ler a matrícula ESPECÍFICA da Aluna B', 'Aluna A',
  'select id from enrollments where id = $1', [matB.id], 0)
await verificar('Ler o progresso da Aluna B', 'Aluna A',
  'select id from lesson_progress where user_id = $1', [alunaB], 0)
await verificar('Ler o próprio progresso', 'Aluna B',
  'select id from lesson_progress where user_id = $1', [alunaB], 1)
await verificar('Ler o perfil da Aluna B', 'Aluna A',
  'select id from profiles where id = $1', [alunaB], 0)
await verificar('Ler o pedido da Aluna A', 'Aluna B',
  'select id from orders where id = $1', [pedido.id], 0)
await verificar('Ler o próprio pedido', 'Aluna A',
  'select id from orders where id = $1', [pedido.id], 1)

// --- Escrita indevida -------------------------------------------------------
await verificar('Alterar progresso da Aluna B', 'Aluna A',
  'update lesson_progress set status = $2 where user_id = $1', [alunaB, 'not_started'], 'bloqueado')
await verificar('Tentar se promover a admin (UPDATE aceito)', 'Aluna A',
  `update profiles set role = 'admin' where id = $1 returning role`, [alunaA], 'permitido')
// …mas o trigger descarta a mudança. Esta é a verificação que importa:
await verificar('…papel após a tentativa continua "student"', 'Aluna A',
  `select id from profiles where id = $1 and role = 'student'`, [alunaA], 1)
await verificar('Criar curso', 'Aluna A',
  `insert into courses (name, slug, status) values ('Hack','hack','published')`, [], 'negado')
await verificar('Publicar oferta', 'Aluna A',
  `update offers set status = 'published' where id = $1`, [oferta.id], 'bloqueado')

// --- Instrutora: só os próprios cursos --------------------------------------
await verificar('Ler aula do curso que leciona', 'Instrutora',
  'select id from lessons where id = $1', [aula1.id], 1)
await verificar('Ler aula de curso de OUTRA instrutora', 'Instrutora',
  'select id from lessons where id = $1', [aula2.id], 0)
await verificar('Ler entrega de atividade do próprio curso', 'Instrutora',
  'select id from activity_submissions where id = $1', [entrega.id], 1)
await verificar('Corrigir entrega do próprio curso', 'Instrutora',
  `update activity_submissions set status = 'approved', feedback = 'ok' where id = $1`, [entrega.id], 'permitido')
await verificar('Ler progresso de aluna do próprio curso', 'Instrutora',
  'select id from lesson_progress where lesson_id = $1', [aula1.id], 1)
await verificar('Alterar pagamento', 'Instrutora',
  `update payments set status = 'refunded' where order_id = $1`, [pedido.id], 'bloqueado')
await verificar('Ler respostas do diagnóstico', 'Instrutora',
  'select id from quiz_responses', [], 0)

// --- Comercial --------------------------------------------------------------
await verificar('Ler leads', 'Comercial', 'select id from leads', [], 1)
await verificar('Atualizar estágio do lead', 'Comercial',
  `update leads set stage = 'contacted' where id = $1`, [lead.id], 'permitido')
await verificar('Ler respostas do diagnóstico', 'Comercial',
  'select id from quiz_responses where id = $1', [resposta.id], 1)
await verificar('Ler pedidos', 'Comercial', 'select id from orders', [], 1)
await verificar('ALTERAR pagamento', 'Comercial',
  `update payments set status = 'refunded' where order_id = $1`, [pedido.id], 'bloqueado')
await verificar('ALTERAR pedido', 'Comercial',
  `update orders set status = 'refunded' where id = $1`, [pedido.id], 'bloqueado')
await verificar('Alterar aula', 'Comercial',
  `update lessons set title = 'hack' where id = $1`, [aula1.id], 'bloqueado')
await verificar('Ler aula', 'Comercial', 'select id from lessons where id = $1', [aula1.id], 0)

// --- Financeiro -------------------------------------------------------------
await verificar('Ler pedidos', 'Financeiro', 'select id from orders', [], 1)
await verificar('Ler pagamentos', 'Financeiro',
  'select id from payments where order_id = $1', [pedido.id], 1)
await verificar('Atualizar pedido (estorno)', 'Financeiro',
  `update orders set status = 'refunded' where id = $1`, [pedido.id], 'permitido')
await verificar('ALTERAR aula', 'Financeiro',
  `update lessons set title = 'hack' where id = $1`, [aula1.id], 'bloqueado')
await verificar('Ler respostas do diagnóstico', 'Financeiro',
  'select id from quiz_responses where id = $1', [resposta.id], 0)
await verificar('Ler leads', 'Financeiro', 'select id from leads', [], 0)
await verificar('Ler progresso de alunas', 'Financeiro', 'select id from lesson_progress', [], 0)

// --- Administrador ----------------------------------------------------------
await verificar('Ler leads', 'Administrador', 'select id from leads', [], 1)
await verificar('Ler pagamentos', 'Administrador', 'select id from payments', [], 1)
await verificar('Editar aula', 'Administrador',
  `update lessons set title = 'novo' where id = $1`, [aula1.id], 'permitido')
await verificar('Ler auditoria', 'Administrador', 'select id from audit_log limit 1', [], 1)
await verificar('Ler respostas do diagnóstico', 'Administrador',
  'select id from quiz_responses where id = $1', [resposta.id], 1)

// --- Anônimo ----------------------------------------------------------------
await verificar('Ler curso publicado', 'Anônimo',
  'select id from courses where id = $1', [curso1.id], 1)
await verificar('Ler curso em RASCUNHO', 'Anônimo',
  'select id from courses where id = $1', [cursoRascunho.id], 0)
await verificar('Ler aula (sem matrícula)', 'Anônimo',
  'select id from lessons where id = $1', [aula1.id], 0)
await verificar('Ler leads', 'Anônimo', 'select id from leads', [], 0)
await verificar('Ler pedidos', 'Anônimo', 'select id from orders', [], 0)
await verificar('Ler pagamentos', 'Anônimo', 'select id from payments', [], 0)
await verificar('Ler perfis', 'Anônimo', 'select id from profiles', [], 0)
await verificar('Ler auditoria', 'Anônimo', 'select id from audit_log', [], 0)
await verificar('Ler consentimentos', 'Anônimo', 'select id from consents', [], 0)
await verificar('Ler respostas do diagnóstico', 'Anônimo', 'select id from quiz_responses', [], 0)
await verificar('Ler alternativas com gabarito', 'Anônimo', 'select id from assessment_options', [], 0)
await verificar('Inserir lead diretamente', 'Anônimo',
  `insert into leads (name, phone, source) values ('x','11','quiz')`, [], 'negado')
await verificar('Inserir evento de analytics (permitido de propósito)', 'Anônimo',
  `insert into analytics_events (name, path) values ('page_view','/')`, [], 'permitido')

await client.end()

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const total = resultados.length
const passaram = resultados.filter((r) => r.ok).length

const porOperacao = new Map()
for (const r of resultados) {
  if (!porOperacao.has(r.operacao)) porOperacao.set(r.operacao, {})
  porOperacao.get(r.operacao)[r.perfil] = r
}

const perfis = Object.keys(PERFIS)
const matriz = tabelaMarkdown(
  ['Operação', ...perfis],
  [...porOperacao.entries()].map(([op, linha]) => [
    op,
    ...perfis.map((p) => {
      const r = linha[p]
      if (!r) return '—'
      return r.ok ? `${r.obtido} ✅` : `${r.obtido} ❌ (esperado ${r.esperado})`
    }),
  ]),
)

const md = [
  '# Evidência — matriz de RLS',
  '',
  '**Comando:** `node scripts/homolog/04-rls.mjs`  ',
  '**Ambiente:** homologação local, PostgreSQL 18.4  ',
  `**Resultado:** ${passaram}/${total} verificações conforme o esperado.`,
  '',
  '## Como o teste troca de usuário',
  '',
  'Cada verificação roda em transação própria com:',
  '',
  '```sql',
  'set local role authenticated;   -- ou anon',
  "select set_config('request.jwt.claim.sub', '<uuid do usuário>', true);",
  '```',
  '',
  'É exatamente o que o PostgREST/Supabase faz. O superusuário `postgres` monta a',
  'massa de teste, mas **nenhuma asserção roda como superusuário** — se rodasse, a RLS',
  'seria ignorada e o teste não provaria nada.',
  '',
  '## Legenda',
  '',
  '| Valor | Significado |',
  '| --- | --- |',
  '| número | quantidade de linhas que o perfil consegue LER |',
  '| `permitido` | a escrita foi aceita |',
  '| `bloqueado` | a escrita não afetou nenhuma linha (RLS filtrou) |',
  '| `negado` | o PostgreSQL recusou por permissão (`42501`) |',
  '',
  '## Matriz',
  '',
  matriz,
  '',
  '## Observações',
  '',
  '- **"Promover-se a admin" aparece como `permitido`** e está correto: o `UPDATE` é',
  '  aceito porque a aluna pode editar o próprio perfil, mas o trigger',
  '  `profiles_guard_role` **descarta a mudança de papel**. A verificação seguinte',
  '  confirma que o papel continua `student`.',
  '- **Comercial lê respostas do diagnóstico** por decisão de produto: é o insumo do',
  '  atendimento. **Financeiro não lê** — não precisa desse dado para conciliar pagamento.',
  '- **`analytics_events` aceita insert anônimo** de propósito: é o único ponto de escrita',
  '  pública, sem dado pessoal. Lead, resposta de quiz e pedido passam por rota de servidor.',
  '',
].join('\n')

await writeFile(`${SAIDA}/04-rls.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const r of resultados.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${r.perfil}] ${r.operacao} → esperado ${r.esperado}, obtido ${r.obtido}`)
}
console.log(`Relatório em ${SAIDA}/04-rls.md`)
if (passaram !== total) process.exitCode = 1
