/**
 * FORMAÇÃO, AULAS E VÍDEO — verificação de ponta a ponta no banco.
 *
 *   node scripts/homolog/10-formacao.mjs
 *
 * Cobre o que o banco pode provar sozinho:
 *   A. os oito capítulos aprovados, na ordem, sem aula inventada;
 *   B. capítulo vazio e capítulo com aula;
 *   C. publicação e liberação — `lesson_is_released` como fonte da verdade;
 *   D. quem pode ENVIAR vídeo (RLS de lesson_video_uploads);
 *   E. quem pode ASSISTIR (policies de storage.objects em lesson-videos);
 *   F. antiórfão e arquivamento com histórico.
 *
 * Cada asserção roda numa transação própria, assumindo `authenticated` ou
 * `anon` e definindo `request.jwt.claim.sub` — exatamente o que o Supabase
 * faz. O superusuário nunca é usado dentro de uma asserção.
 *
 * O QUE ESTE SCRIPT NÃO PROVA: o serviço de Storage do Supabase em si
 * (assinatura de URL, PUT do arquivo, Range). Isso exige um Supabase real —
 * ver docs/22-upload-de-video.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cliente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

const resultados = []
function verificar(grupo, nome, ok, obtido, esperado) {
  resultados.push({ grupo, nome, ok, obtido: String(obtido), esperado: String(esperado) })
}

/** Roda uma consulta como um perfil real, respeitando RLS. */
async function como(papel, userId, fn) {
  await client.query('begin')
  try {
    await client.query(`set local role ${papel}`)
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return await fn()
  } finally {
    await client.query('rollback')
  }
}

/**
 * Roda um INSERT dentro de savepoint. `true` = aceito, `false` = recusado.
 * Usado para provar constraints e índices sem abortar a transação de teste.
 */
async function esperaPassarLocal(sql, params = []) {
  await client.query('savepoint t')
  try {
    await client.query(sql, params)
    await client.query('release savepoint t')
    return true
  } catch {
    await client.query('rollback to savepoint t')
    return false
  }
}

/**
 * Igual à anterior, mas SEMPRE desfaz — mesmo quando dá certo.
 *
 * Necessária para provar a constraint de status um estado por vez: como só
 * pode existir um envio ativo por aula, deixar as linhas acumularem faria a
 * segunda inserção falhar pelo índice, e não pelo que se quer medir.
 */
async function aceitaEDesfaz(sql, params = []) {
  await client.query('savepoint t')
  try {
    await client.query(sql, params)
    await client.query('rollback to savepoint t')
    return true
  } catch {
    await client.query('rollback to savepoint t')
    return false
  }
}

/** Quantas linhas este perfil consegue LER da consulta. */
async function contarComo(papel, userId, sql, params = []) {
  return como(papel, userId, async () => {
    const r = await client.query(sql, params)
    return r.rowCount
  })
}

/**
 * Tenta escrever. Devolve:
 *
 *   'permitido'  — a linha foi gravada;
 *   'recusado'   — a POLICY recusou. Num INSERT isso vem como erro 42501 com
 *                  "row-level security", não como zero linhas: o Postgres
 *                  levanta em vez de filtrar em silêncio;
 *   'filtrado'   — a escrita não achou linha para afetar (USING de UPDATE/DELETE);
 *   'sem-grant'  — falta permissão de tabela, antes mesmo da RLS.
 *
 * A distinção importa: "recusado" prova que a policy funcionou; "sem-grant"
 * provaria só que ninguém consegue usar a tabela, o que não é a mesma coisa.
 */
async function escreverComo(papel, userId, sql, params = []) {
  return como(papel, userId, async () => {
    try {
      const r = await client.query(sql, params)
      return r.rowCount > 0 ? 'permitido' : 'filtrado'
    } catch (e) {
      if (e.code === '42501') {
        return /row-level security/i.test(e.message ?? '') ? 'recusado' : 'sem-grant'
      }
      return `erro:${e.code}`
    }
  })
}

/* ========================================================================== */
/* A. OS OITO CAPÍTULOS                                                       */
/* ========================================================================== */

const NOMES_APROVADOS = [
  'Manicure e Pedicure Iniciante',
  'Curso de Aperfeiçoamento Manicure',
  'Cutícula Fundinha',
  'Acabamento Impecável',
  'Curso de Esmaltação em Gel',
  'Curso de Blindagem',
  'Curso de Banho de Gel',
  'Curso de Unhas de Fibra',
]

