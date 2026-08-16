/**
 * Testes das SETE regras de liberação, executadas contra
 * `public.lesson_is_released()` e `public.module_is_released()`.
 *
 *   node scripts/homolog/03-liberacao.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()
await client.query('begin')

const casos = []

function registrar(regra, cenario, esperado, obtido, observacao = '') {
  casos.push({ regra, cenario, esperado, obtido, ok: esperado === obtido, observacao })
}

async function liberada(lessonId, userId) {
  const { rows } = await client.query('select public.lesson_is_released($1, $2) as r', [lessonId, userId])
  return rows[0].r
}
async function moduloLiberado(moduleId, userId) {
  const { rows } = await client.query('select public.module_is_released($1, $2) as r', [moduleId, userId])
  return rows[0].r
}

/** Cria um curso publicado com N módulos publicados e devolve os ids. */
async function montarCurso(slug, { statusCurso = 'published' } = {}) {
  const { rows: [c] } = await client.query(
    `insert into courses (name, slug, short_description, status)
     values ($1, $1, 'desc', $2) returning id`,
    [slug, statusCurso],
  )
  return c.id
}
async function novoModulo(cursoId, nome, posicao, extra = {}) {
  const campos = { release_mode: 'immediate', status: 'published', ...extra }
  const { rows: [m] } = await client.query(
    `insert into modules (course_id, name, position, release_mode, release_at, release_days,
                          release_cohort_id, prerequisite_module_id, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [cursoId, nome, posicao, campos.release_mode, campos.release_at ?? null, campos.release_days ?? null,
     campos.release_cohort_id ?? null, campos.prerequisite_module_id ?? null, campos.status],
  )
  return m.id
}
async function novaAula(moduloId, cursoId, titulo, posicao, extra = {}) {
  const campos = { release_mode: 'immediate', status: 'published', is_free: false, ...extra }
  const { rows: [l] } = await client.query(
    `insert into lessons (module_id, course_id, title, position, release_mode, release_at, release_days,
                          release_cohort_id, prerequisite_lesson_id, status, is_free)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [moduloId, cursoId, titulo, posicao, campos.release_mode, campos.release_at ?? null,
     campos.release_days ?? null, campos.release_cohort_id ?? null, campos.prerequisite_lesson_id ?? null,
     campos.status, campos.is_free],
  )
  return l.id
}
async function novaAluna(email) {
  const { rows: [u] } = await client.query(`insert into auth.users (email) values ($1) returning id`, [email])
  await client.query(`insert into profiles (id, role) values ($1,'student') on conflict do nothing`, [u.id])
  return u.id
}
/**
 * `starts_at` e `expires_at` são expressões SQL, não datas do Node.
 *
 * Motivo: `now()` no PostgreSQL é o horário de INÍCIO DA TRANSAÇÃO. Como todo
 * este script roda dentro de um `begin`, uma data gerada pelo relógio do Node
 * cai depois de `now()` e `enrollment_is_active` passa a recusar a matrícula
 * — um falso negativo do teste, não do produto.
 */
async function matricular(userId, cursoId, extra = {}) {
  const inicio = extra.starts_at ?? 'now()'
  const fim = extra.expires_at ?? 'null'
  const { rows: [e] } = await client.query(
    `insert into enrollments (user_id, course_id, status, starts_at, expires_at, cohort_id)
     values ($1, $2, $3, ${inicio}, ${fim}, $4) returning id`,
    [userId, cursoId, extra.status ?? 'active', extra.cohort_id ?? null],
  )
  return e.id
}
async function concluir(matriculaId, aulaId, userId) {
  await client.query(
    `insert into lesson_progress (enrollment_id, lesson_id, user_id, status, completed_at)
     values ($1,$2,$3,'completed', now())
     on conflict (enrollment_id, lesson_id) do update set status='completed', completed_at=now()`,
    [matriculaId, aulaId, userId],
  )
}

