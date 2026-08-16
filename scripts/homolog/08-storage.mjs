/**
 * Matriz de permissões do Storage.
 *
 *   node scripts/homolog/08-storage.mjs
 *
 * Cada verificação executa um SELECT/INSERT/UPDATE/DELETE real em
 * `storage.objects`, assumindo o papel `authenticated` (ou `anon`) e
 * definindo `request.jwt.claim.sub` — a mesma mecânica do teste de RLS.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { cliente, rotuloDoAmbiente, tabelaMarkdown } from './lib.mjs'

const SAIDA = 'docs/validacao'
await mkdir(SAIDA, { recursive: true })

const client = cliente()
await client.connect()

const q = async (sql, p = []) => (await client.query(sql, p)).rows

/* -------------------------------------------------------------------------- */
/* Massa de teste                                                              */
/* -------------------------------------------------------------------------- */
// A matriz precisa de dados COMMITADOS (cada verificação abre a própria
// transação e faz rollback). Para o script poder rodar quantas vezes for
// preciso, tudo é criado com um sufixo próprio e apagado no fim.
// Sufixo aleatório, não o PID: o Windows recicla PID e duas execuções
// seguidas colidiam no índice único de e-mail.
const RUN = `homolog-storage-${Math.random().toString(36).slice(2, 10)}`

await client.query('begin')

async function usuario(email, papel) {
  const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [`${RUN}.${email}`])
  await q(`update profiles set role = $2 where id = $1`, [u.id, papel])
  return u.id
}

const alunaA = await usuario('storage.a@homolog.local', 'student')
const alunaB = await usuario('storage.b@homolog.local', 'student')
const instrutoraU = await usuario('storage.instrutora@homolog.local', 'instructor')
const outraInstrutoraU = await usuario('storage.instrutora2@homolog.local', 'instructor')
const comercial = await usuario('storage.comercial@homolog.local', 'sales')
const financeiro = await usuario('storage.financeiro@homolog.local', 'finance')
const admin = await usuario('storage.admin@homolog.local', 'admin')

const [instrutora] = await q(
  `insert into instructors (name, slug, bio_short, status, profile_id)
   values ('Instrutora Storage','instrutora-a-' || $2,'bio','published',$1) returning id`, [instrutoraU, RUN])
const [outraInstrutora] = await q(
  `insert into instructors (name, slug, bio_short, status, profile_id)
   values ('Outra Instrutora','instrutora-b-' || $2,'bio','published',$1) returning id`, [outraInstrutoraU, RUN])

const [curso] = await q(
  `insert into courses (name, slug, short_description, status)
   values ('Curso Storage','curso-storage-' || $1,'desc','published') returning id`, [RUN])
const [cursoOutro] = await q(
  `insert into courses (name, slug, short_description, status)
   values ('Curso de Outra','curso-outro-' || $1,'desc','published') returning id`, [RUN])
await q(`insert into course_instructors (course_id, instructor_id) values ($1,$2)`, [curso.id, instrutora.id])
await q(`insert into course_instructors (course_id, instructor_id) values ($1,$2)`, [cursoOutro.id, outraInstrutora.id])

const [modulo] = await q(
  `insert into modules (course_id, name, position, status) values ($1,'M',0,'published') returning id`, [curso.id])
const [aulaLiberada] = await q(
  `insert into lessons (module_id, course_id, title, position, status)
   values ($1,$2,'Liberada',0,'published') returning id`, [modulo.id, curso.id])
const [aulaTrancada] = await q(
  `insert into lessons (module_id, course_id, title, position, status, release_mode, release_days)
   values ($1,$2,'Trancada',1,'published','days_after_enrollment',30) returning id`, [modulo.id, curso.id])

await q(`insert into enrollments (user_id, course_id, status) values ($1,$2,'active')`, [alunaA, curso.id])
await q(`insert into enrollments (user_id, course_id, status) values ($1,$2,'active')`, [alunaB, curso.id])

