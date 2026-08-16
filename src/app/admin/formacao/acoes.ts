'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { exigirEquipeDoCurso, mensagemDeErro } from '@/lib/admin/sessao'
import {
  BYTES_DE_ASSINATURA,
  assinaturaConfere,
  ehMimeDeVideo,
  extensaoDe,
  validarDeclaracao,
} from '@/lib/video/regras'
import {
  ESTADOS_EM_ABERTO,
  ESTADO_ENVIO,
  transicaoPermitida,
  type EstadoEnvio,
} from '@/lib/video/estados'
import type { ResultadoAcao } from '../tipos'
import type { ResultadoEnvio, ResultadoPreparo } from './tipos'

/**
 * AULAS DA FORMAÇÃO — cadastro, envio de vídeo e publicação.
 *
 * O ENVIO NÃO PASSA POR AQUI. Um vídeo de aula pode ter gigabytes; atravessar
 * uma Server Action significaria carregar isso na memória do Next.js. Os bytes
 * vão do navegador direto ao Storage, pelo protocolo resumível.
 *
 *   navegador  ──(bytes, token da própria sessão)──▶  Supabase Storage
 *       │                                                  ▲
 *       └──(autorizar / anotar / confirmar)──▶  Next.js     │
 *                                                  │        │
 *                                                  └─ policy do bucket ─┘
 *
 * NENHUMA CREDENCIAL SAI DAQUI. A administradora envia com o access token da
 * própria sessão; quem autoriza a gravação é a policy `aula: apenas equipe
 * envia` (migration 20), que exige admin ou instrutora do curso e confere o
 * `{course_id}` no primeiro segmento do caminho. A chave de backend fica no
 * servidor, usada só para ler o rastro e conferir o arquivo depois.
 *
 * Este arquivo faz quatro coisas: autoriza antes, anota o progresso durante,
 * confere os bytes depois, e guarda a publicação até tudo estar pronto.
 */

/* -------------------------------------------------------------------------- */
/* Cadastro da aula                                                            */
/* -------------------------------------------------------------------------- */

const aulaSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  module_id: z.string().uuid({ message: 'Escolha o capítulo.' }),
  title: z.string().trim().min(2, 'Dê um título à aula.').max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  position: z.coerce.number().int().min(0).optional(),
  is_free: z.coerce.boolean().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  release_mode: z
    .enum([
      'immediate',
      'after_previous_module',
      'after_previous_lesson',
      'on_date',
      'days_after_enrollment',
      'manual',
      'by_cohort',
    ])
    .default('immediate'),
  release_at: z.string().optional().or(z.literal('')),
  release_days: z.coerce.number().int().min(0).optional().or(z.literal('')),
})

/**
 * Salva a aula.
 *
 * Regra do §18: SALVAR NÃO É PUBLICAR. O status só vira 'published' quando o
 * formulário disser explicitamente `status=published`. O padrão é rascunho —
 * inclusive quando um vídeo acabou de subir.
 */
