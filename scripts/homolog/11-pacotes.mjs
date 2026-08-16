/**
 * ACESSO POR PACOTE — as três jornadas e a tentativa de burlar.
 *
 *   node scripts/homolog/11-pacotes.mjs
 *
 * A pergunta que este script responde: uma aluna que pagou R$ 29,90 consegue
 * abrir o capítulo de Unhas de Fibra digitando a URL na mão?
 *
 * Tudo é perguntado ao BANCO, via `lesson_is_released`. Nenhuma regra de
 * pacote é reimplementada aqui — se estivesse reimplementada, o teste
 * provaria o teste, não o sistema.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

const resultados = []
function verificar(grupo, nome, ok, obtido, esperado) {
  resultados.push({ grupo, nome, ok, obtido: String(obtido), esperado: String(esperado) })
}

const q = async (sql, p = []) => (await client.query(sql, p)).rows

/* ========================================================================== */
/* A matriz cadastrada                                                        */
/* ========================================================================== */

const matriz = await q(`
  select o.slug as oferta, o.price_cents, count(*)::int as capitulos
  from offer_module_access oma
  join offers o on o.id = oma.offer_id
  group by o.slug, o.price_cents
  order by o.price_cents
`)

const esperado = { iniciante: [2990, 3], profissional: [3990, 6], completo: [5490, 8] }

for (const [slug, [preco, n]] of Object.entries(esperado)) {
  const linha = matriz.find((m) => m.oferta === slug)
  verificar(
    'A. Matriz',
    `${slug}: R$ ${(preco / 100).toFixed(2)} com ${n} capítulos`,
    linha && linha.price_cents === preco && linha.capitulos === n,
    linha ? `R$ ${(linha.price_cents / 100).toFixed(2)} / ${linha.capitulos} capítulos` : 'ausente',
    `R$ ${(preco / 100).toFixed(2)} / ${n} capítulos`,
  )
}

// Profissional contém tudo do Iniciante; Completo contém tudo do Profissional.
const contido = await q(`
  select
    (select count(*) from offer_module_access a
      join offers oa on oa.id = a.offer_id and oa.slug = 'iniciante'
      where not exists (
        select 1 from offer_module_access b
        join offers ob on ob.id = b.offer_id and ob.slug = 'profissional'
        where b.module_id = a.module_id))::int as falta_no_profissional,
    (select count(*) from offer_module_access a
      join offers oa on oa.id = a.offer_id and oa.slug = 'profissional'
      where not exists (
        select 1 from offer_module_access b
        join offers ob on ob.id = b.offer_id and ob.slug = 'completo'
        where b.module_id = a.module_id))::int as falta_no_completo
`)

verificar('A. Matriz', 'Profissional inclui tudo do Iniciante',
  contido[0].falta_no_profissional === 0, contido[0].falta_no_profissional, 0)
verificar('A. Matriz', 'Completo inclui tudo do Profissional',
  contido[0].falta_no_completo === 0, contido[0].falta_no_completo, 0)

/* ========================================================================== */
/* Massa: três alunas, uma por pacote                                         */
/* ========================================================================== */

await client.query('begin')

const [{ id: cursoId }] = await q(`select id from courses where slug = 'formacao'`)
const [{ id: produtoId }] = await q(`select id from products where slug = 'formacao-manicure'`)

// A formação e os capítulos precisam estar publicados para a liberação valer.
await client.query(
  `update courses set status='published', short_description=coalesce(short_description,'x') where id=$1`,
  [cursoId],
)
await client.query(`update modules set status='published' where course_id=$1`, [cursoId])

// Uma aula publicada em cada capítulo.
const capitulos = await q(
  `select id, slug, position from modules where course_id=$1 order by position`,
  [cursoId],
)
const aulaDoCapitulo = {}
for (const cap of capitulos) {
  const [aula] = await q(
    `insert into lessons (module_id, course_id, title, content_type, status, position, published_at)
     values ($1,$2,$3,'video','published',1,now()) returning id`,
    [cap.id, cursoId, `Aula de ${cap.slug}`],
  )
  aulaDoCapitulo[cap.slug] = aula.id
}

async function criarAluna(rotulo, ofertaSlug) {
  const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [
    `${rotulo}@pacotes.local`,
  ])
  const [oferta] = await q(`select id, price_cents from offers where slug=$1`, [ofertaSlug])
  const [pedido] = await q(
    `insert into orders (user_id, offer_id, product_id, status, buyer_email, amount_cents)
     values ($1,$2,$3,'paid',$4,$5) returning id`,
    [u.id, oferta.id, produtoId, `${rotulo}@pacotes.local`, oferta.price_cents],
  )
  await client.query(
    `insert into enrollments (user_id, course_id, status, source, order_id, starts_at)
     values ($1,$2,'active','order',$3, now())`,
    [u.id, cursoId, pedido.id],
  )
  return u.id
}