// ===========================================================================
// REGRA 1 — Liberação imediata
// ===========================================================================
{
  const curso = await montarCurso('r1-imediata')
  const mod = await novoModulo(curso, 'M1', 0)
  const aula = await novaAula(mod, curso, 'A1', 0)
  const aluna = await novaAluna('r1@teste.local')
  await matricular(aluna, curso)

  registrar('1 · imediata', 'aluna matriculada', true, await liberada(aula, aluna))
  registrar('1 · imediata', 'usuário SEM matrícula', false, await liberada(aula, await novaAluna('r1b@teste.local')))
  registrar('1 · imediata', 'usuário anônimo (null)', false, await liberada(aula, null))
}

// ===========================================================================
// REGRA 2 — Após concluir a AULA anterior
// ===========================================================================
{
  const curso = await montarCurso('r2-aula-anterior')
  const mod = await novoModulo(curso, 'M1', 0)
  const a1 = await novaAula(mod, curso, 'A1', 0)
  const a2 = await novaAula(mod, curso, 'A2', 1, { release_mode: 'after_previous_lesson' })
  const aluna = await novaAluna('r2@teste.local')
  const mat = await matricular(aluna, curso)

  registrar('2 · após aula anterior', 'primeira aula do módulo (sem anterior)', true, await liberada(a1, aluna))
  registrar('2 · após aula anterior', 'A2 antes de concluir A1', false, await liberada(a2, aluna))
  await concluir(mat, a1, aluna)
  registrar('2 · após aula anterior', 'A2 depois de concluir A1 (transição)', true, await liberada(a2, aluna))
}

// ===========================================================================
// REGRA 3 — Após concluir o MÓDULO anterior
// ===========================================================================
{
  const curso = await montarCurso('r3-modulo-anterior')
  const m1 = await novoModulo(curso, 'M1', 0)
  const m2 = await novoModulo(curso, 'M2', 1, { release_mode: 'after_previous_module' })
  const a1 = await novaAula(m1, curso, 'M1A1', 0)
  const a2 = await novaAula(m1, curso, 'M1A2', 1)
  const b1 = await novaAula(m2, curso, 'M2A1', 0)
  const aluna = await novaAluna('r3@teste.local')
  const mat = await matricular(aluna, curso)

  registrar('3 · após módulo anterior', 'M2 com M1 incompleto', false, await moduloLiberado(m2, aluna))
  registrar('3 · após módulo anterior', 'aula de M2 bloqueada junto', false, await liberada(b1, aluna))
  await concluir(mat, a1, aluna)
  registrar('3 · após módulo anterior', 'M2 com M1 parcialmente concluído', false, await moduloLiberado(m2, aluna))
  await concluir(mat, a2, aluna)
  registrar('3 · após módulo anterior', 'M2 com M1 100% concluído (transição)', true, await moduloLiberado(m2, aluna))
  registrar('3 · após módulo anterior', 'aula de M2 liberada junto', true, await liberada(b1, aluna))
}

// ===========================================================================
// REGRA 4 — Em uma data específica (+ fuso horário)
// ===========================================================================
{
  const curso = await montarCurso('r4-data')
  const mod = await novoModulo(curso, 'M1', 0)
  const { rows: [datas] } = await client.query(
    `select (now() + interval '1 hour') as futuro, (now() - interval '1 hour') as passado`,
  )
  const futura = await novaAula(mod, curso, 'Futura', 0, {
    release_mode: 'on_date',
    release_at: datas.futuro,
  })
  const passada = await novaAula(mod, curso, 'Passada', 1, {
    release_mode: 'on_date',
    release_at: datas.passado,
  })
  const aluna = await novaAluna('r4@teste.local')
  await matricular(aluna, curso)

  registrar('4 · em uma data', 'data no futuro', false, await liberada(futura, aluna))
  registrar('4 · em uma data', 'data no passado', true, await liberada(passada, aluna))

  // Fuso: timestamptz é absoluto — o resultado não pode mudar com o TimeZone.
  for (const tz of ['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati']) {
    await client.query(`set local timezone = '${tz}'`)
    registrar('4 · em uma data', `fuso ${tz} — futura continua bloqueada`, false, await liberada(futura, aluna))
    registrar('4 · em uma data', `fuso ${tz} — passada continua liberada`, true, await liberada(passada, aluna))
  }
  await client.query(`set local timezone = 'UTC'`)
}