const { rows: capitulos } = await client.query(`
  select m.position, m.name, m.slug, m.status::text
  from modules m join courses c on c.id = m.course_id
  where c.slug = 'formacao'
  order by m.position
`)

verificar('A. Conteúdo', 'existem exatamente 8 capítulos', capitulos.length === 8, capitulos.length, 8)

const ordemCorreta = capitulos.every((c, i) => c.name === NOMES_APROVADOS[i])
verificar(
  'A. Conteúdo',
  'os 8 nomes aparecem na ordem aprovada',
  ordemCorreta,
  ordemCorreta ? 'ordem correta' : capitulos.map((c) => c.name).join(' | '),
  'ordem aprovada',
)

const todosRascunho = capitulos.every((c) => c.status === 'draft')
verificar(
  'A. Conteúdo',
  'nenhum capítulo nasce publicado',
  todosRascunho,
  todosRascunho ? 'todos draft' : capitulos.map((c) => c.status).join(','),
  'todos draft',
)

const { rows: [aulasDaMigration] } = await client.query(`
  select count(*)::int n from lessons l join courses c on c.id = l.course_id where c.slug = 'formacao'
`)
verificar(
  'A. Conteúdo',
  'a migration não inventou nenhuma aula',
  aulasDaMigration.n === 0,
  aulasDaMigration.n,
  0,
)

const DESCRICAO_APROVADA =
  'Formação online organizada em oito capítulos para acompanhar diferentes etapas do desenvolvimento profissional em manicure e cuidados com unhas.'

const { rows: [cursoFormacao] } = await client.query(
  `select id, status::text, short_description from courses where slug = 'formacao'`,
)

// §8: a descrição destrava o cadastro da estrutura. NÃO publica nada.
verificar(
  'A. Conteúdo',
  'a formação continua em rascunho mesmo com a descrição cadastrada',
  cursoFormacao.status === 'draft',
  cursoFormacao.status,
  'draft',
)
verificar(
  'A. Conteúdo',
  'a descrição curta é exatamente a aprovada, sem texto inventado',
  cursoFormacao.short_description === DESCRICAO_APROVADA,
  cursoFormacao.short_description === DESCRICAO_APROVADA
    ? 'texto aprovado'
    : `outro texto (${String(cursoFormacao.short_description).slice(0, 40)}…)`,
  'texto aprovado',
)

// A migration não pode sobrescrever uma reescrita feita no painel.
await client.query('begin')
await client.query(
  `update courses set short_description = 'Texto reescrito pela responsável.' where id = $1`,
  [cursoFormacao.id],
)
await client.query(await readFile('supabase/migrations/25_upload_resumivel.sql', 'utf8'))
const { rows: [aposReaplicar] } = await client.query(
  `select short_description, status::text from courses where id = $1`,
  [cursoFormacao.id],
)
await client.query('rollback')
verificar(
  'A. Conteúdo',
  'reaplicar a migration não sobrescreve descrição reescrita no painel',
  aposReaplicar.short_description === 'Texto reescrito pela responsável.' &&
    aposReaplicar.status === 'draft',
  `${aposReaplicar.status} / ${aposReaplicar.short_description}`,
  'draft / Texto reescrito pela responsável.',
)

/* --- Idempotência: reaplicar não duplica e não desfaz renomeação ---------- */
await client.query('begin')
await client.query(
  `update modules set name = 'RENOMEADO PELA DONA', position = 42
    where slug = 'cuticula-fundinha' and course_id = $1`,
  [cursoFormacao.id],
)
const sqlMigration = await readFile('supabase/migrations/23_formacao_capitulos.sql', 'utf8')
await client.query(sqlMigration)

const { rows: [depois] } = await client.query(
  `select count(*)::int n from modules where course_id = $1`,
  [cursoFormacao.id],
)
const { rows: [renomeado] } = await client.query(
  `select name, position from modules where slug = 'cuticula-fundinha' and course_id = $1`,
  [cursoFormacao.id],
)
const { rows: [cursos] } = await client.query(
  `select count(*)::int n from courses where slug = 'formacao'`,
)
await client.query('rollback')

verificar('A. Conteúdo', 'reaplicar a migration não duplica capítulos', depois.n === 8, depois.n, 8)
verificar('A. Conteúdo', 'reaplicar não duplica a formação', cursos.n === 1, cursos.n, 1)
verificar(
  'A. Conteúdo',
  'reaplicar preserva renomeação e reordenação feitas no painel',
  renomeado.name === 'RENOMEADO PELA DONA' && renomeado.position === 42,
  `${renomeado.name} @ ${renomeado.position}`,
  'RENOMEADO PELA DONA @ 42',
)

