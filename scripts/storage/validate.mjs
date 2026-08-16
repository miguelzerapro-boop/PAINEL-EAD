/**
 * PROVA REAL DO STORAGE
 *
 *   npm run storage:validate
 *
 * Isto é o que fecha a pendência que nenhum outro teste do projeto consegue
 * fechar: o arquivo indo para o Storage de verdade, ficando ligado à aula, e
 * sendo reproduzido por uma aluna autorizada — e por mais ninguém.
 *
 * RECUSA-SE A RODAR com credencial de exemplo. Sem Supabase real, sai com
 * instrução e código 1: prova que não prova nada é pior do que prova nenhuma.
 *
 * NÃO USA CONTEÚDO REAL. O vídeo é um MP4 mínimo gerado aqui, com assinatura
 * ISO-BMFF válida e alguns quilobytes. Nenhum material da responsável, nenhuma
 * aula de verdade, nenhum dado de aluna.
 *
 * LIMPA O QUE CRIOU. Curso, capítulo, aula, matrícula, contas de teste e o
 * objeto no bucket saem no fim, inclusive quando um passo falha.
 */
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = process.cwd()
const BUCKET = 'lesson-videos'
const MARCA = 'homolog-storage'

/* -------------------------------------------------------------------------- */
/* Ambiente                                                                    */
/* -------------------------------------------------------------------------- */

async function carregarEnv() {
  const ambiente = { ...process.env }
  for (const arquivo of ['.env.local', '.env']) {
    let bruto
    try {
      bruto = await readFile(path.join(RAIZ, arquivo), 'utf8')
    } catch {
      continue
    }
    for (const l of bruto.split(/\r?\n/)) {
      const t = l.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (ambiente[k] === undefined) ambiente[k] = v
    }
  }
  return ambiente
}

const MARCAS_EXEMPLO = [
  'placeholder', 'troque', 'exemplo', 'example', 'changeme', 'change-me',
  'your-', 'your_', 'seu-', 'seu_', 'sua-', 'sua_', 'coloque', 'preencha',
  'todo', 'xxxx', 'aaaa', '<', 'dummy', 'fake',
]
const ehExemplo = (v) => {
  const t = String(v ?? '').trim().toLowerCase()
  return t === '' || MARCAS_EXEMPLO.some((m) => t.includes(m))
}
const primeira = (amb, nomes) => {
  for (const n of nomes) {
    const v = amb[n]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

const ambiente = await carregarEnv()

const SUPABASE_URL = ambiente.NEXT_PUBLIC_SUPABASE_URL
const CHAVE_PUBLICA = primeira(ambiente, [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
])
const CHAVE_BACKEND = primeira(ambiente, ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])

/* --- A recusa ------------------------------------------------------------- */

const faltando = []
if (!SUPABASE_URL || ehExemplo(SUPABASE_URL)) faltando.push('NEXT_PUBLIC_SUPABASE_URL')
if (!CHAVE_PUBLICA || ehExemplo(CHAVE_PUBLICA)) faltando.push('chave pública')
if (!CHAVE_BACKEND || ehExemplo(CHAVE_BACKEND)) faltando.push('chave de backend')

if (faltando.length > 0) {
  console.error('\nA prova real do Storage NÃO foi executada.\n')
  console.error('Ainda são valores de exemplo: ' + faltando.join(', ') + '.\n')
  console.error('Configure as credenciais de homologação no `.env.local` e rode de novo.')
  console.error('Nunca cole chave secreta em mensagem, documentação ou captura de tela.\n')
  console.error('Depois: npm run storage:preflight && npm run storage:validate\n')
  process.exit(1)
}

if (ambiente.VERCEL_ENV === 'production') {
  console.error('\nRecusado: o ambiente está marcado como PRODUÇÃO.')
  console.error('Este comando cria e apaga dados. Rode apenas em homologação.\n')
  process.exit(1)
}

/* -------------------------------------------------------------------------- */
/* Relatório                                                                   */
/* -------------------------------------------------------------------------- */

const passos = []
function registrar(nome, ok, detalhe = '') {
  passos.push({ nome, ok, detalhe })
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

/* -------------------------------------------------------------------------- */
/* MP4 mínimo de teste — assinatura ISO-BMFF real                              */
/* -------------------------------------------------------------------------- */

function mp4DeTeste() {
  // ftyp box: size(4) + 'ftyp' + major_brand 'isom' + minor + compatible
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ])
  // mdat com conteúdo inócuo, para o arquivo ter alguns KB.
  const corpo = Buffer.alloc(8192, 0x00)
  const mdatCabecalho = Buffer.alloc(8)
  mdatCabecalho.writeUInt32BE(corpo.length + 8, 0)
  mdatCabecalho.write('mdat', 4)
  return Buffer.concat([ftyp, mdatCabecalho, corpo])
}

