/**
 * Validação do diagnóstico: conteúdo, segmentação, resolução de destino e
 * versionamento.
 *
 *   node scripts/homolog/05-quiz.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, esperaFalhar, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

const casos = []
function reg(grupo, cenario, esperado, obtido, nota = '') {
  const ok = JSON.stringify(esperado) === JSON.stringify(obtido)
  casos.push({ grupo, cenario, esperado, obtido, ok, nota })
}

const q = async (sql, p = []) => (await client.query(sql, p)).rows

// ---------------------------------------------------------------------------
// 1. Conteúdo carregado
// ---------------------------------------------------------------------------
const [quiz] = await q(
  `select id, slug, status::text, version, collect_city, collect_state, collect_first_name_only,
          fallback_message, consent_text, intro_title
   from quizzes where slug = 'diagnostico'`,
)

reg('conteúdo', 'quiz publicado', 'published', quiz.status)
reg('conteúdo', 'versão inicial gravada', 1, quiz.version)
reg('conteúdo', 'coleta cidade', true, quiz.collect_city)
reg('conteúdo', 'coleta estado', true, quiz.collect_state)
reg('conteúdo', 'coleta apenas o primeiro nome', true, quiz.collect_first_name_only)
reg('conteúdo', 'texto de consentimento cadastrado', true, Boolean(quiz.consent_text))
reg(
  'conteúdo',
  'mensagem de encaminhamento exata do escopo',
  'Seu diagnostico foi concluido. Nossa equipe vai conversar com voce pelo WhatsApp para entender melhor seu momento e apresentar as opcoes disponiveis.',
  quiz.fallback_message,
)

const perguntas = await q(
  `select position, prompt, type, is_required, min_selections, max_selections,
          (select count(*) from quiz_options o where o.question_id = qq.id)::int as opcoes
   from quiz_questions qq where quiz_id = $1 order by position`,
  [quiz.id],
)
reg('conteúdo', 'quantidade de perguntas', 7, perguntas.length)
const contagemEsperada = [5, 6, 8, 8, 5, 4, 6]
perguntas.forEach((p, i) => {
  reg('conteúdo', `pergunta ${i + 1} — alternativas`, contagemEsperada[i], p.opcoes, p.prompt.slice(0, 58))
})

const multipla = perguntas.filter((p) => p.type === 'multiple')
reg('conteúdo', 'exatamente uma pergunta de múltipla escolha', 1, multipla.length)
reg('conteúdo', 'limite de seleção configurável (pergunta 4)', 3, multipla[0]?.max_selections)

const semPeso = await q(
  `select count(*)::int n from quiz_options o
   join quiz_questions qq on qq.id = o.question_id
   where qq.quiz_id = $1 and o.weights = '{}'::jsonb`,
  [quiz.id],
)
reg('conteúdo', 'alternativas neutras (peso vazio) são poucas e intencionais', true, semPeso[0].n <= 4,
  `${semPeso[0].n} alternativas sem peso`)

// Nenhuma pergunta pode citar grade/curso inexistente.
const proibidas = /m[óo]dulo|carga hor[áa]ria|certificad|aula \d|nosso curso|formação completa d[eo] /i
const suspeitas = perguntas.filter((p) => proibidas.test(p.prompt))
reg('conteúdo', 'nenhuma pergunta promete grade ou curso', 0, suspeitas.length)

// ---------------------------------------------------------------------------
// 2. Segmentação — simula respostas e confere o resultado vencedor
// ---------------------------------------------------------------------------
/** Usa as MESMAS funções do banco que a aplicação usa. */
async function segmentar(valores) {
  const [linha] = await q(
    `select public.quiz_segment($1,$2) as vencedor, public.quiz_scores($1,$2) as soma`,
    [quiz.id, valores],
  )
  return { vencedor: linha.vencedor, soma: linha.soma }
}

const perfis = [
  {
    nome: 'iniciante absoluta',
    respostas: ['nunca-trabalhei', 'renda-extra', 'por-onde-comecar', 'fundamentos', '1-2h', 'agora', 'sem-materiais'],
    esperado: 'comecar_do_zero',
  },
  {
    nome: 'faz para amigas, quer evoluir',
    respostas: ['faco-para-proximos', 'tecnica-confianca', 'tecnica-acabamento', 'melhorar-tecnica', '3-5h', '30-dias', 'materiais-basicos'],
    esperado: 'praticar_evoluir',
  },
  {
    nome: 'manicure atuante',
    respostas: ['manicure-tradicional', 'tecnica-confianca', 'tecnicas-atuais', 'tecnicas-modernas', '1-2h', 'agora', 'espaco-terceiro'],
    esperado: 'ja_trabalho',
  },
  {
    nome: 'quer organizar a carreira',
    respostas: ['nail-designer', 'proprio-espaco', 'quanto-cobrar', 'precos-organizacao', 'mais-5h', 'agora', 'espaco-proprio'],
    esperado: 'organizar_carreira',
  },
  {
    nome: 'só pesquisando',
    respostas: ['quero-voltar', 'realizacao-pessoal', 'por-onde-comecar', 'formacao-completa', 'menos-1h', 'pesquisando', 'explicar-whatsapp'],
    esperado: 'pesquisando',
  },
]