// ===========================================================================
// REGRA 5 — N dias após a matrícula
// ===========================================================================
{
  const curso = await montarCurso('r5-dias')
  const mod = await novoModulo(curso, 'M1', 0)
  const aula = await novaAula(mod, curso, 'D7', 0, { release_mode: 'days_after_enrollment', release_days: 7 })

  const recente = await novaAluna('r5a@teste.local')
  await matricular(recente, curso)
  registrar('5 · N dias após matrícula', 'matriculada hoje, regra de 7 dias', false, await liberada(aula, recente))

  const antiga = await novaAluna('r5b@teste.local')
  await matricular(antiga, curso, { starts_at: `now() - interval '8 days'` })
  registrar('5 · N dias após matrícula', 'matriculada há 8 dias', true, await liberada(aula, antiga))

  const limite = await novaAluna('r5c@teste.local')
  await matricular(limite, curso, { starts_at: `now() - interval '7 days 1 minute'` })
  registrar('5 · N dias após matrícula', 'exatamente no limite de 7 dias', true, await liberada(aula, limite))

  const quase = await novaAluna('r5d@teste.local')
  await matricular(quase, curso, { starts_at: `now() - interval '6 days 23 hours'` })
  registrar('5 · N dias após matrícula', 'faltando 1 hora para os 7 dias', false, await liberada(aula, quase))
}

// ===========================================================================
// REGRA 6 — Liberação manual
// ===========================================================================
{
  const curso = await montarCurso('r6-manual')
  const mod = await novoModulo(curso, 'M1', 0)
  const aula = await novaAula(mod, curso, 'Manual', 0, { release_mode: 'manual' })
  const aluna = await novaAluna('r6@teste.local')
  await matricular(aluna, curso)
  const outra = await novaAluna('r6b@teste.local')
  await matricular(outra, curso)

  registrar('6 · manual', 'sem liberação registrada', false, await liberada(aula, aluna))
  await client.query(
    `insert into manual_releases (user_id, course_id, lesson_id) values ($1,$2,$3)`,
    [aluna.valueOf(), curso, aula],
  )
  registrar('6 · manual', 'após a instrutora liberar (transição)', true, await liberada(aula, aluna))
  registrar('6 · manual', 'liberação NÃO vaza para outra aluna', false, await liberada(aula, outra))
}

// ===========================================================================
// REGRA 7 — Por turma
// ===========================================================================
{
  const curso = await montarCurso('r7-turma')
  const { rows: [turmaA] } = await client.query(
    `insert into cohorts (course_id, name, starts_at, status) values ($1,'Turma A', now() - interval '1 day','published') returning id`,
    [curso],
  )
  const { rows: [turmaB] } = await client.query(
    `insert into cohorts (course_id, name, starts_at, status) values ($1,'Turma B', now() - interval '1 day','published') returning id`,
    [curso],
  )
  const mod = await novoModulo(curso, 'M1', 0)
  const aula = await novaAula(mod, curso, 'Só turma A', 0, {
    release_mode: 'by_cohort',
    release_cohort_id: turmaA.id,
  })

  const daTurmaA = await novaAluna('r7a@teste.local')
  await matricular(daTurmaA, curso, { cohort_id: turmaA.id })
  const daTurmaB = await novaAluna('r7b@teste.local')
  await matricular(daTurmaB, curso, { cohort_id: turmaB.id })
  const semTurma = await novaAluna('r7c@teste.local')
  await matricular(semTurma, curso)

  registrar('7 · por turma', 'aluna da turma correta', true, await liberada(aula, daTurmaA))
  registrar('7 · por turma', 'aluna de outra turma', false, await liberada(aula, daTurmaB))
  registrar('7 · por turma', 'aluna sem turma', false, await liberada(aula, semTurma))
}