const aluna = {
  iniciante: await criarAluna('iniciante', 'iniciante'),
  profissional: await criarAluna('profissional', 'profissional'),
  completo: await criarAluna('completo', 'completo'),
}

/* ========================================================================== */
/* As três jornadas                                                           */
/* ========================================================================== */

const DEVE_ABRIR = {
  iniciante: ['manicure-e-pedicure-iniciante', 'cuticula-fundinha', 'acabamento-impecavel'],
  profissional: [
    'manicure-e-pedicure-iniciante', 'curso-de-aperfeicoamento-manicure',
    'cuticula-fundinha', 'acabamento-impecavel',
    'curso-de-esmaltacao-em-gel', 'curso-de-blindagem',
  ],
  completo: capitulos.map((c) => c.slug),
}

async function liberada(lessonId, userId) {
  const [r] = await q(`select lesson_is_released($1,$2) as ok`, [lessonId, userId])
  return r.ok
}

for (const [pacote, permitidos] of Object.entries(DEVE_ABRIR)) {
  const userId = aluna[pacote]
  let abertos = 0
  let vazados = []
  let negados = []

  for (const cap of capitulos) {
    const ok = await liberada(aulaDoCapitulo[cap.slug], userId)
    const deveria = permitidos.includes(cap.slug)
    if (ok) abertos += 1
    if (ok && !deveria) vazados.push(cap.slug)
    if (!ok && deveria) negados.push(cap.slug)
  }

  verificar(
    `B. Jornada ${pacote}`,
    `abre exatamente ${permitidos.length} capítulos`,
    abertos === permitidos.length,
    abertos,
    permitidos.length,
  )
  verificar(
    `B. Jornada ${pacote}`,
    'nenhum capítulo além do pacote',
    vazados.length === 0,
    vazados.length ? vazados.join(', ') : 'nenhum',
    'nenhum',
  )
  verificar(
    `B. Jornada ${pacote}`,
    'nenhum capítulo do pacote foi negado',
    negados.length === 0,
    negados.length ? negados.join(', ') : 'nenhum',
    'nenhum',
  )
}

/* ========================================================================== */
/* URL na mão                                                                 */
/* ========================================================================== */

const fibra = aulaDoCapitulo['curso-de-unhas-de-fibra']
const gel = aulaDoCapitulo['curso-de-esmaltacao-em-gel']

verificar('C. URL direta', 'Iniciante NÃO abre Unhas de Fibra pela URL',
  (await liberada(fibra, aluna.iniciante)) === false, await liberada(fibra, aluna.iniciante), false)

verificar('C. URL direta', 'Iniciante NÃO abre Esmaltação em Gel pela URL',
  (await liberada(gel, aluna.iniciante)) === false, await liberada(gel, aluna.iniciante), false)

verificar('C. URL direta', 'Profissional NÃO abre Unhas de Fibra pela URL',
  (await liberada(fibra, aluna.profissional)) === false, await liberada(fibra, aluna.profissional), false)

verificar('C. URL direta', 'Completo ABRE Unhas de Fibra',
  (await liberada(fibra, aluna.completo)) === true, await liberada(fibra, aluna.completo), true)

// Aula gratuita dentro de capítulo não comprado também não vaza.
await client.query(`update lessons set is_free = true where id = $1`, [fibra])
verificar('C. URL direta', 'aula GRATUITA de capítulo não comprado continua bloqueada',
  (await liberada(fibra, aluna.iniciante)) === false, await liberada(fibra, aluna.iniciante), false)
verificar('C. URL direta', 'a mesma aula gratuita abre para quem nunca comprou (degustação)',
  (await liberada(fibra, null)) === true, await liberada(fibra, null), true)
await client.query(`update lessons set is_free = false where id = $1`, [fibra])

/* ========================================================================== */
/* Upgrade                                                                    */
/* ========================================================================== */

// A aluna do Iniciante marca uma aula como concluída, depois compra o Completo.
const [matriculaIni] = await q(
  `select id from enrollments where user_id=$1 and course_id=$2`, [aluna.iniciante, cursoId])

await client.query(
  `insert into lesson_progress (enrollment_id, user_id, lesson_id, status)
   values ($1,$2,$3,'completed')`,
  [matriculaIni.id, aluna.iniciante, aulaDoCapitulo['manicure-e-pedicure-iniciante']],
)

