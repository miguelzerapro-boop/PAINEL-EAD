import { cliente } from './lib.mjs'

const client = cliente()
await client.connect()
await client.query('begin')

// Réplica EXATA dos helpers de 03-liberacao.mjs
async function montarCurso(slug, { statusCurso = 'published' } = {}) {
  const { rows: [c] } = await client.query(
    `insert into courses (name, slug, short_description, status)
     values ($1, $1, 'desc', $2) returning id`, [slug, statusCurso])
  return c.id
}
async function novoModulo(cursoId, nome, posicao, extra = {}) {
  const campos = { release_mode: 'immediate', status: 'published', ...extra }
  const { rows: [m] } = await client.query(
    `insert into modules (course_id, name, position, release_mode, release_at, release_days,
                          release_cohort_id, prerequisite_module_id, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [cursoId, nome, posicao, campos.release_mode, campos.release_at ?? null, campos.release_days ?? null,
     campos.release_cohort_id ?? null, campos.prerequisite_module_id ?? null, campos.status])
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
     campos.status, campos.is_free])
  return l.id
}
async function novaAluna(email) {
  const { rows: [u] } = await client.query(`insert into auth.users (email) values ($1) returning id`, [email])
  await client.query(`insert into profiles (id, role) values ($1,'student') on conflict do nothing`, [u.id])
  return u.id
}
async function matricular(userId, cursoId, extra = {}) {
  const { rows: [e] } = await client.query(
    `insert into enrollments (user_id, course_id, status, starts_at, expires_at, cohort_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [userId, cursoId, extra.status ?? 'active', extra.starts_at ?? new Date().toISOString(),
     extra.expires_at ?? null, extra.cohort_id ?? null])
  return e.id
}

const curso = await montarCurso('r1-imediata')
const mod = await novoModulo(curso, 'M1', 0)
const aula = await novaAula(mod, curso, 'A1', 0)
const aluna = await novaAluna('r1@teste.local')
const mat = await matricular(aluna, curso)

const q = async (sql, p = []) => (await client.query(sql, p)).rows[0]

console.log('curso        ', await q('select id, status::text, slug from courses where id=$1', [curso]))
console.log('modulo       ', await q('select id, status::text, release_mode::text, position, prerequisite_module_id from modules where id=$1', [mod]))
console.log('aula         ', await q('select id, status::text, release_mode::text, is_free, module_id, course_id, prerequisite_lesson_id from lessons where id=$1', [aula]))
console.log('matricula    ', await q('select id, status::text, starts_at, expires_at, course_id, user_id from enrollments where id=$1', [mat]))
console.log('encontra matr', await q('select count(*)::int c from enrollments where user_id=$1 and course_id=$2', [aluna, curso]))
console.log('active?      ', await q('select public.enrollment_is_active($1) r', [mat]))
console.log('modulo lib?  ', await q('select public.module_is_released($1,$2) r', [mod, aluna]))
console.log('aula lib?    ', await q('select public.lesson_is_released($1,$2) r', [aula, aluna]))

await client.query('rollback')
await client.end()
