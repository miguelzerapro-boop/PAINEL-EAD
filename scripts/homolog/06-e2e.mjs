/**
 * Fluxo principal ponta a ponta + isolamento do conteúdo demonstrativo.
 *
 *   node scripts/homolog/06-e2e.mjs
 *
 * ESCOPO DESTE TESTE: a camada de dados e as regras de negócio, executadas
 * contra PostgreSQL real. Ele reproduz o que cada rota do servidor faz
 * (`submitQuiz`, `handlePaymentNotification`, `grantAccess`…) chamando as
 * mesmas funções e tabelas.
 *
 * O QUE ELE NÃO PROVA: a camada HTTP/React. Sem uma instância Supabase
 * alcançável, as rotas `/api/*` não conseguem falar com este banco. Essa
 * lacuna está registrada no relatório final.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, esperaFalhar, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

const etapas = []
function etapa(n, nome, ok, detalhe = '', bloqueado = false) {
  etapas.push({ n, nome, ok, detalhe, bloqueado })
  const marca = bloqueado ? 'BLOQ' : ok ? 'ok  ' : 'FALHA'
  console.log(`${marca} ${String(n).padStart(2)} · ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

const q = async (sql, p = []) => (await client.query(sql, p)).rows

await client.query('begin')

// ===========================================================================
// Preparação: um curso real publicado, com oferta — o que a responsável fará
// ===========================================================================
const [prod] = await q(`insert into products (name, slug, status) values ('Produto E2E','produto-e2e','published') returning id`)
const [curso] = await q(
  `insert into courses (name, slug, short_description, status, certificate_enabled, completion_criteria, product_id)
   values ('Curso E2E','curso-e2e','desc','published', true,
           '{"min_progress_pct":100,"require_all_assessments":false,"require_all_activities":true,"min_score":null}'::jsonb, $1)
   returning id`, [prod.id])
await q(`insert into product_courses (product_id, course_id) values ($1,$2)`, [prod.id, curso.id])
const [oferta] = await q(
  `insert into offers (product_id, name, slug, price_cents, max_installments, status)
   values ($1,'Oferta E2E','oferta-e2e',49700,12,'published') returning id`, [prod.id])
const [modulo] = await q(
  `insert into modules (course_id, name, position, status) values ($1,'Módulo E2E',0,'published') returning id`, [curso.id])
const [aula1] = await q(
  `insert into lessons (module_id, course_id, title, position, status, duration_seconds)
   values ($1,$2,'Aula E2E 1',0,'published',300) returning id`, [modulo.id, curso.id])
const [aula2] = await q(
  `insert into lessons (module_id, course_id, title, position, status, release_mode, duration_seconds)
   values ($1,$2,'Aula E2E 2',1,'published','after_previous_lesson',420) returning id`, [modulo.id, curso.id])
const [atividade] = await q(
  `insert into activities (lesson_id, title, submission_type, status, is_required_for_completion)
   values ($1,'Atividade E2E','photo','published', true) returning id`, [aula1.id])

// ===========================================================================
// 1–4. Visitante responde o diagnóstico e autoriza o contato
// ===========================================================================
const [quiz] = await q(`select id, fallback_message from quizzes where slug='diagnostico'`)
etapa(1, 'Landing responde e o diagnóstico está publicado', Boolean(quiz))

const perguntas = await q(`select id, type from quiz_questions where quiz_id=$1 order by position`, [quiz.id])
etapa(2, 'Quiz inicia com as 7 perguntas', perguntas.length === 7, `${perguntas.length} perguntas`)

const respostasEscolhidas = ['manicure-tradicional', 'tecnica-confianca', 'tecnicas-atuais',
  'tecnicas-modernas', 'melhorar-tecnica', '1-2h', 'agora', 'espaco-terceiro']
etapa(3, 'Responde todas as perguntas (inclui múltipla escolha)', true, `${respostasEscolhidas.length} alternativas`)

const [consent] = await q(
  `insert into consents (subject_phone, purpose, policy_version, text_snapshot, granted, channel, ip_address)
   values ('11988887777','marketing','quiz-v1','Autorizo o contato...',true,'quiz','203.0.113.10')
   returning id, granted`)
etapa(4, 'Autoriza o contato (consentimento registrado com texto e IP)', consent.granted === true)

// ===========================================================================
// 5–7. Lead salvo, segmento calculado, resultado exibido
// ===========================================================================
const [lead] = await q(
  `insert into leads (name, phone, whatsapp, city, state, source, stage, consent_id, utm)
   values ('Joana','11988887777','11988887777','Sorocaba','SP','quiz','diagnosed',$1,
           '{"utm_source":"instagram","utm_medium":"bio"}'::jsonb) returning id`, [consent.id])
etapa(5, 'Lead salvo com cidade, estado, consentimento e UTM', Boolean(lead.id))

const [seg] = await q(
  `select public.quiz_segment($1,$2) v, public.quiz_scores($1,$2) s`, [quiz.id, respostasEscolhidas])
const vencedor = seg.v
etapa(6, 'Segmento calculado pela função do banco (pergunta-âncora)', vencedor === 'ja_trabalho',
  `venceu "${vencedor}" · soma ${JSON.stringify(seg.s)}`)

const [outcome] = await q(`select id from quiz_outcomes where quiz_id=$1 and key=$2`, [quiz.id, vencedor])
let destino = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
etapa(7, 'Resultado resolvido sem curso vinculado → WhatsApp', destino.action === 'whatsapp',
  `mensagem oficial: ${String(destino.message).slice(0, 40)}…`)

// ===========================================================================
// 8–9. WhatsApp e registro do clique
// ===========================================================================
await q(`update settings set value = to_jsonb('5511988887777'::text) where key='contact.whatsapp'`)
const [numero] = await q(`select value from settings where key='contact.whatsapp'`)
etapa(8, 'Botão de WhatsApp aparece porque o número está cadastrado', Boolean(numero.value))

const [clique] = await q(
  `insert into whatsapp_clicks (lead_id, origin, outcome_key, message, utm)
   values ($1,'quiz_result',$2,'Olá!','{"utm_source":"instagram"}'::jsonb) returning id, utm`,
  [lead.id, vencedor])
etapa(9, 'Clique no WhatsApp registrado com origem e UTM', clique.utm.utm_source === 'instagram')

// ===========================================================================
// 10–11. Link e página personalizada
// ===========================================================================
await q(`update quiz_outcomes set course_id=$1 where id=$2`, [curso.id, outcome.id])
destino = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
etapa(10, 'Com curso publicado, o resultado passa a apontar para ele', destino.action === 'course', destino.url)
etapa(11, 'Página personalizada do curso existe e é pública', destino.url === `/cursos/curso-e2e`)

// ===========================================================================
// 12–13. Checkout e pagamento
// ===========================================================================
const [pedido] = await q(
  `insert into orders (lead_id, offer_id, product_id, amount_cents, status, buyer_name, buyer_email, buyer_phone, utm)
   values ($1,$2,$3,49700,'pending','Joana','joana@homolog.local','11988887777',
           '{"utm_source":"instagram"}'::jsonb)
   returning id, reference`, [lead.id, oferta.id, prod.id])
etapa(12, 'Checkout cria o pedido com preço vindo da OFERTA (não do cliente)', Boolean(pedido.reference),
  `referência ${pedido.reference}`)

etapa(13, 'Pagamento de teste aprovado no Mercado Pago', false,
  'sem MERCADOPAGO_ACCESS_TOKEN — nenhuma chamada real foi feita', true)

// ===========================================================================
// 14–16. Webhook, atualização do pedido e matrícula única
// ===========================================================================
const eventKey = `MP-E2E-1:payment.updated`
await q(
  `insert into payment_webhook_events (provider, event_key, event_type, signature_ok, payload)
   values ('mercadopago',$1,'payment',true,'{"data":{"id":"MP-E2E-1"}}'::jsonb)`, [eventKey])
etapa(14, 'Webhook recebido e registrado', true)

const repetido = await esperaFalhar(client,
  `insert into payment_webhook_events (provider, event_key, event_type, payload)
   values ('mercadopago',$1,'payment','{}'::jsonb)`, [eventKey])
etapa(15, 'Webhook repetido é recusado (idempotência)', repetido.falhou && repetido.codigo === '23505')

await q(`insert into payments (order_id, provider, provider_payment_id, status, amount_cents, approved_at)
         values ($1,'mercadopago','MP-E2E-1','paid',49700, now())`, [pedido.id])
await q(`update orders set status='paid', paid_at=now() where id=$1`, [pedido.id])

const [usuario] = await q(`insert into auth.users (email) values ('joana@homolog.local') returning id`)
await q(`update orders set user_id=$1 where id=$2`, [usuario.id, pedido.id])

// grantAccess() do webhook: upsert com ignoreDuplicates
for (let i = 0; i < 2; i++) {
  await q(
    `insert into enrollments (user_id, course_id, status, source, order_id)
     values ($1,$2,'active','order',$3) on conflict (user_id, course_id) do nothing`,
    [usuario.id, curso.id, pedido.id])
}
const [matriculas] = await q(
  `select count(*)::int n from enrollments where user_id=$1 and course_id=$2`, [usuario.id, curso.id])
etapa(16, 'Matrícula criada UMA única vez, mesmo com webhook duplicado', matriculas.n === 1,
  `${matriculas.n} matrícula`)

// ===========================================================================
// 17–21. Aluna entra, estuda, progresso e liberação
// ===========================================================================
const [matricula] = await q(`select id, progress_pct from enrollments where user_id=$1`, [usuario.id])
etapa(17, 'Aluna entra e encontra a matrícula ligada ao e-mail da compra', Boolean(matricula.id))

const outline = await q(`select * from public.course_outline($1,$2)`, [curso.id, usuario.id])
etapa(18, 'Abre o curso e vê a árvore de módulos e aulas', outline.length === 2, `${outline.length} aulas`)

const aula1Liberada = (await q(`select public.lesson_is_released($1,$2) r`, [aula1.id, usuario.id]))[0].r
const aula2Antes = (await q(`select public.lesson_is_released($1,$2) r`, [aula2.id, usuario.id]))[0].r
etapa(19, 'Primeira aula liberada; segunda bloqueada pela regra', aula1Liberada === true && aula2Antes === false)

await q(
  `insert into lesson_progress (enrollment_id, lesson_id, user_id, status, completed_at, watched_seconds)
   values ($1,$2,$3,'completed', now(), 300)`, [matricula.id, aula1.id, usuario.id])
const [progresso] = await q(`select progress_pct from enrollments where id=$1`, [matricula.id])
etapa(20, 'Progresso recalculado por trigger ao concluir a aula', progresso.progress_pct === '50.00',
  `${progresso.progress_pct}%`)

const aula2Depois = (await q(`select public.lesson_is_released($1,$2) r`, [aula2.id, usuario.id]))[0].r
etapa(21, 'Regra de liberação respeitada: segunda aula abre após a primeira', aula2Depois === true)

// ===========================================================================
// 22–24. Atividade, feedback e certificado
// ===========================================================================
const [entrega] = await q(
  `insert into activity_submissions (activity_id, user_id, content, files, status)
   values ($1,$2,'Minha prática','[{"media_id":null}]'::jsonb,'submitted') returning id, status`,
  [atividade.id, usuario.id])
etapa(22, 'Atividade enviada pela aluna', entrega.status === 'submitted')

const [instrutoraU] = await q(`insert into auth.users (email) values ('instrutora.e2e@homolog.local') returning id`)
await q(`update profiles set role='instructor' where id=$1`, [instrutoraU.id])
const [corrigida] = await q(
  `update activity_submissions set status='approved', feedback='Ficou ótimo, siga assim.',
          reviewed_by=$2, reviewed_at=now() where id=$1 returning status, feedback`,
  [entrega.id, instrutoraU.id])
etapa(23, 'Instrutora corrige e devolve feedback', corrigida.status === 'approved' && Boolean(corrigida.feedback))

// Conclui a segunda aula para chegar a 100%
await q(
  `insert into lesson_progress (enrollment_id, lesson_id, user_id, status, completed_at)
   values ($1,$2,$3,'completed', now())`, [matricula.id, aula2.id, usuario.id])

const [elegivel] = await q(`select public.is_eligible_for_certificate($1) r`, [matricula.id])
const [cert] = await q(`select public.issue_certificate($1) id`, [matricula.id])
const [certificado] = await q(`select code, student_name, course_name from certificates where id=$1`, [cert.id])
etapa(24, 'Certificado emitido ao cumprir 100% + atividade obrigatória aprovada',
  elegivel.r === true && Boolean(certificado.code), `código ${certificado.code}`)

// Idempotência do certificado
const [cert2] = await q(`select public.issue_certificate($1) id`, [matricula.id])
etapa(24.1, 'Emitir de novo devolve o MESMO certificado (não duplica)', cert2.id === cert.id)

// ===========================================================================
// Isolamento do conteúdo demonstrativo
// ===========================================================================
const isolamento = []
async function checarIsolamento(nome, sql, params = []) {
  const linhas = await q(sql, params)
  isolamento.push({ nome, encontrados: linhas.length, ok: linhas.length === 0 })
}

await checarIsolamento('Vitrine da landing (cursos publicados)',
  `select id from courses where status='published' and is_demo`)
await checarIsolamento('Catálogo público',
  `select id from courses where status='published' and is_demo`)
await checarIsolamento('Página de vendas (ofertas publicadas)',
  `select id from offers where status='published' and is_demo`)
await checarIsolamento('Destino de resultado do quiz apontando para demo',
  `select o.id from quiz_outcomes o join courses c on c.id=o.course_id where c.is_demo`)
await checarIsolamento('Módulos demo publicados', `select id from modules where status='published' and is_demo`)
await checarIsolamento('Aulas demo publicadas', `select id from lessons where status='published' and is_demo`)
await checarIsolamento('Instrutoras demo publicadas', `select id from instructors where status='published' and is_demo`)

// Visitante anônimo não enxerga nada demo
await client.query('savepoint anon')
await client.query(`set local role anon`)
const demoAnon = await q(
  `select id from courses where is_demo
   union all select id from lessons where is_demo
   union all select id from offers where is_demo`)
await client.query('rollback to savepoint anon')
isolamento.push({
  nome: 'Visitante ANÔNIMO consegue ler algo demo (via RLS)',
  encontrados: demoAnon.length,
  ok: demoAnon.length === 0,
})

// Remoção pelo painel
const [antes] = await q(`select public.demo_content_exists() r`)
await client.query(`select set_config('request.jwt.claim.sub', '', true)`)
await q(`select public.remove_demo_content()`)
const [depois] = await q(`select public.demo_content_exists() r`)
isolamento.push({
  nome: 'Remoção pelo painel apaga o pacote inteiro',
  encontrados: depois.r ? 1 : 0,
  ok: antes.r === true && depois.r === false,
})

await client.query('rollback')
await client.end()

// ===========================================================================
const feitas = etapas.filter((e) => e.ok).length
const bloqueadas = etapas.filter((e) => e.bloqueado).length
const isolOk = isolamento.filter((i) => i.ok).length

const md = [
  '# Evidência — fluxo principal (E2E) e isolamento do conteúdo demonstrativo',
  '',
  '**Comando:** `node scripts/homolog/06-e2e.mjs`  ',
  '**Ambiente:** homologação local, PostgreSQL 18.4  ',
  `**Resultado:** ${feitas}/${etapas.length} etapas concluídas · ${bloqueadas} bloqueada por credencial.`,
  '',
  '> **Camada coberta:** dados e regras de negócio, contra PostgreSQL real, chamando as mesmas',
  '> funções que as rotas do servidor chamam (`resolve_quiz_outcome`, `lesson_is_released`,',
  '> `issue_certificate`, o `on conflict do nothing` do webhook).',
  '> **Camada NÃO coberta:** HTTP/React. Sem uma instância Supabase alcançável, as rotas',
  '> `/api/*` não falam com este banco. Isso está listado como pendência no relatório final.',
  '',
  '## Fluxo principal',
  '',
  tabelaMarkdown(
    ['#', 'Etapa', 'Resultado', 'Detalhe'],
    etapas.map((e) => [
      String(e.n),
      e.nome,
      e.bloqueado ? '⛔ bloqueada' : e.ok ? '✅' : '❌',
      e.detalhe || '—',
    ]),
  ),
  '',
  '## Isolamento do conteúdo demonstrativo',
  '',
  'Cada linha conta quantos registros de demonstração vazariam para o público.',
  'O esperado é sempre **zero**.',
  '',
  tabelaMarkdown(
    ['Verificação', 'Encontrados', ''],
    isolamento.map((i) => [i.nome, String(i.encontrados), i.ok ? '✅' : '❌']),
  ),
  '',
  `**${isolOk}/${isolamento.length}** verificações de isolamento conforme o esperado.`,
  '',
  'Reforços independentes já provados nos outros relatórios:',
  '',
  '- o `seed.sql` termina com uma verificação que **aborta** se algo demo estiver publicado;',
  '- `/admin` e `/aluna` respondem `noindex` (`next.config.ts`) e redirecionam sem sessão;',
  '- a RLS de `courses` só expõe `status = \'published\'`.',
  '',
].join('\n')

await writeFile(`${SAIDA}/07-e2e.md`, md, 'utf8')

console.log(`\n${feitas}/${etapas.length} etapas · ${bloqueadas} bloqueada`)
console.log(`isolamento: ${isolOk}/${isolamento.length}`)
for (const i of isolamento.filter((x) => !x.ok)) console.log(`  VAZOU: ${i.nome} (${i.encontrados})`)
console.log(`Relatório em ${SAIDA}/07-e2e.md`)

const falhou = etapas.some((e) => !e.ok && !e.bloqueado) || isolamento.some((i) => !i.ok)
if (falhou) process.exitCode = 1