const [atividade] = await q(
  `insert into activities (lesson_id, title, submission_type, status)
   values ($1,'Atividade Storage','photo','published') returning id`, [aulaLiberada.id])
const [atividadeOutroCurso] = await q(
  `insert into activities (course_id, title, submission_type, status)
   values ($1,'Atividade de outro curso','photo','published') returning id`, [cursoOutro.id])

const [certificado] = await q(`select gen_random_uuid() id`)
const [submissionId] = await q(`select gen_random_uuid() id`)

// Objetos criados como superusuário (RLS ignorada) para servirem de alvo.
const CAMINHOS = {
  entregaA: `${alunaA}/${atividade.id}/foto.jpg`,
  entregaAoutroCurso: `${alunaA}/${atividadeOutroCurso.id}/foto.jpg`,
  videoLiberado: `${curso.id}/${aulaLiberada.id}/aula.mp4`,
  videoTrancado: `${curso.id}/${aulaTrancada.id}/aula.mp4`,
  certificadoA: `${alunaA}/${certificado.id}.pdf`,
  avatarA: `${alunaA}/avatar.jpg`,
  feedbackA: `${alunaA}/${submissionId.id}/audio.mp3`,
  capa: `${curso.id}/capa.jpg`,
  depoimento: `${certificado.id}/foto.jpg`,
}

await q(`insert into storage.objects (bucket_id, name, owner, mime_type, size) values
  ('student-submissions',$1,$2,'image/jpeg',120000),
  ('student-submissions',$3,$2,'image/jpeg',120000),
  ('lesson-videos',$4,null,'video/mp4',900000),
  ('lesson-videos',$5,null,'video/mp4',900000),
  ('certificates',$6,null,'application/pdf',50000),
  ('profile-avatars',$7,$2,'image/jpeg',50000),
  ('submission-feedback',$8,null,'audio/mpeg',200000),
  ('course-covers',$9,null,'image/jpeg',300000),
  ('testimonials',$10,null,'image/jpeg',300000)`,
  [CAMINHOS.entregaA, alunaA, CAMINHOS.entregaAoutroCurso, CAMINHOS.videoLiberado, CAMINHOS.videoTrancado,
   CAMINHOS.certificadoA, CAMINHOS.avatarA, CAMINHOS.feedbackA, CAMINHOS.capa, CAMINHOS.depoimento])

await client.query('commit')

/* -------------------------------------------------------------------------- */
/* Motor                                                                       */
/* -------------------------------------------------------------------------- */
const PERFIS = {
  'Aluna A': { id: alunaA, papel: 'authenticated' },
  'Aluna B': { id: alunaB, papel: 'authenticated' },
  Instrutora: { id: instrutoraU, papel: 'authenticated' },
  'Outra instrutora': { id: outraInstrutoraU, papel: 'authenticated' },
  Comercial: { id: comercial, papel: 'authenticated' },
  Financeiro: { id: financeiro, papel: 'authenticated' },
  Admin: { id: admin, papel: 'authenticated' },
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
    const escrita = /^\s*(insert|update|delete)/i.test(sql)
    obtido = escrita ? (r.rowCount > 0 ? 'permitido' : 'bloqueado') : r.rowCount
  } catch (erro) {
    obtido = erro.code === '42501' ? 'negado'
      : erro.code === '23514' ? 'recusado pelo bucket'
      : `erro ${erro.code}`
  } finally {
    await client.query('rollback')
  }

  resultados.push({
    operacao, perfil: perfilNome,
    esperado: String(esperado), obtido: String(obtido),
    ok: String(obtido) === String(esperado),
  })
}

const LER = (bucket) => `select id from storage.objects where bucket_id = $1 and name = $2`