/* ========================================================================== */
/* Massa de teste                                                             */
/* ========================================================================== */

/*
 * A massa de teste é COMMITADA (as asserções precisam vê-la de outra
 * transação, como um cliente real veria). Por isso cada execução carimba um
 * sufixo próprio: rodar o script duas vezes seguidas, sem reset, não pode
 * esbarrar em e-mail ou slug repetido.
 */
const RUN = Math.random().toString(36).slice(2, 8)

await client.query('begin')

async function criarUsuario(apelido, papel) {
  const email = `${apelido}.${RUN}@formacao.local`
  const { rows: [u] } = await client.query(`insert into auth.users (email) values ($1) returning id`, [email])
  await client.query(`update profiles set role = $2, full_name = $3 where id = $1`, [u.id, papel, email])
  return u.id
}

const alunaMatriculada = await criarUsuario('aluna.matriculada', 'student')
const alunaSemMatricula = await criarUsuario('aluna.sem', 'student')
const outraAluna = await criarUsuario('aluna.outra', 'student')
const instrutoraU = await criarUsuario('instrutora', 'instructor')
const instrutoraDeOutro = await criarUsuario('instrutora.outra', 'instructor')
const comercial = await criarUsuario('comercial', 'sales')
const financeiro = await criarUsuario('financeiro', 'finance')
const adminU = await criarUsuario('admin', 'admin')

// A formação precisa estar publicada para o teste de liberação — é o que a
// responsável fará quando escrever a descrição.
await client.query(
  `update courses set status = 'published', short_description = 'Descrição escrita pela responsável.'
    where id = $1`,
  [cursoFormacao.id],
)

const { rows: [cap1] } = await client.query(
  `update modules set status = 'published' where course_id = $1 and slug = 'manicure-e-pedicure-iniciante'
    returning id`,
  [cursoFormacao.id],
)
const { rows: [cap2] } = await client.query(
  `update modules set status = 'published' where course_id = $1 and slug = 'curso-de-aperfeicoamento-manicure'
    returning id`,
  [cursoFormacao.id],
)

// Instrutora vinculada à formação; a outra, a um curso qualquer.
const { rows: [instrutora] } = await client.query(
  `insert into instructors (name, slug, bio_short, status, profile_id)
   values ('Instrutora Formação', 'instrutora-formacao-' || $2, 'bio', 'published', $1) returning id`,
  [instrutoraU, RUN],
)
await client.query(`insert into course_instructors (course_id, instructor_id) values ($1, $2)`, [
  cursoFormacao.id,
  instrutora.id,
])

const { rows: [outroCurso] } = await client.query(
  `insert into courses (name, slug, short_description, status)
   values ('Outro Curso', 'outro-curso-' || $1, 'desc', 'published') returning id`,
  [RUN],
)
const { rows: [instrutora2] } = await client.query(
  `insert into instructors (name, slug, bio_short, status, profile_id)
   values ('Instrutora Outra', 'instrutora-outra-' || $2, 'bio', 'published', $1) returning id`,
  [instrutoraDeOutro, RUN],
)
await client.query(`insert into course_instructors (course_id, instructor_id) values ($1, $2)`, [
  outroCurso.id,
  instrutora2.id,
])

// Aulas: uma publicada, uma rascunho. Capítulo 2 fica VAZIO de propósito.
const { rows: [aulaPublicada] } = await client.query(
  `insert into lessons (module_id, course_id, title, content_type, status, position, published_at)
   values ($1, $2, 'Aula publicada de teste', 'video', 'published', 1, now()) returning id`,
  [cap1.id, cursoFormacao.id],
)
const { rows: [aulaRascunho] } = await client.query(
  `insert into lessons (module_id, course_id, title, content_type, status, position)
   values ($1, $2, 'Aula em rascunho', 'video', 'draft', 2) returning id`,
  [cap1.id, cursoFormacao.id],
)

// Matrícula ativa só para a primeira aluna.
const { rows: [matricula] } = await client.query(
  `insert into enrollments (user_id, course_id, status, starts_at)
   values ($1, $2, 'active', now()) returning id`,
  [alunaMatriculada, cursoFormacao.id],
)