for (const p of perfis) {
  const r = await segmentar(p.respostas)
  reg('segmentação', p.nome, p.esperado, r.vencedor, JSON.stringify(r.soma))
}

// Múltipla escolha soma os pesos das várias alternativas marcadas
const multi = await segmentar(['precos-organizacao', 'divulgacao', 'atendimento'])
reg('segmentação', 'múltipla escolha soma os pesos das 3 marcadas', 'organizar_carreira', multi.vencedor,
  JSON.stringify(multi.soma))

// ---------------------------------------------------------------------------
// 3. Resolução do destino — resolve_quiz_outcome()
// ---------------------------------------------------------------------------
await client.query('begin')

const [outcome] = await q(`select id, key from quiz_outcomes where quiz_id = $1 and key = 'ja_trabalho'`, [quiz.id])

let r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'sem curso publicado → WhatsApp', 'whatsapp', r.action, r.reason)
reg('destino', 'mensagem do fallback é a oficial', true, (r.message ?? '').startsWith('Seu diagnostico foi concluido'))

// Passa a existir um curso publicado ligado ao resultado.
const [curso] = await q(
  `insert into courses (name, slug, short_description, status)
   values ('Curso Real','curso-real','desc','published') returning id`,
)
await client.query(`update quiz_outcomes set course_id = $1 where id = $2`, [curso.id, outcome.id])
r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'com curso publicado → página do curso', 'course', r.action, r.url)

// Curso volta a rascunho: precisa cair de novo no WhatsApp.
await client.query(`update courses set status = 'draft' where id = $1`, [curso.id])
r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'curso despublicado → volta para WhatsApp', 'whatsapp', r.action, r.reason)

// Oferta ativa
await client.query(`update courses set status = 'published' where id = $1`, [curso.id])
await client.query(`update quiz_outcomes set course_id = null where id = $1`, [outcome.id])
const [prod] = await q(`insert into products (name, slug, status) values ('P','p-quiz','published') returning id`)
const [oferta] = await q(
  `insert into offers (product_id, name, slug, price_cents, status)
   values ($1,'O','o-quiz',49700,'published') returning id`, [prod.id])
await client.query(`update quiz_outcomes set offer_id = $1 where id = $2`, [oferta.id, outcome.id])
r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'com oferta ativa → página da oferta', 'offer', r.action, r.url)

// Oferta expirada
await client.query(`update offers set ends_at = now() - interval '1 day' where id = $1`, [oferta.id])
r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'oferta expirada → volta para WhatsApp', 'whatsapp', r.action, r.reason)

// Página específica
await client.query(`update offers set ends_at = null where id = $1`, [oferta.id])
await client.query(
  `update quiz_outcomes set offer_id = null, target_path = '/inscricao', preferred_target = 'page' where id = $1`,
  [outcome.id])
r = (await q(`select public.resolve_quiz_outcome($1) a`, [outcome.id]))[0].a
reg('destino', 'página personalizada configurada', 'page', r.action, r.url)

// Resultado inexistente
r = (await q(`select public.resolve_quiz_outcome('00000000-0000-4000-8000-000000000000') a`))[0].a
reg('destino', 'resultado inexistente → WhatsApp (nunca quebra)', 'whatsapp', r.action, r.reason)

await client.query('rollback')

// ---------------------------------------------------------------------------
// 4. Lead, consentimento e resposta
// ---------------------------------------------------------------------------
await client.query('begin')

const [consent] = await q(
  `insert into consents (subject_phone, purpose, policy_version, text_snapshot, granted, channel)
   values ('11999999999','marketing','quiz-v1',$1,true,'quiz') returning id, granted, text_snapshot`,
  [quiz.consent_text])
reg('lead', 'consentimento grava o texto exato aceito', quiz.consent_text, consent.text_snapshot)

const [lead] = await q(
  `insert into leads (name, phone, whatsapp, city, state, source, stage, consent_id, utm)
   values ('Maria','11999999999','11999999999','Campinas','SP','quiz','diagnosed',$1,
           '{"utm_source":"instagram","utm_campaign":"bio"}'::jsonb)
   returning id, city, state, utm`, [consent.id])
reg('lead', 'cidade gravada', 'Campinas', lead.city)
reg('lead', 'estado gravado', 'SP', lead.state)
reg('lead', 'UTM preservada', 'instagram', lead.utm.utm_source)

const [resp] = await q(
  `insert into quiz_responses (quiz_id, lead_id, session_id, answers, scores, outcome_id, resolved_action, completed_at)
   values ($1,$2,'sessao-1','{"q1":"nunca-trabalhei"}'::jsonb,'{"comecar_do_zero":3}'::jsonb,$3,
           '{"action":"whatsapp"}'::jsonb, now()) returning id`,
  [quiz.id, lead.id, outcome.id])