// ===========================================================================
// Situações transversais
// ===========================================================================
{
  const curso = await montarCurso('t-transversal')
  const mod = await novoModulo(curso, 'M1', 0)
  const aula = await novaAula(mod, curso, 'A1', 0)
  const aulaRascunho = await novaAula(mod, curso, 'Rascunho', 1, { status: 'draft' })
  const aulaGratis = await novaAula(mod, curso, 'Grátis', 2, { is_free: true })

  const cancelada = await novaAluna('t1@teste.local')
  await matricular(cancelada, curso, { status: 'cancelled' })
  registrar('transversal', 'matrícula CANCELADA', false, await liberada(aula, cancelada))

  const expirada = await novaAluna('t2@teste.local')
  await matricular(expirada, curso, {
    starts_at: `now() - interval '30 days'`,
    expires_at: `now() - interval '1 day'`,
  })
  registrar('transversal', 'matrícula EXPIRADA', false, await liberada(aula, expirada))

  const suspensa = await novaAluna('t3@teste.local')
  await matricular(suspensa, curso, { status: 'suspended' })
  registrar('transversal', 'matrícula SUSPENSA', false, await liberada(aula, suspensa))

  const ativa = await novaAluna('t4@teste.local')
  await matricular(ativa, curso)
  registrar('transversal', 'aula em RASCUNHO', false, await liberada(aulaRascunho, ativa))
  registrar('transversal', 'aula GRATUITA sem matrícula', true, await liberada(aulaGratis, null))
  registrar('transversal', 'aula gratuita continua liberada para matriculada', true, await liberada(aulaGratis, ativa))

  // Módulo em rascunho
  const modRascunho = await novoModulo(curso, 'M-rascunho', 5, { status: 'draft' })
  const aulaEmModRascunho = await novaAula(modRascunho, curso, 'A-oculta', 0)
  registrar('transversal', 'módulo em RASCUNHO bloqueia a aula', false, await liberada(aulaEmModRascunho, ativa))

  // Curso em rascunho
  const cursoRascunho = await montarCurso('t-curso-rascunho', { statusCurso: 'draft' })
  const modCr = await novoModulo(cursoRascunho, 'M', 0)
  const aulaCr = await novaAula(modCr, cursoRascunho, 'A', 0)
  const alunaCr = await novaAluna('t5@teste.local')
  await matricular(alunaCr, cursoRascunho)
  registrar('transversal', 'curso em RASCUNHO (aula publicada, com matrícula)', false, await liberada(aulaCr, alunaCr),
    'corrigido na migration 14 — antes a função não olhava o status do curso')

  // Aula gratuita de curso não publicado não pode circular.
  const aulaGratisRascunho = await novaAula(modCr, cursoRascunho, 'Grátis oculta', 1, { is_free: true })
  registrar('transversal', 'aula GRATUITA de curso em rascunho', false, await liberada(aulaGratisRascunho, null),
    'corrigido na migration 14')

  // Pré-requisito explícito
  const cursoPre = await montarCurso('t-prereq')
  const mPre = await novoModulo(cursoPre, 'M1', 0)
  const aPre1 = await novaAula(mPre, cursoPre, 'Base', 0)
  const aPre2 = await novaAula(mPre, cursoPre, 'Depende', 1, { prerequisite_lesson_id: aPre1 })
  const alunaPre = await novaAluna('t6@teste.local')
  const matPre = await matricular(alunaPre, cursoPre)
  registrar('transversal', 'pré-requisito explícito não cumprido', false, await liberada(aPre2, alunaPre))
  await concluir(matPre, aPre1, alunaPre)
  registrar('transversal', 'pré-requisito explícito cumprido', true, await liberada(aPre2, alunaPre))
}