// Objetos no bucket, no caminho real: {course_id}/{lesson_id}/{arquivo}
const caminhoPublicada = `${cursoFormacao.id}/${aulaPublicada.id}/video-teste.mp4`
const caminhoRascunho = `${cursoFormacao.id}/${aulaRascunho.id}/video-rascunho.mp4`
await client.query(
  `insert into storage.objects (bucket_id, name, mime_type, size) values
     ('lesson-videos', $1, 'video/mp4', 1000),
     ('lesson-videos', $2, 'video/mp4', 1000)`,
  [caminhoPublicada, caminhoRascunho],
)

await client.query('commit')

/* ========================================================================== */
/* B. CAPÍTULO VAZIO E CAPÍTULO COM AULA                                      */
/* ========================================================================== */

const { rows: outline } = await client.query(`select * from course_outline($1, $2)`, [
  cursoFormacao.id,
  alunaMatriculada,
])

const linhasCap2 = outline.filter((r) => r.module_id === cap2.id)
verificar(
  'B. Capítulo vazio',
  'capítulo publicado sem aula aparece, mas sem aula nenhuma',
  linhasCap2.length === 1 && linhasCap2[0].lesson_id === null,
  `${linhasCap2.length} linha(s), lesson_id=${linhasCap2[0]?.lesson_id}`,
  '1 linha com lesson_id nulo',
)

const linhasCap1 = outline.filter((r) => r.module_id === cap1.id && r.lesson_id !== null)
verificar(
  'B. Capítulo vazio',
  'capítulo com aula publicada mostra exatamente 1 aula (a rascunho não entra)',
  linhasCap1.length === 1 && linhasCap1[0].lesson_title === 'Aula publicada de teste',
  `${linhasCap1.length}: ${linhasCap1.map((l) => l.lesson_title).join(', ')}`,
  '1: Aula publicada de teste',
)

const semDuracaoInventada = linhasCap1.every((l) => l.lesson_duration === null)
verificar(
  'B. Capítulo vazio',
  'aula sem duração definida devolve NULL (nunca 0)',
  semDuracaoInventada,
  linhasCap1.map((l) => l.lesson_duration).join(','),
  'null',
)

/* --- Reordenação ---------------------------------------------------------- */
await client.query('begin')
await client.query(`update lessons set position = 5 where id = $1`, [aulaPublicada.id])
await client.query(`update lessons set position = 1 where id = $1`, [aulaRascunho.id])
const { rows: reordenadas } = await client.query(
  `select title, position from lessons where module_id = $1 order by position`,
  [cap1.id],
)
await client.query('rollback')
verificar(
  'B. Capítulo vazio',
  'reordenação das aulas persiste e reordena',
  reordenadas[0]?.title === 'Aula em rascunho' && reordenadas[0]?.position === 1,
  reordenadas.map((r) => `${r.position}:${r.title}`).join(' | '),
  '1:Aula em rascunho primeiro',
)

/* ========================================================================== */
/* C. PUBLICAÇÃO E LIBERAÇÃO — lesson_is_released é a fonte da verdade        */
/* ========================================================================== */

async function liberada(lessonId, userId) {
  const { rows: [r] } = await client.query(`select lesson_is_released($1, $2) as ok`, [lessonId, userId])
  return r.ok
}

verificar(
  'C. Publicação',
  'aula publicada + matrícula ativa → liberada',
  (await liberada(aulaPublicada.id, alunaMatriculada)) === true,
  await liberada(aulaPublicada.id, alunaMatriculada),
  true,
)
verificar(
  'C. Publicação',
  'aula em RASCUNHO não é liberada nem para quem tem matrícula',
  (await liberada(aulaRascunho.id, alunaMatriculada)) === false,
  await liberada(aulaRascunho.id, alunaMatriculada),
  false,
)
verificar(
  'C. Publicação',
  'aluna SEM matrícula não recebe liberação',
  (await liberada(aulaPublicada.id, alunaSemMatricula)) === false,
  await liberada(aulaPublicada.id, alunaSemMatricula),
  false,
)
verificar(
  'C. Publicação',
  'usuário anônimo (null) não recebe liberação',
  (await liberada(aulaPublicada.id, null)) === false,
  await liberada(aulaPublicada.id, null),
  false,
)

// Curso despublicado derruba a liberação mesmo com a aula publicada.
await client.query('begin')
await client.query(`update courses set status = 'draft' where id = $1`, [cursoFormacao.id])
const comCursoRascunho = await liberada(aulaPublicada.id, alunaMatriculada)
await client.query('rollback')
verificar(
  'C. Publicação',
  'formação despublicada bloqueia a aula publicada',
  comCursoRascunho === false,
  comCursoRascunho,
  false,
)