/* --- student-submissions --------------------------------------------------- */
await verificar('Ler a própria entrega', 'Aluna A', LER(), ['student-submissions', CAMINHOS.entregaA], 1)
await verificar('Ler a entrega da Aluna A', 'Aluna B', LER(), ['student-submissions', CAMINHOS.entregaA], 0)
await verificar('Ler a entrega da Aluna A', 'Instrutora', LER(), ['student-submissions', CAMINHOS.entregaA], 1)
await verificar('Ler a entrega da Aluna A', 'Outra instrutora', LER(), ['student-submissions', CAMINHOS.entregaA], 0)
await verificar('Ler a entrega da Aluna A', 'Comercial', LER(), ['student-submissions', CAMINHOS.entregaA], 0)
await verificar('Ler a entrega da Aluna A', 'Financeiro', LER(), ['student-submissions', CAMINHOS.entregaA], 0)
await verificar('Ler a entrega da Aluna A', 'Admin', LER(), ['student-submissions', CAMINHOS.entregaA], 1)
await verificar('Ler a entrega da Aluna A', 'Anônimo', LER(), ['student-submissions', CAMINHOS.entregaA], 0)

await verificar('Enviar entrega na PRÓPRIA pasta', 'Aluna A',
  `insert into storage.objects (bucket_id, name, owner, mime_type, size)
   values ('student-submissions', $1, $2, 'image/jpeg', 100000)`,
  [`${alunaA}/${atividade.id}/nova.jpg`, alunaA], 'permitido')

await verificar('Enviar entrega na pasta de OUTRA aluna', 'Aluna B',
  `insert into storage.objects (bucket_id, name, owner, mime_type, size)
   values ('student-submissions', $1, $2, 'image/jpeg', 100000)`,
  [`${alunaA}/${atividade.id}/invasao.jpg`, alunaB], 'negado')

await verificar('Substituir a entrega da Aluna A', 'Aluna B',
  `update storage.objects set size = 1 where bucket_id='student-submissions' and name = $1`,
  [CAMINHOS.entregaA], 'bloqueado')

await verificar('Apagar a entrega da Aluna A', 'Aluna B',
  `delete from storage.objects where bucket_id='student-submissions' and name = $1`,
  [CAMINHOS.entregaA], 'bloqueado')

await verificar('Enviar tipo PROIBIDO (executável)', 'Aluna A',
  `insert into storage.objects (bucket_id, name, owner, mime_type, size)
   values ('student-submissions', $1, $2, 'application/x-msdownload', 1000)`,
  [`${alunaA}/${atividade.id}/virus.exe`, alunaA], 'recusado pelo bucket')

await verificar('Enviar acima do LIMITE de tamanho', 'Aluna A',
  `insert into storage.objects (bucket_id, name, owner, mime_type, size)
   values ('student-submissions', $1, $2, 'image/jpeg', 999999999)`,
  [`${alunaA}/${atividade.id}/gigante.jpg`, alunaA], 'recusado pelo bucket')

await verificar('Enviar sem activity_id no caminho', 'Aluna A',
  `insert into storage.objects (bucket_id, name, owner, mime_type, size)
   values ('student-submissions', $1, $2, 'image/jpeg', 1000)`,
  [`${alunaA}/solto.jpg`, alunaA], 'negado')

/* --- lesson-videos: conteúdo pago ------------------------------------------ */
await verificar('Ler vídeo de aula LIBERADA', 'Aluna A', LER(), ['lesson-videos', CAMINHOS.videoLiberado], 1)
await verificar('Ler vídeo de aula TRANCADA', 'Aluna A', LER(), ['lesson-videos', CAMINHOS.videoTrancado], 0)
await verificar('Ler vídeo sem matrícula', 'Comercial', LER(), ['lesson-videos', CAMINHOS.videoLiberado], 0)
await verificar('Ler vídeo', 'Anônimo', LER(), ['lesson-videos', CAMINHOS.videoLiberado], 0)
await verificar('Ler vídeo do curso que leciona', 'Instrutora', LER(), ['lesson-videos', CAMINHOS.videoLiberado], 1)
await verificar('Ler vídeo de curso alheio', 'Outra instrutora', LER(), ['lesson-videos', CAMINHOS.videoLiberado], 0)
await verificar('Enviar vídeo de aula', 'Aluna A',
  `insert into storage.objects (bucket_id, name, mime_type, size) values ('lesson-videos', $1, 'video/mp4', 1000)`,
  [`${curso.id}/${aulaLiberada.id}/pirata.mp4`], 'negado')