// ===========================================================================
// Progresso recalculado por trigger
// ===========================================================================
{
  const curso = await montarCurso('t-progresso')
  const mod = await novoModulo(curso, 'M1', 0)
  const a1 = await novaAula(mod, curso, 'A1', 0)
  const a2 = await novaAula(mod, curso, 'A2', 1)
  const aluna = await novaAluna('p1@teste.local')
  const mat = await matricular(aluna, curso)

  await concluir(mat, a1, aluna)
  const { rows: [p1] } = await client.query('select progress_pct, status from enrollments where id=$1', [mat])
  registrar('progresso', '1 de 2 aulas concluídas', '50.00', p1.progress_pct)

  await concluir(mat, a2, aluna)
  const { rows: [p2] } = await client.query(
    'select progress_pct, status, completed_at is not null as concluida from enrollments where id=$1',
    [mat],
  )
  registrar('progresso', '2 de 2 aulas concluídas', '100.00', p2.progress_pct)
  registrar('progresso', 'status vira "completed"', 'completed', p2.status)
  registrar('progresso', 'completed_at preenchido', true, p2.concluida)
}

await client.query('rollback')
await client.end()

// --- Relatório -------------------------------------------------------------
const total = casos.length
const passaram = casos.filter((c) => c.ok).length

const md = [
  '# Evidência — as sete regras de liberação',
  '',
  '**Comando:** `node scripts/homolog/03-liberacao.mjs`  ',
  '**Ambiente:** homologação local, PostgreSQL 18.4  ',
  '**Sob teste:** `public.lesson_is_released(lesson_id, user_id)` e `public.module_is_released(module_id, user_id)`  ',
  `**Resultado:** ${passaram}/${total} casos conforme o esperado.`,
  '',
  '> A interface **consulta essas funções** — `getCourseOutline()` chama o RPC `course_outline`,',
  '> que por sua vez chama `lesson_is_released()`. A regra não está duplicada em JavaScript.',
  '> O único código JS relacionado é `src/lib/content/gating.ts`, que apenas **traduz o modo em',
  '> texto** para explicar o motivo do bloqueio à aluna.',
  '',
  tabelaMarkdown(
    ['Regra', 'Cenário', 'Esperado', 'Obtido', '', 'Observação'],
    casos.map((c) => [
      c.regra,
      c.cenario,
      `\`${c.esperado}\``,
      `\`${c.obtido}\``,
      c.ok ? '✅' : '❌',
      c.observacao || '—',
    ]),
  ),
  '',
  '## Motivo textual do bloqueio',
  '',
  'Definido em `src/lib/content/gating.ts` e exibido na palheta/linha bloqueada:',
  '',
  '| Modo | Texto mostrado à aluna |',
  '| --- | --- |',
  '| `on_date` | "Esta aula abre em {data}." |',
  '| `days_after_enrollment` | "Esta aula abre {N} dias após a sua matrícula." |',
  '| `after_previous_lesson` | "Esta aula abre quando você concluir a aula anterior." |',
  '| `after_previous_module` | "Este módulo abre quando você concluir o módulo anterior." |',
  '| `manual` | "Esta aula é liberada pela instrutora." |',
  '| `by_cohort` | "Esta aula abre junto com a sua turma." |',
  '| sem modo conhecido | "Esta aula ainda não está liberada para você." |',
  '',
].join('\n')

await writeFile(`${SAIDA}/03-liberacao.md`, md, 'utf8')

console.log(`\n${passaram}/${total} casos conforme o esperado`)
for (const c of casos.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${c.regra}] ${c.cenario} → esperado ${c.esperado}, obtido ${c.obtido}`)
}
console.log(`Relatório em ${SAIDA}/03-liberacao.md`)
if (passaram !== total) process.exitCode = 1