// Matrícula expirada derruba a liberação.
await client.query('begin')
await client.query(`update enrollments set status = 'expired' where id = $1`, [matricula.id])
const comMatriculaExpirada = await liberada(aulaPublicada.id, alunaMatriculada)
await client.query('rollback')
verificar(
  'C. Publicação',
  'matrícula expirada bloqueia a aula',
  comMatriculaExpirada === false,
  comMatriculaExpirada,
  false,
)

/* ========================================================================== */
/* D. QUEM PODE ENVIAR — RLS de lesson_video_uploads                          */
/* ========================================================================== */

const inserirEnvio = `insert into lesson_video_uploads (lesson_id, course_id, path, file_name, byte_size, mime_type)
                      values ($1, $2, $3, 'a.mp4', 1000, 'video/mp4') returning id`
const argsEnvio = [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/novo.mp4`]

const perfisEnvio = [
  ['admin', 'authenticated', adminU, 'permitido'],
  ['instrutora do curso', 'authenticated', instrutoraU, 'permitido'],
  ['instrutora de OUTRO curso', 'authenticated', instrutoraDeOutro, 'recusado'],
  ['aluna matriculada', 'authenticated', alunaMatriculada, 'recusado'],
  ['comercial', 'authenticated', comercial, 'recusado'],
  ['financeiro', 'authenticated', financeiro, 'recusado'],
  ['anônimo', 'anon', null, 'recusado'],
]

for (const [rotulo, papel, id, esperado] of perfisEnvio) {
  const obtido = await escreverComo(papel, id, inserirEnvio, argsEnvio)
  verificar('D. Enviar vídeo', `${rotulo} envia vídeo`, obtido === esperado, obtido, esperado)
}

const lidoPelaAluna = await contarComo(
  'authenticated',
  alunaMatriculada,
  `select id from lesson_video_uploads`,
)
verificar(
  'D. Enviar vídeo',
  'aluna não enxerga o rastro de envios',
  lidoPelaAluna === 0,
  lidoPelaAluna,
  0,
)

/* ========================================================================== */
/* E. QUEM PODE ASSISTIR — policies de storage.objects                        */
/* ========================================================================== */

const lerObjeto = `select name from storage.objects where bucket_id = 'lesson-videos' and name = $1`

const perfisLeitura = [
  ['aluna matriculada, aula liberada', 'authenticated', alunaMatriculada, caminhoPublicada, 1],
  ['aluna matriculada, aula em rascunho', 'authenticated', alunaMatriculada, caminhoRascunho, 0],
  ['aluna SEM matrícula', 'authenticated', alunaSemMatricula, caminhoPublicada, 0],
  ['outra aluna qualquer', 'authenticated', outraAluna, caminhoPublicada, 0],
  ['anônimo', 'anon', null, caminhoPublicada, 0],
  ['comercial', 'authenticated', comercial, caminhoPublicada, 0],
  ['financeiro', 'authenticated', financeiro, caminhoPublicada, 0],
  ['instrutora do curso', 'authenticated', instrutoraU, caminhoPublicada, 1],
  ['instrutora de OUTRO curso', 'authenticated', instrutoraDeOutro, caminhoPublicada, 0],
  ['admin', 'authenticated', adminU, caminhoPublicada, 1],
]

for (const [rotulo, papel, id, caminho, esperado] of perfisLeitura) {
  const obtido = await contarComo(papel, id, lerObjeto, [caminho])
  verificar('E. Assistir', `${rotulo} lê o vídeo`, obtido === esperado, obtido, esperado)
}

const gravarObjeto = `insert into storage.objects (bucket_id, name, mime_type, size)
                      values ('lesson-videos', $1, 'video/mp4', 10) returning name`
const escritaAluna = await escreverComo('authenticated', alunaMatriculada, gravarObjeto, [
  `${cursoFormacao.id}/${aulaPublicada.id}/hack.mp4`,
])
verificar(
  'E. Assistir',
  'aluna não consegue GRAVAR no bucket de vídeos',
  escritaAluna === 'recusado',
  escritaAluna,
  'recusado',
)

/* ========================================================================== */
/* F. ANTIÓRFÃO E ARQUIVAMENTO                                               */
/* ========================================================================== */

await client.query('begin')

const { rows: [pendenteAntigo] } = await client.query(
  `insert into lesson_video_uploads (lesson_id, course_id, path, file_name, status, created_at)
   values ($1, $2, $3, 'abandonado.mp4', 'pendente', now() - interval '48 hours') returning id`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/abandonado.mp4`],
)
await client.query(
  `insert into lesson_video_uploads (lesson_id, course_id, path, file_name, status, created_at, completed_at)
   values ($1, $2, $3, 'ok.mp4', 'concluido', now() - interval '48 hours', now())`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/ok.mp4`],
)

const { rows: orfaos } = await client.query(`select * from orphan_lesson_videos(24)`)
verificar(
  'F. Antiórfão',
  'upload abandonado aparece na lista de limpeza',
  orfaos.some((o) => o.upload_id === pendenteAntigo.id),
  orfaos.map((o) => o.file_name).join(',') || '(vazio)',
  'inclui abandonado.mp4',
)
verificar(
  'F. Antiórfão',
  'upload concluído NÃO aparece como órfão',
  !orfaos.some((o) => o.file_name === 'ok.mp4'),
  orfaos.map((o) => o.file_name).join(',') || '(vazio)',
  'sem ok.mp4',
)

await client.query('rollback')

/* --- Arquivar em vez de excluir quando há histórico ----------------------- */
await client.query('begin')

const semHistorico = (
  await client.query(`select lesson_has_student_history($1) as t`, [aulaPublicada.id])
).rows[0].t
verificar(
  'F. Antiórfão',
  'aula sem progresso de aluna → pode excluir',
  semHistorico === false,
  semHistorico,
  false,
)

await client.query(
  `insert into lesson_progress (enrollment_id, user_id, lesson_id, status)
   values ($1, $2, $3, 'completed')`,
  [matricula.id, alunaMatriculada, aulaPublicada.id],
)

const comHistorico = (
  await client.query(`select lesson_has_student_history($1) as t`, [aulaPublicada.id])
).rows[0].t
verificar(
  'F. Antiórfão',
  'aula com progresso de aluna → exige arquivamento',
  comHistorico === true,
  comHistorico,
  true,
)

// Arquivar preserva o histórico; excluir o levaria junto (cascade).
await client.query(`update lessons set status = 'archived' where id = $1`, [aulaPublicada.id])
const { rows: [progressoApos] } = await client.query(
  `select count(*)::int n from lesson_progress where lesson_id = $1`,
  [aulaPublicada.id],
)
verificar(
  'F. Antiórfão',
  'arquivar preserva o progresso da aluna',
  progressoApos.n === 1,
  progressoApos.n,
  1,
)

const arquivadaLiberada = await liberada(aulaPublicada.id, alunaMatriculada)
verificar(
  'F. Antiórfão',
  'aula arquivada deixa de ser liberada',
  arquivadaLiberada === false,
  arquivadaLiberada,
  false,
)

await client.query('rollback')

/* ========================================================================== */
/* H. UPLOAD RESUMÍVEL — estados, concorrência e guarda de publicação        */
/* ========================================================================== */

await client.query('begin')

// Todos os estados formalizados são aceitos pela constraint.
const ESTADOS = [
  'pendente', 'enviando', 'pausado', 'validando',
  'concluido', 'falhou', 'cancelado', 'substituido', 'orfao', 'arquivado',
]
let estadosOk = true
for (const estado of ESTADOS) {
  const r = await aceitaEDesfaz(
    `insert into lesson_video_uploads (lesson_id, course_id, path, status)
     values ($1, $2, $3, $4)`,
    [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/e-${estado}.mp4`, estado],
  )
  if (!r) estadosOk = false
}
verificar(
  'H. Upload resumível',
  'os 10 estados formalizados são aceitos pelo banco',
  estadosOk,
  estadosOk ? 'todos aceitos' : 'algum recusado',
  'todos aceitos',
)