await verificar('Enviar vídeo no curso que leciona', 'Instrutora',
  `insert into storage.objects (bucket_id, name, mime_type, size) values ('lesson-videos', $1, 'video/mp4', 1000)`,
  [`${curso.id}/${aulaLiberada.id}/nova.mp4`], 'permitido')
await verificar('Apagar vídeo de aula', 'Instrutora',
  `delete from storage.objects where bucket_id='lesson-videos' and name=$1`,
  [CAMINHOS.videoLiberado], 'bloqueado')

/* --- certificates ---------------------------------------------------------- */
await verificar('Ler o próprio certificado', 'Aluna A', LER(), ['certificates', CAMINHOS.certificadoA], 1)
await verificar('Ler o certificado da Aluna A', 'Aluna B', LER(), ['certificates', CAMINHOS.certificadoA], 0)
await verificar('Ler certificado', 'Anônimo', LER(), ['certificates', CAMINHOS.certificadoA], 0)
await verificar('Gravar o próprio certificado (só o servidor pode)', 'Aluna A',
  `insert into storage.objects (bucket_id, name, mime_type, size)
   values ('certificates', $1, 'application/pdf', 1000)`,
  [`${alunaA}/falso.pdf`], 'negado')

/* --- profile-avatars -------------------------------------------------------- */
await verificar('Ler o próprio avatar', 'Aluna A', LER(), ['profile-avatars', CAMINHOS.avatarA], 1)
await verificar('Ler o avatar da Aluna A', 'Aluna B', LER(), ['profile-avatars', CAMINHOS.avatarA], 0)
await verificar('Trocar o próprio avatar', 'Aluna A',
  `update storage.objects set size = 2 where bucket_id='profile-avatars' and name=$1`,
  [CAMINHOS.avatarA], 'permitido')

/* --- submission-feedback ---------------------------------------------------- */
await verificar('Ler o feedback recebido', 'Aluna A', LER(), ['submission-feedback', CAMINHOS.feedbackA], 1)
await verificar('Ler o feedback da Aluna A', 'Aluna B', LER(), ['submission-feedback', CAMINHOS.feedbackA], 0)
await verificar('Enviar feedback', 'Instrutora',
  `insert into storage.objects (bucket_id, name, mime_type, size)
   values ('submission-feedback', $1, 'audio/mpeg', 1000)`,
  [`${alunaA}/${submissionId.id}/novo.mp3`], 'permitido')
await verificar('Enviar feedback', 'Aluna B',
  `insert into storage.objects (bucket_id, name, mime_type, size)
   values ('submission-feedback', $1, 'audio/mpeg', 1000)`,
  [`${alunaA}/${submissionId.id}/fake.mp3`], 'negado')

/* --- testimonials: nenhum cliente lê ---------------------------------------- */
await verificar('Ler foto de depoimento', 'Anônimo', LER(), ['testimonials', CAMINHOS.depoimento], 0)
await verificar('Ler foto de depoimento', 'Aluna A', LER(), ['testimonials', CAMINHOS.depoimento], 0)
await verificar('Ler foto de depoimento', 'Admin', LER(), ['testimonials', CAMINHOS.depoimento], 1)

/* --- buckets públicos -------------------------------------------------------- */
await verificar('Ler capa de curso (bucket público)', 'Anônimo', LER(), ['course-covers', CAMINHOS.capa], 1)
await verificar('Enviar capa de curso', 'Aluna A',
  `insert into storage.objects (bucket_id, name, mime_type, size)
   values ('course-covers', $1, 'image/jpeg', 1000)`,
  [`${curso.id}/hack.jpg`], 'negado')
await verificar('Enviar capa de curso', 'Admin',
  `insert into storage.objects (bucket_id, name, mime_type, size)
   values ('course-covers', $1, 'image/jpeg', 1000)`,
  [`${curso.id}/nova.jpg`], 'permitido')
