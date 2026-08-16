/**
 * Testes de CONSTRAINT com inserts reais.
 *
 *   node scripts/homolog/02-constraints.mjs
 *
 * Cada caso executa um INSERT/UPDATE de verdade e registra o código de erro
 * do PostgreSQL. Não basta a constraint existir no SQL — ela precisa recusar.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, esperaFalhar, esperaPassar, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()
await client.query('begin') // tudo dentro de uma transação; ao final, rollback

const casos = []

async function deveRecusar(nome, esperado, sql, params = []) {
  const r = await esperaFalhar(client, sql, params)
  const ok = r.falhou && (!esperado || r.constraint === esperado || (r.mensagem ?? '').includes(esperado) || r.codigo === esperado)
  casos.push({
    nome,
    tipo: 'deve recusar',
    esperado: esperado ?? 'qualquer erro',
    obtido: r.falhou ? `${r.codigo} · ${r.constraint ?? r.mensagem.slice(0, 90)}` : 'ACEITOU (!)',
    ok,
  })
  return r
}

async function deveAceitar(nome, sql, params = []) {
  const r = await esperaPassar(client, sql, params)
  casos.push({
    nome,
    tipo: 'deve aceitar',
    esperado: 'sucesso',
    obtido: r.passou ? `ok (${r.linhas} linha)` : `RECUSOU: ${r.erro}`,
    ok: r.passou,
  })
  return r
}

// ---------------------------------------------------------------------------
// Massa mínima de apoio
// ---------------------------------------------------------------------------
const { rows: [prod] } = await client.query(
  `insert into products (name, slug, status) values ('Produto teste', 'produto-teste', 'draft') returning id`,
)
const { rows: [curso] } = await client.query(
  `insert into courses (name, slug, short_description, status)
   values ('Curso teste', 'curso-teste', 'descrição', 'draft') returning id`,
)
const { rows: [modulo] } = await client.query(
  `insert into modules (course_id, name, position, status) values ($1, 'Módulo teste', 0, 'published') returning id`,
  [curso.id],
)
const { rows: [aula] } = await client.query(
  `insert into lessons (module_id, course_id, title, position, status)
   values ($1, $2, 'Aula teste', 0, 'published') returning id`,
  [modulo.id, curso.id],
)
const { rows: [usuario] } = await client.query(
  `insert into auth.users (email) values ('constraint@teste.local') returning id`,
)
const { rows: [consent] } = await client.query(
  `insert into consents (subject_email, purpose, policy_version, text_snapshot, granted)
   values ('c@teste.local', 'image_use', 'v1', 'texto', true) returning id`,
)

// ---------------------------------------------------------------------------
// 1. Oferta publicada sem preço
// ---------------------------------------------------------------------------
await deveRecusar(
  'Oferta publicada sem preço',
  'offers_publish_requires_price',
  `insert into offers (product_id, name, slug, price_cents, status)
   values ($1, 'Oferta sem preço', 'oferta-sem-preco', null, 'published')`,
  [prod.id],
)
await deveAceitar(
  'Oferta publicada COM preço',
  `insert into offers (product_id, name, slug, price_cents, status)
   values ($1, 'Oferta ok', 'oferta-ok', 49700, 'published')`,
  [prod.id],
)
await deveAceitar(
  'Oferta em rascunho sem preço',
  `insert into offers (product_id, name, slug, price_cents, status)
   values ($1, 'Oferta rascunho', 'oferta-rascunho', null, 'draft')`,
  [prod.id],
)

// ---------------------------------------------------------------------------
// 2. Depoimentos
// ---------------------------------------------------------------------------
await deveRecusar(
  'Depoimento publicado SEM verificação',
  'testimonials_publish_requires_proof',
  `insert into testimonials (author_name, content, source, is_verified, consent_id, status)
   values ('Fulana', 'texto', 'whatsapp', false, $1, 'published')`,
  [consent.id],
)
await deveRecusar(
  'Depoimento publicado SEM consentimento',
  'testimonials_publish_requires_proof',
  `insert into testimonials (author_name, content, source, is_verified, consent_id, status)
   values ('Fulana', 'texto', 'whatsapp', true, null, 'published')`,
)
await deveRecusar(
  'Depoimento com origem inválida',
  '23514',
  `insert into testimonials (author_name, content, source, status)
   values ('Fulana', 'texto', 'inventado', 'draft')`,
)
await deveAceitar(
  'Depoimento verificado + consentido',
  `insert into testimonials (author_name, content, source, is_verified, consent_id, status)
   values ('Fulana', 'texto', 'whatsapp', true, $1, 'published')`,
  [consent.id],
)

// ---------------------------------------------------------------------------
// 3. Métricas públicas
// ---------------------------------------------------------------------------
await deveRecusar(
  'Métrica publicada sem fonte',
  'public_metrics_publish_requires_source',
  `insert into public_metrics (key, label, value_number, measured_at, source_note, status)
   values ('alunas', 'Alunas', 500, current_date, null, 'published')`,
)
await deveRecusar(
  'Métrica publicada sem data de medição',
  'public_metrics_publish_requires_source',
  `insert into public_metrics (key, label, value_number, measured_at, source_note, status)
   values ('alunas2', 'Alunas', 500, null, 'planilha interna', 'published')`,
)
await deveRecusar(
  'Métrica publicada sem valor',
  'public_metrics_publish_requires_source',
  `insert into public_metrics (key, label, value_number, value_text, measured_at, source_note, status)
   values ('alunas3', 'Alunas', null, null, current_date, 'planilha', 'published')`,
)
await deveAceitar(
  'Métrica com valor, fonte e data',
  `insert into public_metrics (key, label, value_number, measured_at, source_note, status)
   values ('alunas4', 'Alunas', 500, current_date, 'planilha interna 2026-07', 'published')`,
)

// ---------------------------------------------------------------------------
// 4. Bloco de CMS publicado sem campo obrigatório
// ---------------------------------------------------------------------------
const { rows: [pagina] } = await client.query(`select id from cms_pages where key = 'home'`)

await deveRecusar(
  'Bloco hero publicado com campos obrigatórios vazios',
  'nao pode ser publicado',
  `insert into cms_sections (page_id, block_type, position, content, status)
   values ($1, 'hero', 0, '{"title":"Só o título"}'::jsonb, 'published')`,
  [pagina.id],
)
await deveAceitar(
  'Bloco hero em rascunho, incompleto (permitido)',
  `insert into cms_sections (page_id, block_type, position, draft_content, status)
   values ($1, 'hero', 1, '{"title":"Só o título"}'::jsonb, 'draft')`,
  [pagina.id],
)
const blocoCompleto = await deveAceitar(
  'Bloco hero publicado com todos os campos',
  `insert into cms_sections (page_id, block_type, position, content, status)
   values ($1, 'hero', 2,
     '{"title":"T","lead":"L","cta_label":"C","cta_href":"/diagnostico"}'::jsonb, 'published')
   returning id, missing_fields`,
  [pagina.id],
)
casos.push({
  nome: 'Bloco completo fica com missing_fields vazio',
  tipo: 'verificação',
  esperado: '{}',
  obtido: JSON.stringify(blocoCompleto.dados?.[0]?.missing_fields ?? null),
  ok: (blocoCompleto.dados?.[0]?.missing_fields ?? ['x']).length === 0,
})

// missing_fields calculado no rascunho
const { rows: [rascunho] } = await client.query(
  `select missing_fields from cms_sections where page_id = $1 and position = 1`,
  [pagina.id],
)
casos.push({
  nome: 'Rascunho incompleto lista as pendências',
  tipo: 'verificação',
  esperado: 'lead, cta_label, cta_href',
  obtido: (rascunho.missing_fields ?? []).join(', '),
  ok: ['lead', 'cta_label', 'cta_href'].every((c) => (rascunho.missing_fields ?? []).includes(c)),
})

// ---------------------------------------------------------------------------
// 5. Procedência de imagem
// ---------------------------------------------------------------------------
await deveRecusar(
  'Imagem de BANCO marcada como pessoa real',
  'media_ai_not_real',
  `insert into media_assets (path, source, depicts_real_person, consent_id)
   values ('stock/1.jpg', 'stock', true, $1)`,
  [consent.id],
)
await deveRecusar(
  'Imagem gerada por IA marcada como pessoa real',
  'media_ai_not_real',
  `insert into media_assets (path, source, depicts_real_person, consent_id)
   values ('ia/1.jpg', 'ai_generated', true, $1)`,
  [consent.id],
)
await deveRecusar(
  'Foto de pessoa real SEM consentimento',
  'media_real_person_needs_consent',
  `insert into media_assets (path, source, depicts_real_person, consent_id)
   values ('ensaio/1.jpg', 'own_shoot', true, null)`,
)
await deveAceitar(
  'Foto de pessoa real COM consentimento',
  `insert into media_assets (path, source, depicts_real_person, consent_id)
   values ('ensaio/2.jpg', 'own_shoot', true, $1)`,
  [consent.id],
)
await deveAceitar(
  'Imagem de banco sem pessoa real (ex.: textura)',
  `insert into media_assets (path, source, depicts_real_person)
   values ('stock/textura.jpg', 'stock', false)`,
)

// ---------------------------------------------------------------------------
// 6. Duplicidades
// ---------------------------------------------------------------------------
await client.query(`insert into profiles (id, role) values ($1, 'student') on conflict do nothing`, [usuario.id])
const { rows: [matricula] } = await client.query(
  `insert into enrollments (user_id, course_id, status) values ($1, $2, 'active') returning id`,
  [usuario.id, curso.id],
)
await deveRecusar(
  'Matrícula duplicada (mesma aluna, mesmo curso)',
  '23505',
  `insert into enrollments (user_id, course_id, status) values ($1, $2, 'active')`,
  [usuario.id, curso.id],
)

const { rows: [pedido] } = await client.query(
  `insert into orders (amount_cents, status, buyer_email) values (49700, 'paid', 'x@y.z') returning id`,
)
await client.query(
  `insert into payments (order_id, provider, provider_payment_id, status, amount_cents)
   values ($1, 'mercadopago', 'MP-123', 'paid', 49700)`,
  [pedido.id],
)
await deveRecusar(
  'Pagamento duplicado (mesmo provider_payment_id)',
  '23505',
  `insert into payments (order_id, provider, provider_payment_id, status, amount_cents)
   values ($1, 'mercadopago', 'MP-123', 'paid', 49700)`,
  [pedido.id],
)

await client.query(
  `insert into payment_webhook_events (provider, event_key, event_type, payload)
   values ('mercadopago', 'MP-123:payment.updated', 'payment', '{}'::jsonb)`,
)
await deveRecusar(
  'Webhook repetido (mesma event_key) — base da idempotência',
  '23505',
  `insert into payment_webhook_events (provider, event_key, event_type, payload)
   values ('mercadopago', 'MP-123:payment.updated', 'payment', '{}'::jsonb)`,
)

await client.query(
  `insert into certificates (enrollment_id, user_id, course_id, code, student_name, course_name, validation_hash)
   values ($1, $2, $3, 'ABC123', 'Aluna', 'Curso', 'hash')`,
  [matricula.id, usuario.id, curso.id],
)
await deveRecusar(
  'Certificado duplicado para a mesma matrícula',
  '23505',
  `insert into certificates (enrollment_id, user_id, course_id, code, student_name, course_name, validation_hash)
   values ($1, $2, $3, 'DEF456', 'Aluna', 'Curso', 'hash2')`,
  [matricula.id, usuario.id, curso.id],
)
await deveRecusar(
  'Código de certificado duplicado',
  '23505',
  `insert into certificates (enrollment_id, user_id, course_id, code, student_name, course_name, validation_hash)
   values ($1, $2, $3, 'ABC123', 'Aluna', 'Curso', 'hash3')`,
  [matricula.id, usuario.id, curso.id],
)

await deveRecusar(
  'Slug de curso duplicado',
  '23505',
  `insert into courses (name, slug, status) values ('Outro', 'curso-teste', 'draft')`,
)
await deveRecusar(
  'Slug de oferta duplicado',
  '23505',
  `insert into offers (product_id, name, slug, price_cents, status)
   values ($1, 'Outra', 'oferta-ok', 100, 'draft')`,
  [prod.id],
)

// ---------------------------------------------------------------------------
// 7. Relacionamentos e coerência
// ---------------------------------------------------------------------------
// O trigger `lessons_sync_course` roda BEFORE INSERT e copia o course_id do
// módulo. Com módulo inexistente ele resulta em NULL, então quem barra é o
// NOT NULL (23502) antes da FK (23503). O insert é recusado do mesmo jeito.
await deveRecusar(
  'Aula em módulo inexistente (barrada por NOT NULL antes da FK)',
  '23502',
  `insert into lessons (module_id, course_id, title, position)
   values ('00000000-0000-4000-8000-000000000000', $1, 'Órfã', 0)`,
  [curso.id],
)
await deveRecusar(
  'Módulo em curso inexistente (FK direta)',
  '23503',
  `insert into modules (course_id, name, position)
   values ('00000000-0000-4000-8000-000000000000', 'Órfão', 0)`,
)
await deveRecusar(
  'Material sem dono (nem curso, nem módulo, nem aula)',
  'materials_single_owner',
  `insert into materials (title, kind, external_url) values ('Solto', 'link', 'https://x.y')`,
)
await deveRecusar(
  'Material com dois donos ao mesmo tempo',
  'materials_single_owner',
  `insert into materials (course_id, lesson_id, title, kind, external_url)
   values ($1, $2, 'Dois donos', 'link', 'https://x.y')`,
  [curso.id, aula.id],
)
await deveRecusar(
  'Material sem arquivo nem link',
  'materials_has_target',
  `insert into materials (lesson_id, title, kind) values ($1, 'Vazio', 'link')`,
  [aula.id],
)
await deveRecusar(
  'Liberação "em uma data" sem informar a data',
  'modules_release_date_required',
  `insert into modules (course_id, name, position, release_mode, release_at)
   values ($1, 'Sem data', 9, 'on_date', null)`,
  [curso.id],
)
await deveRecusar(
  'Liberação "N dias" sem informar os dias',
  'lessons_release_days_required',
  `insert into lessons (module_id, course_id, title, position, release_mode, release_days)
   values ($1, $2, 'Sem dias', 9, 'days_after_enrollment', null)`,
  [modulo.id, curso.id],
)
await deveRecusar(
  'Aula ao vivo sem horário de início',
  'lessons_live_requires_start',
  `insert into lessons (module_id, course_id, title, position, content_type, live_starts_at)
   values ($1, $2, 'Ao vivo', 8, 'live', null)`,
  [modulo.id, curso.id],
)
await deveRecusar(
  'Aviso para "curso" sem informar o curso',
  'notices_audience_target',
  `insert into notices (title, body, audience, course_id) values ('Aviso', 'texto', 'course', null)`,
)
await deveRecusar(
  'Curso publicado sem descrição curta',
  'courses_publish_requires_description',
  `insert into courses (name, slug, short_description, status)
   values ('Sem descrição', 'sem-descricao', null, 'published')`,
)
await deveRecusar(
  'Curso agendado sem data de publicação',
  'courses_scheduled_requires_date',
  `insert into courses (name, slug, short_description, status, published_at)
   values ('Agendado', 'agendado', 'desc', 'scheduled', null)`,
)
await deveRecusar(
  'Prazo de acesso "por dias" sem informar os dias',
  'courses_access_days_required',
  `insert into courses (name, slug, access_mode, access_days) values ('X', 'x-dias', 'days', null)`,
)
await deveRecusar(
  'Progresso fora da faixa 0–100',
  '23514',
  `update enrollments set progress_pct = 150 where id = $1`,
  [matricula.id],
)
await deveRecusar(
  'Duração de aula igual a zero',
  '23514',
  `update lessons set duration_seconds = 0 where id = $1`,
  [aula.id],
)

// ---------------------------------------------------------------------------
// 8. Trigger de sincronia e de papel
// ---------------------------------------------------------------------------
const sync = await esperaPassar(
  client,
  `insert into lessons (module_id, course_id, title, position)
   values ($1, '00000000-0000-4000-8000-000000000000', 'Curso errado', 7)
   returning course_id`,
  [modulo.id],
)
casos.push({
  nome: 'Trigger corrige course_id divergente da aula',
  tipo: 'verificação',
  esperado: curso.id,
  obtido: sync.dados?.[0]?.course_id ?? sync.erro,
  ok: sync.dados?.[0]?.course_id === curso.id,
})

// ---------------------------------------------------------------------------
await client.query('rollback')
await client.end()

// --- Relatório -------------------------------------------------------------
const total = casos.length
const passaram = casos.filter((c) => c.ok).length

const md = [
  '# Evidência — testes de constraint',
  '',
  '**Comando:** `node scripts/homolog/02-constraints.mjs`  ',
  '**Ambiente:** homologação local, PostgreSQL 18.4, base `homolog`  ',
  '**Execução:** todos os casos rodam dentro de uma transação com `rollback` ao final — o banco não fica sujo.  ',
  `**Resultado:** ${passaram}/${total} casos conforme o esperado.`,
  '',
  'Cada linha abaixo é um `INSERT`/`UPDATE` realmente executado contra o PostgreSQL.',
  '',
  tabelaMarkdown(
    ['Caso', 'Expectativa', 'Esperado', 'Obtido', ''],
    casos.map((c) => [c.nome, c.tipo, `\`${c.esperado}\``, `\`${c.obtido}\``, c.ok ? '✅' : '❌']),
  ),
  '',
  '## Códigos do PostgreSQL',
  '',
  '| Código | Significado |',
  '| --- | --- |',
  '| `23505` | violação de unicidade |',
  '| `23503` | violação de chave estrangeira |',
  '| `23514` | violação de CHECK |',
  '| `P0001` | exceção levantada por trigger (`raise exception`) |',
  '',
].join('\n')

await writeFile(`${SAIDA}/02-constraints.md`, md, 'utf8')

console.log(`\n${passaram}/${total} casos conforme o esperado`)
for (const c of casos.filter((x) => !x.ok)) {
  console.log(`  FALHOU: ${c.nome} → esperado ${c.esperado}, obtido ${c.obtido}`)
}
console.log(`Relatório em ${SAIDA}/02-constraints.md`)
if (passaram !== total) process.exitCode = 1