const estadoInvalido = await aceitaEDesfaz(
  `insert into lesson_video_uploads (lesson_id, course_id, path, status)
   values ($1, $2, $3, 'inventado')`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/x.mp4`],
)
verificar(
  'H. Upload resumível',
  'estado fora da lista é recusado pelo banco',
  estadoInvalido === false,
  estadoInvalido ? 'aceitou' : 'recusou',
  'recusou',
)

await client.query('rollback')

/* --- Um envio ativo por aula --------------------------------------------- */
await client.query('begin')

await client.query(
  `insert into lesson_video_uploads (lesson_id, course_id, path, status)
   values ($1, $2, $3, 'enviando')`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/primeiro.mp4`],
)
const segundoAtivo = await esperaPassarLocal(
  `insert into lesson_video_uploads (lesson_id, course_id, path, status)
   values ($1, $2, $3, 'pendente')`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/segundo.mp4`],
)
verificar(
  'H. Upload resumível',
  'duas abas não conseguem abrir dois envios para a mesma aula',
  segundoAtivo === false,
  segundoAtivo ? 'aceitou o segundo' : 'recusou o segundo',
  'recusou o segundo',
)

// Depois de concluído, um novo envio (troca de vídeo) é permitido.
await client.query(
  `update lesson_video_uploads set status = 'concluido' where lesson_id = $1 and status = 'enviando'`,
  [aulaPublicada.id],
)
const trocaDeVideo = await esperaPassarLocal(
  `insert into lesson_video_uploads (lesson_id, course_id, path, status)
   values ($1, $2, $3, 'pendente')`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/terceiro.mp4`],
)
verificar(
  'H. Upload resumível',
  'trocar o vídeo depois de concluído é permitido',
  trocaDeVideo === true,
  trocaDeVideo ? 'aceitou' : 'recusou',
  'aceitou',
)