await verificar('Substituir capa de curso', 'Comercial',
  `update storage.objects set size = 1 where bucket_id='course-covers' and name=$1`,
  [CAMINHOS.capa], 'bloqueado')

/* --- arquivo removido deixa de ser acessível --------------------------------- */
await client.query('begin')
await client.query(`delete from storage.objects where bucket_id='student-submissions' and name=$1`, [CAMINHOS.entregaA])
await client.query(`set local role authenticated`)
await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alunaA])
const aposRemocao = await client.query(LER(), ['student-submissions', CAMINHOS.entregaA])
await client.query('rollback')
resultados.push({
  operacao: 'Arquivo removido deixa de ser acessível',
  perfil: 'Aluna A', esperado: '0', obtido: String(aposRemocao.rowCount),
  ok: aposRemocao.rowCount === 0,
})

/* --- listagem de bucket privado ---------------------------------------------- */
// A listagem devolve só o que é da pessoa. Aluna A tem 2 entregas; Aluna B,
// nenhuma; o admin enxerga as 2. Ninguém "varre" o bucket.
await verificar('LISTAR o bucket de entregas (vê só as próprias)', 'Aluna A',
  `select id from storage.objects where bucket_id = 'student-submissions'`, [], 2)
await verificar('LISTAR o bucket de entregas (vê só as próprias)', 'Aluna B',
  `select id from storage.objects where bucket_id = 'student-submissions'`, [], 0)
await verificar('LISTAR o bucket de entregas (vê só as próprias)', 'Admin',
  `select id from storage.objects where bucket_id = 'student-submissions'`, [], 2)
// Dos 2 vídeos existentes, a aluna só enxerga o da aula liberada.
await verificar('LISTAR o bucket de vídeos (vê só as aulas liberadas)', 'Aluna A',
  `select id from storage.objects where bucket_id = 'lesson-videos'`, [], 1)
await verificar('LISTAR o bucket de vídeos (vê só as aulas liberadas)', 'Anônimo',
  `select id from storage.objects where bucket_id = 'lesson-videos'`, [], 0)

/* --- configuração dos buckets ------------------------------------------------ */
const buckets = await q(
  `select b.id, b.public, b.file_size_limit, array_length(b.allowed_mime_types,1) as tipos,
          d.finalidade, d.estrutura_caminho, d.url_assinada_seg
   from storage.buckets b
   left join public.storage_buckets_doc d on d.bucket = b.id
   order by b.public desc, b.id`)

// --- Limpeza: o ambiente volta ao estado anterior --------------------------
await client.query('begin')
await q(`delete from storage.objects where name like '%' || $1 || '%'`, [RUN]).catch(() => {})
await q(`delete from storage.objects o using courses c
         where o.name like c.id::text || '%' and c.slug like '%' || $1`, [RUN])
await q(`delete from courses where slug like '%' || $1`, [RUN])
await q(`delete from instructors where slug like '%' || $1`, [RUN])
await q(`delete from auth.users where email like $1 || '%'`, [RUN])
await q(`delete from storage.objects where owner not in (select id from auth.users)
         and owner is not null`)
await client.query('commit')

const [restou] = await q(
  `select (select count(*)::int from auth.users where email like $1 || '%') as usuarios,
          (select count(*)::int from courses where slug like '%' || $1) as cursos`, [RUN])

await client.end()

/* -------------------------------------------------------------------------- */
const total = resultados.length
const passaram = resultados.filter((r) => r.ok).length

const porOperacao = new Map()
for (const r of resultados) {
  if (!porOperacao.has(r.operacao)) porOperacao.set(r.operacao, {})
  porOperacao.get(r.operacao)[r.perfil] = r
}
const perfis = Object.keys(PERFIS)