/* -------------------------------------------------------------------------- */

const admin = createClient(SUPABASE_URL, CHAVE_BACKEND, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const criados = {
  cursoId: null,
  moduloId: null,
  aulaId: null,
  midiaId: null,
  uploadId: null,
  caminho: null,
  matriculaId: null,
  usuarios: [],
}

const sufixo = Math.random().toString(36).slice(2, 10)
const senha = `Homolog!${Math.random().toString(36).slice(2, 12)}`

async function criarUsuario(rotulo) {
  const email = `${MARCA}-${rotulo}-${sufixo}@homolog.invalid`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw new Error(`não foi possível criar a conta de teste: ${error.message}`)
  criados.usuarios.push(data.user.id)
  return { id: data.user.id, email }
}

/** Cliente com a sessão de uma pessoa — respeita RLS, como o navegador. */
async function comoUsuario(email) {
  const cliente = createClient(SUPABASE_URL, CHAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`não foi possível autenticar ${email}: ${error.message}`)
  return { cliente, token: data.session.access_token }
}

let falhou = false

try {
  console.log('\nPROVA REAL DO STORAGE\n')
  console.log('1. Ambiente\n')

  /* --- 1. Conexão e bucket ------------------------------------------------ */

  const { data: buckets, error: erroBuckets } = await admin.storage.listBuckets()
  if (erroBuckets) throw new Error(`Storage inacessível: ${erroBuckets.message}`)
  registrar('conexão com o Storage', true, `${buckets.length} bucket(s)`)

  const bucket = buckets.find((b) => b.id === BUCKET)
  if (!bucket) {
    throw new Error(
      `O bucket "${BUCKET}" não existe. Aplique as migrations (npm run db:push) antes de validar.`,
    )
  }
  registrar('bucket lesson-videos existe', true)
  registrar('bucket é privado', bucket.public === false, bucket.public ? 'ESTÁ PÚBLICO' : 'privado')
  if (bucket.public) falhou = true

  /* --- 2. Massa de homologação -------------------------------------------- */

  console.log('\n2. Massa de homologação\n')

  const { data: curso, error: erroCurso } = await admin
    .from('courses')
    .insert({
      name: `[${MARCA}] curso de validação`,
      slug: `${MARCA}-${sufixo}`,
      short_description: 'Curso temporário de homologação. Removido ao fim deste comando.',
      status: 'published',
    })
    .select('id')
    .single()
  if (erroCurso) throw new Error(`curso: ${erroCurso.message}`)
  criados.cursoId = curso.id

  const { data: modulo, error: erroModulo } = await admin
    .from('modules')
    .insert({
      course_id: curso.id,
      name: 'Capítulo de validação',
      slug: `cap-${sufixo}`,
      position: 1,
      status: 'published',
      release_mode: 'immediate',
    })
    .select('id')
    .single()
  if (erroModulo) throw new Error(`capítulo: ${erroModulo.message}`)
  criados.moduloId = modulo.id

  const { data: aula, error: erroAula } = await admin
    .from('lessons')
    .insert({
      module_id: modulo.id,
      course_id: curso.id,
      title: 'Aula de validação',
      content_type: 'video',
      status: 'draft',
      position: 1,
      release_mode: 'immediate',
    })
    .select('id')
    .single()
  if (erroAula) throw new Error(`aula: ${erroAula.message}`)
  criados.aulaId = aula.id
  registrar('curso, capítulo e aula de teste criados', true, 'aula em rascunho')

  const instrutora = await criarUsuario('instrutora')
  await admin.from('profiles').update({ role: 'admin' }).eq('id', instrutora.id)

  const matriculada = await criarUsuario('matriculada')
  const semMatricula = await criarUsuario('sem-matricula')
  registrar('contas de teste criadas', true, '3 contas temporárias')

  const { data: matricula, error: erroMatricula } = await admin
    .from('enrollments')
    .insert({ user_id: matriculada.id, course_id: curso.id, status: 'active' })
    .select('id')
    .single()
  if (erroMatricula) throw new Error(`matrícula: ${erroMatricula.message}`)
  criados.matriculaId = matricula.id
  registrar('matrícula ativa criada', true)

  /* --- 3. Upload resumível pela conta da administradora ------------------- */

  console.log('\n3. Upload resumível (TUS)\n')

  const arquivo = mp4DeTeste()
  const caminho = `${curso.id}/${aula.id}/${crypto.randomUUID()}.mp4`
  criados.caminho = caminho

  const { data: registroUpload, error: erroRegistro } = await admin
    .from('lesson_video_uploads')
    .insert({
      lesson_id: aula.id,
      course_id: curso.id,
      bucket: BUCKET,
      path: caminho,
      file_name: 'validacao.mp4',
      byte_size: arquivo.length,
      mime_type: 'video/mp4',
      status: 'pendente',
      created_by: instrutora.id,
    })
    .select('id')
    .single()
  if (erroRegistro) throw new Error(`registro de upload: ${erroRegistro.message}`)
  criados.uploadId = registroUpload.id
  registrar('rastro do upload registrado', true, 'estado pendente')

  const sessaoAdmin = await comoUsuario(instrutora.email)

  // Endpoint resumível do Supabase, com o token da própria administradora.
  const criacao = await fetch(`${SUPABASE_URL}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessaoAdmin.token}`,
      'tus-resumable': '1.0.0',
      'upload-length': String(arquivo.length),
      'upload-metadata': [
        `bucketName ${Buffer.from(BUCKET).toString('base64')}`,
        `objectName ${Buffer.from(caminho).toString('base64')}`,
        `contentType ${Buffer.from('video/mp4').toString('base64')}`,
      ].join(','),
      'x-upsert': 'false',
    },
  })

  if (criacao.status !== 201) {
    throw new Error(
      `o servidor resumível recusou a criação (HTTP ${criacao.status}). ` +
        'Confirme que a conta tem papel admin e que as policies da migration 20 estão aplicadas.',
    )
  }

  const urlDeRetomada = criacao.headers.get('location')
  if (!urlDeRetomada) throw new Error('o servidor não devolveu a URL de retomada.')
  registrar('sessão de upload criada', true, 'URL de retomada recebida')

  await admin
    .from('lesson_video_uploads')
    .update({ tus_url: urlDeRetomada, status: 'enviando' })
    .eq('id', registroUpload.id)

  // Envia em DOIS pedaços de propósito: é o que exercita a retomada.
  const corte = Math.floor(arquivo.length / 2)

  const parte1 = await fetch(urlDeRetomada, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${sessaoAdmin.token}`,
      'tus-resumable': '1.0.0',
      'upload-offset': '0',
      'content-type': 'application/offset+octet-stream',
    },
    body: arquivo.subarray(0, corte),
  })
  if (!parte1.ok) throw new Error(`primeiro bloco recusado (HTTP ${parte1.status}).`)
  const offsetParcial = Number(parte1.headers.get('upload-offset') ?? 0)
  registrar('primeiro bloco enviado', offsetParcial === corte, `${offsetParcial} de ${arquivo.length} bytes`)

  // Pergunta ao servidor onde parou — exatamente o que a retomada faz.
  const consulta = await fetch(urlDeRetomada, {
    method: 'HEAD',
    headers: { authorization: `Bearer ${sessaoAdmin.token}`, 'tus-resumable': '1.0.0' },
  })
  const offsetRetomada = Number(consulta.headers.get('upload-offset') ?? -1)
  registrar(
    'RETOMADA: o servidor sabe onde parou',
    offsetRetomada === corte,
    `offset ${offsetRetomada}`,
  )
  if (offsetRetomada !== corte) falhou = true

  const parte2 = await fetch(urlDeRetomada, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${sessaoAdmin.token}`,
      'tus-resumable': '1.0.0',
      'upload-offset': String(offsetRetomada),
      'content-type': 'application/offset+octet-stream',
    },
    body: arquivo.subarray(offsetRetomada),
  })
  if (!parte2.ok) throw new Error(`segundo bloco recusado (HTTP ${parte2.status}).`)
  registrar('segundo bloco enviado a partir do offset', true, 'upload concluído')

  /* --- 4. O arquivo chegou inteiro e íntegro ------------------------------ */

  console.log('\n4. Conferência do arquivo\n')

  const pasta = caminho.split('/').slice(0, -1).join('/')
  const nome = caminho.split('/').pop()
  const { data: objetos } = await admin.storage.from(BUCKET).list(pasta, { search: nome })
  const objeto = objetos?.find((o) => o.name === nome)

  registrar('objeto existe no bucket', Boolean(objeto))
  if (!objeto) throw new Error('o arquivo não chegou ao bucket.')

  const tamanhoReal = Number(objeto.metadata?.size ?? 0)
  registrar('tamanho confere', tamanhoReal === arquivo.length, `${tamanhoReal} bytes`)
  if (tamanhoReal !== arquivo.length) falhou = true

  // Assinatura lida por Range — a mesma checagem que a aplicação faz.
  const { data: assinadaCurta } = await admin.storage.from(BUCKET).createSignedUrl(caminho, 60)
  const cabecalho = await fetch(assinadaCurta.signedUrl, { headers: { Range: 'bytes=0-31' } })
  const bytes = new Uint8Array(await cabecalho.arrayBuffer())
  const ftypOk =
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  registrar('assinatura ISO-BMFF confere', ftypOk, "bytes 4..8 = 'ftyp'")
  if (!ftypOk) falhou = true

  /* --- 5. Ligar à aula e publicar ---------------------------------------- */

  console.log('\n5. Vínculo com a aula\n')

  const { data: midia, error: erroMidia } = await admin
    .from('media_assets')
    .insert({
      bucket: BUCKET,
      path: caminho,
      kind: 'video',
      mime_type: 'video/mp4',
      byte_size: tamanhoReal,
      source: 'client_provided',
      usage_notes: `${MARCA}: arquivo de validação, removido ao fim.`,
    })
    .select('id')
    .single()
  if (erroMidia) throw new Error(`media_asset: ${erroMidia.message}`)
  criados.midiaId = midia.id

  await admin
    .from('lessons')
    .update({ video_asset_id: midia.id, video_provider: 'upload' })
    .eq('id', aula.id)

  await admin
    .from('lesson_video_uploads')
    .update({ status: 'concluido', media_id: midia.id, completed_at: new Date().toISOString() })
    .eq('id', registroUpload.id)

  registrar('vídeo ligado à aula', true)

  const { data: prontaAntes } = await admin.rpc('lesson_video_is_ready', { p_lesson_id: aula.id })
  registrar('aula pronta para publicar', prontaAntes === true)
  if (prontaAntes !== true) falhou = true

  await admin
    .from('lessons')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', aula.id)
  registrar('aula publicada', true)

  /* --- 6. Quem assiste ---------------------------------------------------- */

  console.log('\n6. Autorização de reprodução\n')

  const { data: liberadaPara } = await admin.rpc('lesson_is_released', {
    p_lesson_id: aula.id,
    p_user_id: matriculada.id,
  })
  registrar('ALUNA MATRÍCULADA: liberada', liberadaPara === true)
  if (liberadaPara !== true) falhou = true

  const { data: liberadaSem } = await admin.rpc('lesson_is_released', {
    p_lesson_id: aula.id,
    p_user_id: semMatricula.id,
  })
  registrar('ALUNA SEM MATRÍCULA: bloqueada', liberadaSem === false)
  if (liberadaSem !== false) falhou = true

  const { data: liberadaAnon } = await admin.rpc('lesson_is_released', {
    p_lesson_id: aula.id,
    p_user_id: null,
  })
  registrar('ANÔNIMO: bloqueado', liberadaAnon === false)
  if (liberadaAnon !== false) falhou = true

  // A aluna matriculada consegue LER o objeto com a própria sessão?
  const sessaoAluna = await comoUsuario(matriculada.email)
  const { data: objetoParaAluna } = await sessaoAluna.cliente.storage
    .from(BUCKET)
    .list(pasta, { search: nome })
  registrar(
    'aluna matriculada enxerga o objeto (RLS)',
    Boolean(objetoParaAluna?.some((o) => o.name === nome)),
  )

  const sessaoIntrusa = await comoUsuario(semMatricula.email)
  const { data: objetoParaIntrusa } = await sessaoIntrusa.cliente.storage
    .from(BUCKET)
    .list(pasta, { search: nome })
  const intrusaViu = Boolean(objetoParaIntrusa?.some((o) => o.name === nome))
  registrar('aluna SEM matrícula não enxerga o objeto (RLS)', !intrusaViu)
  if (intrusaViu) falhou = true

  // Escrita: a aluna não pode gravar no bucket.
  const { error: erroEscritaAluna } = await sessaoAluna.cliente.storage
    .from(BUCKET)
    .upload(`${curso.id}/${aula.id}/intruso.mp4`, mp4DeTeste(), { contentType: 'video/mp4' })
  registrar('aluna NÃO consegue gravar no bucket', Boolean(erroEscritaAluna))
  if (!erroEscritaAluna) falhou = true

  /* --- 7. URL assinada e expiração --------------------------------------- */

  console.log('\n7. URL assinada\n')

  const { data: assinada } = await admin.storage.from(BUCKET).createSignedUrl(caminho, 900)
  const respostaValida = await fetch(assinada.signedUrl, { method: 'HEAD' })
  registrar('URL assinada entrega o arquivo', respostaValida.ok, `HTTP ${respostaValida.status}`)
  if (!respostaValida.ok) falhou = true

  // Sem assinatura, o objeto privado não sai.
  const semAssinatura = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${caminho}`
  const respostaPublica = await fetch(semAssinatura, { method: 'HEAD' })
  registrar('URL pública NÃO entrega o arquivo', !respostaPublica.ok, `HTTP ${respostaPublica.status}`)
  if (respostaPublica.ok) falhou = true

  // Expiração: 1 segundo, espera 3.
  const { data: curta } = await admin.storage.from(BUCKET).createSignedUrl(caminho, 1)
  await new Promise((r) => setTimeout(r, 3000))
  const respostaExpirada = await fetch(curta.signedUrl, { method: 'HEAD' })
  registrar('URL assinada EXPIRA', !respostaExpirada.ok, `HTTP ${respostaExpirada.status}`)
  if (respostaExpirada.ok) falhou = true
} catch (erro) {
  falhou = true
  console.error(`\n  FALHA: ${erro instanceof Error ? erro.message : String(erro)}`)
} finally {
  /* --- 8. Limpeza --------------------------------------------------------- */

  console.log('\n8. Limpeza\n')

  try {
    if (criados.caminho) {
      await admin.storage.from(BUCKET).remove([criados.caminho, `${criados.caminho}-intruso`])
    }
    if (criados.cursoId) {
      // O cascade leva capítulo, aula, matrícula, progresso e rastro de upload.
      await admin.from('courses').delete().eq('id', criados.cursoId)
    }
    if (criados.midiaId) await admin.from('media_assets').delete().eq('id', criados.midiaId)
    for (const id of criados.usuarios) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
    registrar('dados de homologação removidos', true)
  } catch (erro) {
    registrar(
      'limpeza',
      false,
      `remova manualmente o curso "${MARCA}-${sufixo}": ${erro instanceof Error ? erro.message : erro}`,
    )
    falhou = true
  }
}

/* -------------------------------------------------------------------------- */

const ok = passos.filter((p) => p.ok).length
console.log(`\n${ok}/${passos.length} verificações conforme o esperado\n`)

if (falhou || ok !== passos.length) {
  console.log('STORAGE NÃO HOMOLOGADO. Corrija as falhas acima e rode de novo.\n')
  process.exitCode = 1
} else {
  console.log('STORAGE HOMOLOGADO.\n')
  console.log('O arquivo subiu por upload resumível, retomou a partir do offset,')
  console.log('ficou ligado à aula, foi entregue por URL assinada à aluna matriculada,')
  console.log('e foi negado a quem não tem matrícula e a quem não tem sessão.\n')
}