await client.query('rollback')

/* --- Guarda de publicação ------------------------------------------------- */
await client.query('begin')

async function pronto(lessonId) {
  const { rows: [r] } = await client.query(`select lesson_video_is_ready($1) as t`, [lessonId])
  return r.t
}

verificar(
  'H. Upload resumível',
  'aula sem vídeo não está pronta para publicar',
  (await pronto(aulaPublicada.id)) === false,
  await pronto(aulaPublicada.id),
  false,
)

// Liga um vídeo validado à aula.
const { rows: [midia] } = await client.query(
  `insert into media_assets (bucket, path, kind, mime_type, byte_size)
   values ('lesson-videos', $1, 'video', 'video/mp4', 1000) returning id`,
  [`${cursoFormacao.id}/${aulaPublicada.id}/ok-final.mp4`],
)
await client.query(`update lessons set video_asset_id = $2 where id = $1`, [
  aulaPublicada.id,
  midia.id,
])

verificar(
  'H. Upload resumível',
  'aula com vídeo validado e nenhum envio em aberto está pronta',
  (await pronto(aulaPublicada.id)) === true,
  await pronto(aulaPublicada.id),
  true,
)

// Um envio em aberto derruba a prontidão, mesmo com vídeo antigo ligado.
await client.query(
  `insert into lesson_video_uploads (lesson_id, course_id, path, status)
   values ($1, $2, $3, 'enviando')`,
  [aulaPublicada.id, cursoFormacao.id, `${cursoFormacao.id}/${aulaPublicada.id}/subindo.mp4`],
)
verificar(
  'H. Upload resumível',
  'envio em andamento impede publicar, mesmo com vídeo anterior ligado',
  (await pronto(aulaPublicada.id)) === false,
  await pronto(aulaPublicada.id),
  false,
)

await client.query('rollback')

/* --- Órfãos com os estados novos ------------------------------------------ */
await client.query('begin')

// Uma aula por estado: só pode haver um envio ativo por aula, então três
// abandonos ativos são necessariamente de três aulas diferentes.
for (const estado of ['pausado', 'enviando', 'validando']) {
  const { rows: [aulaTemp] } = await client.query(
    `insert into lessons (module_id, course_id, title, content_type, status, position)
     values ($1, $2, $3, 'video', 'draft', 90) returning id`,
    [cap1.id, cursoFormacao.id, `Aula de teste — ${estado}`],
  )
  await client.query(
    `insert into lesson_video_uploads (lesson_id, course_id, path, file_name, status, created_at)
     values ($1, $2, $3, $4, $5, now() - interval '48 hours')`,
    [
      aulaTemp.id,
      cursoFormacao.id,
      `${cursoFormacao.id}/${aulaTemp.id}/abandonado-${estado}.mp4`,
      `abandonado-${estado}.mp4`,
      estado,
    ],
  )
}
const { rows: orfaosNovos } = await client.query(`select * from orphan_lesson_videos(24)`)
const pegouTodos = ['pausado', 'enviando', 'validando'].every((e) =>
  orfaosNovos.some((o) => o.file_name === `abandonado-${e}.mp4`),
)
verificar(
  'H. Upload resumível',
  'envio pausado, enviando ou validando abandonado entra na limpeza',
  pegouTodos,
  orfaosNovos.map((o) => o.file_name).join(',') || '(vazio)',
  'os três aparecem',
)