const md = [
  '# Evidência — Storage: buckets e policies',
  '',
  '**Comando:** `node scripts/homolog/08-storage.mjs`  ',
  `**Ambiente:** ${rotuloDoAmbiente()}  `,
  `**Resultado:** ${passaram}/${total} verificações conforme o esperado.`,
  '',
  '> Até esta rodada o projeto **não tinha bucket nenhum**: qualquer vídeo ou PDF enviado',
  '> ficaria sem proteção. A migration `0020` cria os 10 buckets e 24 policies.',
  '',
  '## Buckets',
  '',
  tabelaMarkdown(
    ['Bucket', 'Acesso', 'Limite', 'Tipos', 'Caminho', 'URL assinada', 'Finalidade'],
    buckets.map((b) => [
      `\`${b.id}\``,
      b.public ? '🌐 público' : '🔒 privado',
      `${(Number(b.file_size_limit) / 1048576).toFixed(0)} MB`,
      String(b.tipos),
      `\`${b.estrutura_caminho ?? '—'}\``,
      b.url_assinada_seg ? `${b.url_assinada_seg}s` : '—',
      b.finalidade ?? '—',
    ]),
  ),
  '',
  '## Matriz de permissões',
  '',
  '| Valor | Significado |',
  '| --- | --- |',
  '| número | quantos objetos o perfil consegue LER |',
  '| `permitido` | escrita aceita |',
  '| `bloqueado` | escrita não atingiu nenhuma linha (a policy filtrou) |',
  '| `negado` | recusado por policy no `WITH CHECK` (`42501`) |',
  '| `recusado pelo bucket` | tipo MIME ou tamanho fora do configurado |',
  '',
  tabelaMarkdown(
    ['Operação', ...perfis],
    [...porOperacao.entries()].map(([op, linha]) => [
      op,
      ...perfis.map((p) => {
        const r = linha[p]
        if (!r) return '—'
        return r.ok ? `${r.obtido} ✅` : `${r.obtido} ❌ (esperado ${r.esperado})`
      }),
    ]),
  ),
  '',
  '## Decisões que valem explicar',
  '',
  '- **Depoimentos são bucket privado.** A foto é de uma aluna real. Bucket público serve o',
  '  arquivo a qualquer pessoa com a URL, mesmo antes de o depoimento ser publicado. O site',
  '  recebe URL assinada gerada no servidor, e só quando o depoimento está publicado,',
  '  verificado e com consentimento registrado.',
  '- **Certificado é privado.** Contém nome completo.',
  '- **Nem a aluna grava o próprio certificado.** Só o servidor, via service role.',
  '- **`{user_id}` no caminho é preso ao `auth.uid()`** pelo `WITH CHECK`. Trocar o id no',
  '  caminho para gravar na pasta de outra aluna é recusado com `42501` — testado.',
  '- **Instrutora só enxerga os cursos que leciona**, tanto no banco quanto no Storage.',
  '- **Comercial e financeiro não leem entrega de aluna.** Não precisam.',
  '',
  '## Limites deste teste',
  '',
  '- Tamanho e MIME são aplicados pela **API de Storage** do Supabase, antes de a linha',
  '  chegar ao banco. Aqui isso é emulado por trigger no shim, o que prova que a',
  '  **configuração do bucket está correta**, não que a API a aplica.',
  '- **A expiração da URL assinada não foi testada** — é comportamento do servidor de',
  '  Storage do Supabase, não do PostgreSQL. Só verificável no ambiente hospedado.',
  '- Um bucket público é, por definição, legível por qualquer pessoa que tenha a URL. O que',
  '  o projeto garante é que **o site só monta essa URL quando o registro está publicado**.',
  '',
].join('\n')

await writeFile(`${SAIDA}/10-storage.md`, md, 'utf8')

console.log(`\n${passaram}/${total} verificações conforme o esperado`)
for (const r of resultados.filter((x) => !x.ok)) {
  console.log(`  FALHOU: [${r.perfil}] ${r.operacao} → esperado ${r.esperado}, obtido ${r.obtido}`)
}
console.log(`Relatório em ${SAIDA}/10-storage.md`)
if (passaram !== total) process.exitCode = 1