export async function salvarAula(_estado: unknown, formData: FormData): Promise<ResultadoAcao> {
  const parsed = aulaSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }
  const d = parsed.data

  const admin = createAdminClient()

  // O curso vem do capítulo, não do formulário: quem escolhe o dono do
  // registro é o banco.
  const { data: modulo } = await admin
    .from('modules')
    .select('id, course_id')
    .eq('id', d.module_id)
    .maybeSingle()

  if (!modulo) return { ok: false, message: 'Capítulo não encontrado.' }

  try {
    await exigirEquipeDoCurso(modulo.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const vazio = (v: unknown) => (v === '' || v === undefined ? null : v)

  const registro = {
    module_id: d.module_id,
    course_id: modulo.course_id,
    title: d.title,
    description: vazio(d.description),
    is_free: Boolean(d.is_free),
    status: d.status,
    release_mode: d.release_mode,
    release_at: vazio(d.release_at),
    release_days: vazio(d.release_days),
    published_at: d.status === 'published' ? new Date().toISOString() : null,
    ...(d.position !== undefined ? { position: d.position } : {}),
  }

  const { data, error } = d.id
    ? await admin.from('lessons').update(registro).eq('id', d.id).select('id').single()
    : await admin.from('lessons').insert(registro).select('id').single()

  if (error) return { ok: false, message: traduzirErro(error.message, error.code) }

  revalidarPainel(d.module_id)
  return { ok: true, id: data.id }
}

/**
 * Cria o rascunho mínimo para que o envio do vídeo tenha onde se apoiar.
 *
 * Existe porque o caminho do arquivo no bucket é `{course_id}/{lesson_id}/…`:
 * sem a aula, não há caminho, e sem caminho não há como assinar. Criar a
 * linha antes é também o que garante que nenhum arquivo enviado fique sem
 * dono (§19).
 */
export async function garantirRascunhoDeAula(params: {
  moduleId: string
  titulo: string
}): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: modulo } = await admin
    .from('modules')
    .select('id, course_id')
    .eq('id', params.moduleId)
    .maybeSingle()

  if (!modulo) return { ok: false, message: 'Capítulo não encontrado.' }

  try {
    await exigirEquipeDoCurso(modulo.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const titulo = params.titulo.trim()
  if (titulo.length < 2) return { ok: false, message: 'Dê um título à aula antes de enviar o vídeo.' }

  const { data: ultima } = await admin
    .from('lessons')
    .select('position')
    .eq('module_id', params.moduleId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('lessons')
    .insert({
      module_id: params.moduleId,
      course_id: modulo.course_id,
      title: titulo,
      status: 'draft',
      content_type: 'video',
      position: (ultima?.position ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: traduzirErro(error.message, error.code) }
  return { ok: true, id: data.id }
}

/* -------------------------------------------------------------------------- */
/* Envio do vídeo                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Passo 1: autoriza o envio e devolve o destino.
 *
 * NÃO devolve credencial nenhuma. Os bytes vão pelo protocolo resumível
 * usando o ACCESS TOKEN DA PRÓPRIA ADMINISTRADORA, e quem decide se a
 * gravação é permitida é a policy `aula: apenas equipe envia` (migration
 * 0020). A chave de backend não sai do servidor.
 *
 * O que esta ação faz:
 *   · confere permissão sobre o curso;
 *   · confere tipo, extensão e tamanho declarados;
 *   · REAPROVEITA um envio em aberto desta aula, se houver — é o que permite
 *     retomar de onde parou depois de fechar a aba;
 *   · caso contrário, registra a intenção em `lesson_video_uploads`, para que
 *     nenhum arquivo enviado fique sem dono.
 *
 * O caminho é montado aqui. O cliente não escolhe onde grava.
 */
export async function prepararEnvioDeVideo(params: {
  lessonId: string
  nome: string
  tamanho: number
  mime: string
  /** Descartar o envio em aberto e começar do zero. */
  recomecar?: boolean
}): Promise<ResultadoPreparo> {
  const admin = createAdminClient()

  const { data: aula } = await admin
    .from('lessons')
    .select('id, course_id, module_id')
    .eq('id', params.lessonId)
    .maybeSingle()

  if (!aula) return { ok: false, message: 'Aula não encontrada.' }

  let sessao
  try {
    sessao = await exigirEquipeDoCurso(aula.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const problema = validarDeclaracao({
    nome: params.nome,
    tamanho: params.tamanho,
    mime: params.mime,
  })
  if (problema) return { ok: false, message: problema.mensagem }

  /* --- Existe envio em aberto para esta aula? --------------------------- */
  const { data: emAberto } = await admin
    .from('lesson_video_uploads')
    .select('id, path, bucket, status, tus_url, bytes_enviados, byte_size, file_name, expires_at')
    .eq('lesson_id', aula.id)
    .in('status', [...ESTADOS_EM_ABERTO])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (emAberto && !params.recomecar) {
    const expirou = emAberto.expires_at ? new Date(emAberto.expires_at) < new Date() : false
    const mesmoArquivo =
      emAberto.file_name === params.nome.slice(0, 300) &&
      Number(emAberto.byte_size) === params.tamanho

    // Retomar só faz sentido para o MESMO arquivo e com a sessão ainda viva.
    if (mesmoArquivo && !expirou && emAberto.tus_url) {
      return {
        ok: true,
        uploadId: emAberto.id,
        bucket: emAberto.bucket,
        caminho: emAberto.path,
        urlDeRetomada: emAberto.tus_url,
        bytesEnviados: Number(emAberto.bytes_enviados ?? 0),
        estado: (emAberto.status as EstadoEnvio) ?? ESTADO_ENVIO.PENDENTE,
        retomando: true,
      }
    }

    // Arquivo diferente ou sessão morta: o envio anterior sai do caminho.
    // Não se apaga o arquivo — `orphan_lesson_videos` cuida do que sobrou.
    await admin
      .from('lesson_video_uploads')
      .update({ status: expirou ? ESTADO_ENVIO.FALHOU : ESTADO_ENVIO.CANCELADO })
      .eq('id', emAberto.id)
  } else if (emAberto && params.recomecar) {
    await admin
      .from('lesson_video_uploads')
      .update({ status: ESTADO_ENVIO.CANCELADO })
      .eq('id', emAberto.id)
  }

  /* --- Novo envio -------------------------------------------------------- */
  // O formato precisa ser exatamente `{course_id}/{lesson_id}/…`: a policy de
  // leitura do bucket lê o segmento 2 como lesson_id.
  const extensao = extensaoDe(params.nome) || 'mp4'
  const caminho = `${aula.course_id}/${aula.id}/${crypto.randomUUID()}.${extensao}`

  const { data: registro, error: erroRegistro } = await admin
    .from('lesson_video_uploads')
    .insert({
      lesson_id: aula.id,
      course_id: aula.course_id,
      bucket: 'lesson-videos',
      path: caminho,
      file_name: params.nome.slice(0, 300),
      byte_size: params.tamanho,
      mime_type: params.mime,
      status: ESTADO_ENVIO.PENDENTE,
      bytes_enviados: 0,
      created_by: sessao.userId,
    })
    .select('id')
    .single()

  if (erroRegistro || !registro) {
    // 23505 aqui é o índice "um envio ativo por aula": duas abas tentando.
    if (erroRegistro?.code === '23505') {
      return {
        ok: false,
        message: 'Já existe um envio em andamento para esta aula. Termine ou cancele o outro antes.',
      }
    }
    console.error('[video] falha ao registrar envio', erroRegistro?.message)
    return { ok: false, message: 'Não foi possível iniciar o envio. Tente de novo.' }
  }

  return {
    ok: true,
    uploadId: registro.id,
    bucket: 'lesson-videos',
    caminho,
    urlDeRetomada: null,
    bytesEnviados: 0,
    estado: ESTADO_ENVIO.PENDENTE,
    retomando: false,
  }
}

/**
 * Guarda a URL de retomada devolvida pelo servidor de upload.
 *
 * É esta linha no banco que transforma "a aba fechou aos 80%" em "continue de
 * onde parou" — inclusive de outro computador. Sem ela, sobra só a impressão
 * digital no localStorage, que morre com o navegador.
 */
export async function registrarUrlDeRetomada(params: {
  uploadId: string
  url: string
  /** Horas até a sessão de upload deixar de aceitar retomada. */
  validaPorHoras?: number
}): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: envio } = await admin
    .from('lesson_video_uploads')
    .select('id, course_id, status')
    .eq('id', params.uploadId)
    .maybeSingle()

  if (!envio) return { ok: false, message: 'Envio não encontrado.' }

  try {
    await exigirEquipeDoCurso(envio.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const horas = params.validaPorHoras ?? 24
  const expira = new Date(Date.now() + horas * 3600_000).toISOString()

  await admin
    .from('lesson_video_uploads')
    .update({ tus_url: params.url, expires_at: expira, status: ESTADO_ENVIO.ENVIANDO })
    .eq('id', params.uploadId)

  return { ok: true, id: params.uploadId }
}

/**
 * Anota o avanço do envio.
 *
 * Chamado com parcimônia — não a cada bloco. Serve para que, ao reabrir a
 * tela, a barra comece do ponto certo em vez de zerar.
 */
export async function registrarProgresso(params: {
  uploadId: string
  bytesEnviados: number
  estado?: EstadoEnvio
}): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: envio } = await admin
    .from('lesson_video_uploads')
    .select('id, course_id, status')
    .eq('id', params.uploadId)
    .maybeSingle()

  if (!envio) return { ok: false, message: 'Envio não encontrado.' }

  try {
    await exigirEquipeDoCurso(envio.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const estadoAtual = envio.status as EstadoEnvio
  const destino = params.estado

  // Um estado só avança por caminho permitido. Sem isto, uma resposta atrasada
  // poderia levar um envio já concluído de volta para "enviando".
  if (destino && destino !== estadoAtual && !transicaoPermitida(estadoAtual, destino)) {
    return { ok: false, message: 'Transição de estado inválida.' }
  }

  await admin
    .from('lesson_video_uploads')
    .update({
      bytes_enviados: Math.max(0, Math.floor(params.bytesEnviados)),
      ...(destino ? { status: destino } : {}),
    })
    .eq('id', params.uploadId)

  return { ok: true, id: params.uploadId }
}

/**
 * Passo 2: confere o que realmente chegou e liga o arquivo à aula.
 *
 * Esta é a checagem que o navegador não consegue enganar. O servidor lê os
 * primeiros 32 bytes do objeto — só isso, não o arquivo inteiro — e confere a
 * assinatura contra o tipo declarado. Um .zip renomeado para .mp4 morre aqui,
 * depois de subir, e o arquivo é marcado para limpeza em vez de virar aula.
 *
 * Só depois de passar é que a aula recebe `video_asset_id`. Até então ela
 * continua sem vídeo — e continua rascunho.
 */
export async function confirmarEnvioDeVideo(params: {
  uploadId: string
}): Promise<ResultadoEnvio> {
  const admin = createAdminClient()

  const { data: envio } = await admin
    .from('lesson_video_uploads')
    .select('id, lesson_id, course_id, bucket, path, file_name, byte_size, mime_type, status')
    .eq('id', params.uploadId)
    .maybeSingle()

  if (!envio) return { ok: false, message: 'Envio não encontrado.' }

  try {
    await exigirEquipeDoCurso(envio.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  if (envio.status === ESTADO_ENVIO.CONCLUIDO) {
    return { ok: true, jaEstava: true, caminho: envio.path }
  }

  // Enquanto confere, o estado é 'validando': a aula não pode ser publicada
  // nesta janela, e a limpeza sabe que o arquivo tem dono.
  await admin
    .from('lesson_video_uploads')
    .update({ status: ESTADO_ENVIO.VALIDANDO })
    .eq('id', envio.id)

  // O objeto existe mesmo? `list` devolve o tamanho e o MIME que o Storage
  // gravou — não o que o cliente disse que ia enviar.
  const pasta = envio.path.split('/').slice(0, -1).join('/')
  const arquivo = envio.path.split('/').pop() ?? ''

  const { data: objetos } = await admin.storage
    .from(envio.bucket)
    .list(pasta, { search: arquivo, limit: 1 })

  const objeto = objetos?.find((o) => o.name === arquivo)
  if (!objeto) {
    return {
      ok: false,
      message: 'O arquivo não chegou ao servidor. O envio pode ter sido interrompido — tente de novo.',
    }
  }

  const tamanhoReal = Number(objeto.metadata?.size ?? 0)
  const mimeReal = String(objeto.metadata?.mimetype ?? envio.mime_type ?? '')

  if (!ehMimeDeVideo(mimeReal)) {
    await marcarFalha(envio.id)
    return { ok: false, message: 'O arquivo que chegou não é um vídeo aceito. Nada foi publicado.' }
  }

  // Assinatura real: baixa só o cabeçalho, por Range.
  const assinaturaOk = await conferirAssinatura(envio.bucket, envio.path, mimeReal)
  if (!assinaturaOk) {
    await marcarFalha(envio.id)
    return {
      ok: false,
      message:
        'O conteúdo do arquivo não corresponde a um vídeo. Verifique se o arquivo não foi apenas renomeado. Nada foi publicado.',
    }
  }

  // O vídeo anterior, se existir, não é apagado: vira 'substituido' e entra na
  // lista de limpeza administrativa. Apagar aqui é como se perde vídeo.
  const { data: aulaAtual } = await admin
    .from('lessons')
    .select('video_asset_id')
    .eq('id', envio.lesson_id)
    .maybeSingle()

  const { data: midia, error: erroMidia } = await admin
    .from('media_assets')
    .insert({
      bucket: envio.bucket,
      path: envio.path,
      kind: 'video',
      mime_type: mimeReal,
      byte_size: tamanhoReal || envio.byte_size,
      source: 'client_provided',
      usage_notes: `Vídeo de aula enviado pelo painel. Arquivo original: ${envio.file_name ?? 'sem nome'}.`,
    })
    .select('id')
    .single()

  if (erroMidia || !midia) {
    console.error('[video] falha ao registrar media_asset', erroMidia?.message)
    return {
      ok: false,
      message:
        'O vídeo subiu, mas não foi possível registrá-lo. O arquivo está guardado — tente confirmar de novo.',
    }
  }

  const { error: erroAula } = await admin
    .from('lessons')
    .update({
      video_asset_id: midia.id,
      video_provider: 'upload',
      content_type: 'video',
    })
    .eq('id', envio.lesson_id)

  if (erroAula) {
    return {
      ok: false,
      message:
        'O vídeo subiu, mas não foi possível ligá-lo à aula. O arquivo está guardado — tente confirmar de novo.',
    }
  }

  await admin
    .from('lesson_video_uploads')
    .update({
      status: ESTADO_ENVIO.CONCLUIDO,
      media_id: midia.id,
      completed_at: new Date().toISOString(),
      bytes_enviados: tamanhoReal || envio.byte_size,
    })
    .eq('id', envio.id)

  if (aulaAtual?.video_asset_id) {
    await admin
      .from('lesson_video_uploads')
      .update({ status: ESTADO_ENVIO.SUBSTITUIDO })
      .eq('lesson_id', envio.lesson_id)
      .eq('media_id', aulaAtual.video_asset_id)
  }

  revalidarPainel(undefined)
  return { ok: true, caminho: envio.path, jaEstava: false }
}

/** Cancelamento explícito: o rastro fica, para a limpeza saber o que sobrou. */
export async function cancelarEnvioDeVideo(params: { uploadId: string }): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: envio } = await admin
    .from('lesson_video_uploads')
    .select('id, course_id, status')
    .eq('id', params.uploadId)
    .maybeSingle()

  if (!envio) return { ok: true }

  try {
    await exigirEquipeDoCurso(envio.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  if ((ESTADOS_EM_ABERTO as readonly string[]).includes(envio.status)) {
    await admin
      .from('lesson_video_uploads')
      .update({ status: ESTADO_ENVIO.CANCELADO })
      .eq('id', envio.id)
  }
  return { ok: true }
}

async function marcarFalha(uploadId: string) {
  await createAdminClient()
    .from('lesson_video_uploads')
    .update({ status: ESTADO_ENVIO.FALHOU })
    .eq('id', uploadId)
}

/** Baixa apenas os primeiros bytes do objeto e confere a assinatura. */
async function conferirAssinatura(bucket: string, caminho: string, mime: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: assinada } = await admin.storage.from(bucket).createSignedUrl(caminho, 60)
  if (!assinada?.signedUrl) return false

  try {
    const resposta = await fetch(assinada.signedUrl, {
      headers: { Range: `bytes=0-${BYTES_DE_ASSINATURA - 1}` },
    })
    if (!resposta.ok) return false
    const bytes = new Uint8Array(await resposta.arrayBuffer())
    return assinaturaConfere(bytes, mime)
  } catch (e) {
    console.error('[video] falha ao ler assinatura', e)
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Publicação, ordem e remoção                                                 */
/* -------------------------------------------------------------------------- */

export async function publicarAula(lessonId: string, publicar: boolean): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: aula } = await admin
    .from('lessons')
    .select('id, course_id, module_id, video_asset_id, content_type, body')
    .eq('id', lessonId)
    .maybeSingle()

  if (!aula) return { ok: false, message: 'Aula não encontrada.' }

  try {
    await exigirEquipeDoCurso(aula.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  /*
   * Pré-condições para publicar aula de vídeo (§4).
   *
   * Quem responde é o banco, por `lesson_video_is_ready`: existe vídeo
   * validado E não há nenhum envio em aberto para esta aula. As duas metades
   * importam — publicar com o upload ainda subindo entrega tela vazia a quem
   * pagou, mesmo que um vídeo antigo esteja ligado.
   */
  if (publicar && aula.content_type === 'video') {
    const { data: pronto, error: erroPronto } = await admin.rpc('lesson_video_is_ready', {
      p_lesson_id: lessonId,
    })

    if (erroPronto) {
      console.error('[formacao] falha ao checar prontidão do vídeo', erroPronto.message)
      return { ok: false, message: 'Não foi possível verificar o vídeo desta aula. Tente de novo.' }
    }

    if (pronto !== true) {
      const { data: emAberto } = await admin
        .from('lesson_video_uploads')
        .select('status')
        .eq('lesson_id', lessonId)
        .in('status', [...ESTADOS_EM_ABERTO])
        .limit(1)
        .maybeSingle()

      return {
        ok: false,
        message: emAberto
          ? 'O envio do vídeo desta aula ainda não terminou. Espere concluir antes de publicar.'
          : 'Esta aula ainda não tem vídeo. Envie o vídeo antes de publicar.',
      }
    }
  }

  const { error } = await admin
    .from('lessons')
    .update({
      status: publicar ? 'published' : 'draft',
      published_at: publicar ? new Date().toISOString() : null,
    })
    .eq('id', lessonId)

  if (error) return { ok: false, message: traduzirErro(error.message, error.code) }

  revalidarPainel(aula.module_id)
  return { ok: true, id: lessonId }
}

/** Nova ordem das aulas dentro do capítulo. Recebe os ids já ordenados. */
export async function reordenarAulas(moduleId: string, idsEmOrdem: string[]): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: modulo } = await admin
    .from('modules')
    .select('id, course_id')
    .eq('id', moduleId)
    .maybeSingle()

  if (!modulo) return { ok: false, message: 'Capítulo não encontrado.' }

  try {
    await exigirEquipeDoCurso(modulo.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  // Só reordena o que é realmente deste capítulo — a lista vem do navegador.
  const { data: doCapitulo } = await admin
    .from('lessons')
    .select('id')
    .eq('module_id', moduleId)

  const permitidos = new Set((doCapitulo ?? []).map((a) => a.id))
  const ids = idsEmOrdem.filter((id) => permitidos.has(id))

  for (const [indice, id] of ids.entries()) {
    await admin
      .from('lessons')
      .update({ position: indice + 1 })
      .eq('id', id)
      .eq('module_id', moduleId)
  }

  revalidarPainel(moduleId)
  return { ok: true }
}

/** Move a aula para outro capítulo. O trigger do banco acerta o course_id. */
export async function moverAulaDeCapitulo(
  lessonId: string,
  destinoModuleId: string,
): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const [{ data: aula }, { data: destino }] = await Promise.all([
    admin.from('lessons').select('id, course_id, module_id').eq('id', lessonId).maybeSingle(),
    admin.from('modules').select('id, course_id').eq('id', destinoModuleId).maybeSingle(),
  ])

  if (!aula || !destino) return { ok: false, message: 'Aula ou capítulo não encontrado.' }

  try {
    await exigirEquipeDoCurso(aula.course_id)
    if (destino.course_id !== aula.course_id) await exigirEquipeDoCurso(destino.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const { data: ultima } = await admin
    .from('lessons')
    .select('position')
    .eq('module_id', destinoModuleId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin
    .from('lessons')
    .update({ module_id: destinoModuleId, position: (ultima?.position ?? 0) + 1 })
    .eq('id', lessonId)

  if (error) return { ok: false, message: traduzirErro(error.message, error.code) }

  revalidarPainel(aula.module_id)
  revalidarPainel(destinoModuleId)
  return { ok: true, id: lessonId }
}

/**
 * Arquivar ou excluir.
 *
 * Se alguma aluna já tem progresso na aula, EXCLUIR NÃO É OPÇÃO: o
 * `on delete cascade` de `lesson_progress` levaria o histórico dela junto.
 * Nesse caso a aula é arquivada — some da área da aluna, o registro fica.
 * Quem decide é o banco (`lesson_has_student_history`), não a interface.
 */
export async function arquivarOuExcluirAula(lessonId: string): Promise<
  ResultadoAcao & { arquivada?: boolean }
> {
  const admin = createAdminClient()

  const { data: aula } = await admin
    .from('lessons')
    .select('id, course_id, module_id, status')
    .eq('id', lessonId)
    .maybeSingle()

  if (!aula) return { ok: false, message: 'Aula não encontrada.' }

  try {
    await exigirEquipeDoCurso(aula.course_id)
  } catch (e) {
    return { ok: false, message: mensagemDeErro(e, 'Sem permissão.') }
  }

  const { data: temHistorico } = await admin.rpc('lesson_has_student_history', {
    p_lesson_id: lessonId,
  })

  if (temHistorico === true) {
    const { error } = await admin
      .from('lessons')
      .update({ status: 'archived', published_at: null })
      .eq('id', lessonId)

    if (error) return { ok: false, message: 'Não foi possível arquivar a aula.' }
    revalidarPainel(aula.module_id)
    return { ok: true, id: lessonId, arquivada: true }
  }

  const { error } = await admin.from('lessons').delete().eq('id', lessonId)
  if (error) return { ok: false, message: 'Não foi possível excluir a aula.' }

  revalidarPainel(aula.module_id)
  return { ok: true, arquivada: false }
}

/* -------------------------------------------------------------------------- */

function revalidarPainel(moduleId?: string) {
  revalidatePath('/admin/formacao')
  if (moduleId) revalidatePath(`/admin/formacao/capitulo/${moduleId}`)
  revalidatePath('/aluna/cursos')
  revalidatePath('/cursos')
}

function traduzirErro(mensagem: string, codigo?: string) {
  if (codigo === '23505') return 'Já existe uma aula com este endereço (slug) neste capítulo.'
  if (mensagem.includes('lessons_release_date_required')) {
    return 'A liberação “em uma data” exige a data de liberação.'
  }
  if (mensagem.includes('lessons_release_days_required')) {
    return 'A liberação “N dias após a matrícula” exige o número de dias.'
  }
  if (mensagem.includes('lessons_live_requires_start')) {
    return 'Aula ao vivo exige o horário de início.'
  }
  console.error('[formacao]', mensagem)
  return 'Não foi possível salvar. Revise os campos.'
}