await client.query('rollback')

/* ========================================================================== */
/* Limpeza — a formação volta ao estado de fábrica                            */
/*                                                                            */
/* A seção A afirma que a formação nasce em rascunho e sem descrição. Como a  */
/* massa de teste PUBLICA a formação para poder exercitar a liberação, e essa */
/* mudança é commitada, rodar o script duas vezes sem reset faria a seção A   */
/* falhar contra o resíduo da execução anterior. Desfazer aqui é o que torna  */
/* o script re-executável.                                                    */
/* ========================================================================== */

await client.query('begin')
await client.query(`delete from lessons where module_id in ($1, $2)`, [cap1.id, cap2.id])
await client.query(`delete from enrollments where course_id = $1`, [cursoFormacao.id])
await client.query(`delete from course_instructors where course_id = $1`, [cursoFormacao.id])
await client.query(
  `delete from storage.objects where bucket_id = 'lesson-videos' and name like $1`,
  [`${cursoFormacao.id}/%`],
)
await client.query(`delete from lesson_video_uploads where course_id = $1`, [cursoFormacao.id])
await client.query(`update modules set status = 'draft' where course_id = $1`, [cursoFormacao.id])
// A descrição aprovada FICA — ela é conteúdo real, não resíduo de teste.
await client.query(
  `update courses set status = 'draft', short_description = $2 where id = $1`,
  [cursoFormacao.id, DESCRICAO_APROVADA],
)
await client.query('commit')

const { rows: [restaurado] } = await client.query(
  `select c.status::text, c.short_description,
          (select count(*)::int from lessons l where l.course_id = c.id) as aulas,
          (select count(*)::int from modules m where m.course_id = c.id and m.status <> 'draft') as publicados
     from courses c where c.id = $1`,
  [cursoFormacao.id],
)
verificar(
  'G. Limpeza',
  'a formação volta a rascunho, sem aulas, com a descrição aprovada preservada',
  restaurado.status === 'draft' &&
    restaurado.short_description === DESCRICAO_APROVADA &&
    restaurado.aulas === 0 &&
    restaurado.publicados === 0,
  `${restaurado.status}/${restaurado.aulas} aulas/${restaurado.publicados} capítulos publicados`,
  'draft/0 aulas/0 capítulos publicados',
)

/* ========================================================================== */
/* Relatório                                                                  */
/* ========================================================================== */

await client.end()

const total = resultados.length
const passaram = resultados.filter((r) => r.ok).length

const porGrupo = new Map()
for (const r of resultados) {
  if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
  porGrupo.get(r.grupo).push(r)
}

const secoes = [...porGrupo.entries()].map(([grupo, itens]) =>
  [
    `## ${grupo}`,
    '',
    tabelaMarkdown(
      ['verificação', 'esperado', 'obtido', ''],
      itens.map((i) => [i.nome, `\`${i.esperado}\``, `\`${i.obtido}\``, i.ok ? 'ok' : '**FALHOU**']),
    ),
    '',
  ].join('\n'),
)

const md = [
  '# Formação, aulas e vídeo — verificação',
  '',
  `${passaram}/${total} verificações conforme o esperado.`,
  '',
  'Gerado por `node scripts/homolog/10-formacao.mjs` contra PostgreSQL local com',
  'todas as migrations aplicadas. Cada asserção assume `authenticated` ou `anon`',
  'e define `request.jwt.claim.sub`, como o Supabase faz — o superusuário nunca',
  'é usado dentro de uma asserção.',
  '',
  '## Fora do alcance deste script',
  '',
  'O serviço de **Storage** do Supabase (emissão de URL assinada, PUT do arquivo,',
  'leitura por Range) não é exercitado aqui: exige um Supabase real. O que este',
  'script prova sobre vídeo é a camada de AUTORIZAÇÃO — as policies de',
  '`storage.objects` que decidem quem lê e quem grava. Ver `docs/22-upload-de-video.md`.',
  '',
  ...secoes,
].join('\n')

await writeFile(`${SAIDA}/10-formacao.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const r of resultados.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${r.grupo}] ${r.nome} → esperado ${r.esperado}, obtido ${r.obtido}`)
}
console.log(`Relatório em ${SAIDA}/10-formacao.md`)
if (passaram !== total) process.exitCode = 1