const [ofertaCompleto] = await q(`select id from offers where slug='completo'`)
await client.query(
  `insert into orders (user_id, offer_id, product_id, status, buyer_email, amount_cents)
   values ($1,$2,$3,'paid','iniciante@pacotes.local',5490)`,
  [aluna.iniciante, ofertaCompleto.id, produtoId],
)

let abertosDepois = 0
for (const cap of capitulos) {
  if (await liberada(aulaDoCapitulo[cap.slug], aluna.iniciante)) abertosDepois += 1
}

verificar('D. Upgrade', 'após comprar o Completo, abre os 8 capítulos',
  abertosDepois === 8, abertosDepois, 8)

const [matriculas] = await q(
  `select count(*)::int n from enrollments where user_id=$1 and course_id=$2`,
  [aluna.iniciante, cursoId])
verificar('D. Upgrade', 'continua com UMA matrícula, sem duplicar',
  matriculas.n === 1, matriculas.n, 1)

const [progresso] = await q(
  `select count(*)::int n from lesson_progress where enrollment_id=$1 and status='completed'`,
  [matriculaIni.id])
verificar('D. Upgrade', 'o progresso anterior foi preservado',
  progresso.n === 1, progresso.n, 1)

/* ========================================================================== */
/* Pedido não pago não dá acesso                                              */
/* ========================================================================== */

const [u4] = await q(`insert into auth.users (email) values ('pendente@pacotes.local') returning id`)
const [ofertaIni] = await q(`select id from offers where slug='iniciante'`)
const [pedidoPendente] = await q(
  `insert into orders (user_id, offer_id, product_id, status, buyer_email, amount_cents)
   values ($1,$2,$3,'pending','pendente@pacotes.local',2990) returning id`,
  [u4.id, ofertaIni.id, produtoId])
await client.query(
  `insert into enrollments (user_id, course_id, status, source, order_id, starts_at)
   values ($1,$2,'active','order',$3, now())`,
  [u4.id, cursoId, pedidoPendente.id])

const comPendente = await liberada(aulaDoCapitulo['manicure-e-pedicure-iniciante'], u4.id)
verificar('E. Pagamento', 'pedido PENDENTE não libera capítulo nenhum',
  comPendente === false, comPendente, false)

await client.query(`update orders set status='paid' where id=$1`, [pedidoPendente.id])
const comPago = await liberada(aulaDoCapitulo['manicure-e-pedicure-iniciante'], u4.id)
verificar('E. Pagamento', 'ao virar PAGO, o capítulo do pacote abre',
  comPago === true, comPago, true)

/* ========================================================================== */
/* Matrícula manual não é limitada por pacote                                 */
/* ========================================================================== */

const [u5] = await q(`insert into auth.users (email) values ('cortesia@pacotes.local') returning id`)
await client.query(
  `insert into enrollments (user_id, course_id, status, source, starts_at)
   values ($1,$2,'active','manual', now())`,
  [u5.id, cursoId])

let abertosManual = 0
for (const cap of capitulos) {
  if (await liberada(aulaDoCapitulo[cap.slug], u5.id)) abertosManual += 1
}
verificar('F. Cortesia', 'matrícula manual abre os 8 (não veio de compra)',
  abertosManual === 8, abertosManual, 8)

await client.query('rollback')

/* ========================================================================== */

await client.end()

const total = resultados.length
const passaram = resultados.filter((r) => r.ok).length

const porGrupo = new Map()
for (const r of resultados) {
  if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
  porGrupo.get(r.grupo).push(r)
}

const md = [
  '# Acesso por pacote — verificação',
  '',
  `${passaram}/${total} verificações conforme o esperado.`,
  '',
  'Gerado por `node scripts/homolog/11-pacotes.mjs`. Toda pergunta sobre acesso',
  'é feita a `lesson_is_released()` no PostgreSQL — a regra de pacote não é',
  'reimplementada no teste.',
  '',
  ...[...porGrupo.entries()].map(([grupo, itens]) =>
    [
      `## ${grupo}`,
      '',
      tabelaMarkdown(
        ['verificação', 'esperado', 'obtido', ''],
        itens.map((i) => [i.nome, `\`${i.esperado}\``, `\`${i.obtido}\``, i.ok ? 'ok' : '**FALHOU**']),
      ),
      '',
    ].join('\n'),
  ),
].join('\n')

await writeFile(`${SAIDA}/11-pacotes.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const r of resultados.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${r.grupo}] ${r.nome} → esperado ${r.esperado}, obtido ${r.obtido}`)
}
console.log(`Relatório em ${SAIDA}/11-pacotes.md`)
if (passaram !== total) process.exitCode = 1