reg('lead', 'resposta persistida', true, Boolean(resp.id))

// Lead duplicado: o mesmo telefone pode responder de novo (não há unique).
const dup = await esperaFalhar(client,
  `insert into leads (name, phone, source) values ('Maria de novo','11999999999','quiz')`)
reg('lead', 'mesmo telefone pode refazer o diagnóstico', false, dup.falhou,
  'de propósito: refazer o diagnóstico é comportamento legítimo; a deduplicação é trabalho do atendimento')

// Clique de WhatsApp registrado
const [clique] = await q(
  `insert into whatsapp_clicks (lead_id, origin, outcome_key, message, utm)
   values ($1,'quiz_result','ja_trabalho','Olá!','{"utm_source":"instagram"}'::jsonb) returning id, origin`,
  [lead.id])
reg('lead', 'clique de WhatsApp registrado com origem', 'quiz_result', clique.origin)

await client.query('rollback')

// ---------------------------------------------------------------------------
// 5. Versionamento
// ---------------------------------------------------------------------------
await client.query('begin')

const [hist0] = await q(
  `select count(*)::int n from cms_revisions where entity_type='quizzes' and entity_id=$1`, [quiz.id])
reg('versão', 'histórico da publicação inicial', 1, hist0.n)

const [snap] = await q(`select public.quiz_snapshot($1) s`, [quiz.id])
reg('versão', 'snapshot guarda as 7 perguntas', 7, snap.s.perguntas.length)
reg('versão', 'snapshot guarda os 5 resultados', 5, snap.s.resultados.length)

const [nova] = await q(`select public.publish_quiz($1, 'republicação de teste') v`, [quiz.id])
reg('versão', 'publicar de novo incrementa a versão', 2, nova.v)

const [hist1] = await q(
  `select count(*)::int n from cms_revisions where entity_type='quizzes' and entity_id=$1`, [quiz.id])
reg('versão', 'histórico ganha uma entrada', 2, hist1.n)

await client.query(`select public.unpublish_quiz($1)`, [quiz.id])
const [depois] = await q(`select status::text from quizzes where id=$1`, [quiz.id])
reg('versão', 'despublicar volta para rascunho', 'draft', depois.status)

// Não pode publicar sem pergunta
await client.query(`update quiz_questions set status = 'draft' where quiz_id = $1`, [quiz.id])
const semPergunta = await esperaFalhar(client, `select public.publish_quiz($1)`, [quiz.id])
reg('versão', 'publicar sem nenhuma pergunta é recusado', true, semPergunta.falhou, semPergunta.mensagem)

await client.query('rollback')
await client.end()

// ---------------------------------------------------------------------------
const total = casos.length
const passaram = casos.filter((c) => c.ok).length

const md = [
  '# Evidência — diagnóstico (quiz)',
  '',
  '**Comando:** `node scripts/homolog/05-quiz.mjs`  ',
  '**Ambiente:** homologação local, PostgreSQL 18.4  ',
  `**Resultado:** ${passaram}/${total} verificações conforme o esperado.`,
  '',
  '> As 7 perguntas vivem em `quiz_questions`/`quiz_options` — **nenhum texto está preso',
  '> em componente React**. O front lê do banco e o painel edita.',
  '',
  tabelaMarkdown(
    ['Grupo', 'Cenário', 'Esperado', 'Obtido', '', 'Nota'],
    casos.map((c) => [
      c.grupo,
      c.cenario,
      `\`${JSON.stringify(c.esperado)}\``,
      `\`${JSON.stringify(c.obtido)}\``,
      c.ok ? '✅' : '❌',
      c.nota || '—',
    ]),
  ),
  '',
  '## Como a segmentação funciona',
  '',
  'Cada alternativa carrega pesos por resultado em `quiz_options.weights`:',
  '',
  '```json',
  '{ "praticar_evoluir": 3, "comecar_do_zero": 1 }',
  '```',
  '',
  'O sistema soma os pesos de tudo que foi marcado e escolhe o maior. Os pesos são',
  'editáveis pelo painel — recalibrar a segmentação não exige mudar código.',
  '',
  '## O que a pergunta 4 NÃO faz',
  '',
  'A pergunta sobre interesse ("Fundamentos", "Técnicas modernas", "Preços e organização"…)',
  'descreve **temas da profissão**, não módulos de um curso. Nenhuma alternativa afirma que',
  'existe formação sobre aquilo. O destino continua sendo resolvido contra o banco.',
  '',
].join('\n')

await writeFile(`${SAIDA}/05-quiz.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const c of casos.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${c.grupo}] ${c.cenario} → esperado ${JSON.stringify(c.esperado)}, obtido ${JSON.stringify(c.obtido)}`)
}
console.log(`Relatório em ${SAIDA}/05-quiz.md`)
if (passaram !== total) process.exitCode = 1
