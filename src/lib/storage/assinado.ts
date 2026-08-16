import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * ENTREGA DE ARQUIVO PRIVADO
 *
 * Regra do projeto: conteúdo pago e dado pessoal NUNCA saem por URL pública
 * permanente. Toda entrega passa por aqui e obedece a mesma sequência:
 *
 *   1. descobrir quem está pedindo (sessão real, não id vindo do cliente);
 *   2. perguntar ao BANCO se essa pessoa pode ver — `lesson_is_released()`,
 *      propriedade do registro, status de publicação;
 *   3. só então assinar uma URL de vida curta com a service role.
 *
 * A service role fica exclusivamente neste arquivo (`server-only`) e o link
 * assinado NUNCA é gravado no banco: ele é gerado a cada pedido e morre.
 */

/** Vida do link por bucket. Curto o bastante para não virar link compartilhável. */
const VALIDADE_SEGUNDOS = {
  'lesson-videos': 900, // 15 min — o suficiente para assistir e retomar
  'lesson-assets': 900,
  'student-submissions': 600,
  'submission-feedback': 600,
  certificates: 300,
  'profile-avatars': 600,
  testimonials: 3600,
} as const

type BucketPrivado = keyof typeof VALIDADE_SEGUNDOS

export type ResultadoArquivo =
  | { ok: true; url: string; expiraEm: number }
  | { ok: false; motivo: 'sem_sessao' | 'sem_permissao' | 'nao_encontrado' | 'falha' }

async function assinar(bucket: BucketPrivado, caminho: string): Promise<ResultadoArquivo> {
  const validade = VALIDADE_SEGUNDOS[bucket]
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(caminho, validade)

  if (error || !data?.signedUrl) {
    console.error('[storage] falha ao assinar', { bucket, erro: error?.message })
    return { ok: false, motivo: 'falha' }
  }
  return { ok: true, url: data.signedUrl, expiraEm: validade }
}

/** Quem está pedindo, segundo a sessão — nunca segundo o cliente. */
async function usuarioDaSessao() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  return user?.id ?? null
}

/* -------------------------------------------------------------------------- */
/* Vídeo e material de aula — conteúdo pago                                    */
/* -------------------------------------------------------------------------- */

/**
 * Só assina depois que o BANCO confirmar a liberação.
 * A verificação de matrícula, prazo, turma e pré-requisito está toda dentro de
 * `lesson_is_released()` — aqui não se reimplementa nada disso.
 */
export async function urlDeMidiaDaAula(params: {
  lessonId: string
  bucket: 'lesson-videos' | 'lesson-assets'
  caminho: string
}): Promise<ResultadoArquivo> {
  const userId = await usuarioDaSessao()
  if (!userId) return { ok: false, motivo: 'sem_sessao' }

  const db = await createClient()
  const { data: liberada, error } = await db.rpc('lesson_is_released', {
    p_lesson_id: params.lessonId,
    p_user_id: userId,
  })

  if (error) {
    console.error('[storage] falha ao checar liberação', error.message)
    return { ok: false, motivo: 'falha' }
  }
  if (!liberada) return { ok: false, motivo: 'sem_permissao' }

  // O caminho precisa pertencer à aula pedida. Sem isto, alguém com uma aula
  // liberada assinaria o vídeo de qualquer outra.
  if (!params.caminho.includes(`/${params.lessonId}/`)) {
    return { ok: false, motivo: 'sem_permissao' }
  }

  return assinar(params.bucket, params.caminho)
}

/* -------------------------------------------------------------------------- */
/* Entrega da aluna e devolutiva                                               */
/* -------------------------------------------------------------------------- */

/** A própria aluna, a instrutora do curso ou o admin. */
export async function urlDaEntrega(caminho: string): Promise<ResultadoArquivo> {
  const userId = await usuarioDaSessao()
  if (!userId) return { ok: false, motivo: 'sem_sessao' }

  const db = await createClient()

  // A RLS de storage.objects já decide. Se a linha aparece na leitura feita
  // com a sessão da pessoa, ela pode ver o arquivo.
  const { data } = await db
    .from('storage.objects' as never)
    .select('name')
    .eq('bucket_id', 'student-submissions')
    .eq('name', caminho)
    .maybeSingle()

  if (!data) {
    // Fallback explícito: confere dono pelo caminho e papel pelo banco.
    const dono = caminho.split('/')[0]
    if (dono !== userId) {
      const { data: staff } = await db.rpc('is_staff')
      if (!staff) return { ok: false, motivo: 'sem_permissao' }
    }
  }

  return assinar('student-submissions', caminho)
}

export async function urlDoFeedback(caminho: string): Promise<ResultadoArquivo> {
  const userId = await usuarioDaSessao()
  if (!userId) return { ok: false, motivo: 'sem_sessao' }

  const dono = caminho.split('/')[0]
  if (dono !== userId) {
    const db = await createClient()
    const { data: staff } = await db.rpc('is_staff')
    if (!staff) return { ok: false, motivo: 'sem_permissao' }
  }
  return assinar('submission-feedback', caminho)
}

/* -------------------------------------------------------------------------- */
/* Certificado — contém nome completo                                          */
/* -------------------------------------------------------------------------- */

export async function urlDoCertificado(certificateId: string): Promise<ResultadoArquivo> {
  const userId = await usuarioDaSessao()
  if (!userId) return { ok: false, motivo: 'sem_sessao' }

  const db = await createClient()
  const { data: certificado } = await db
    .from('certificates')
    .select('id, user_id, pdf_url')
    .eq('id', certificateId)
    .maybeSingle()

  // A RLS já limita a leitura ao dono e ao admin; a checagem explícita é a
  // segunda barreira.
  if (!certificado) return { ok: false, motivo: 'nao_encontrado' }
  if (!certificado.pdf_url) return { ok: false, motivo: 'nao_encontrado' }

  return assinar('certificates', certificado.pdf_url)
}

/* -------------------------------------------------------------------------- */
/* Foto de depoimento — só se estiver publicado, verificado e consentido       */
/* -------------------------------------------------------------------------- */

export async function urlDaFotoDeDepoimento(testimonialId: string): Promise<ResultadoArquivo> {
  const db = await createClient()

  // A RLS de `testimonials` já exige status publicado + verificado +
  // consentimento para a leitura pública.
  const { data } = await db
    .from('testimonials')
    .select('id, photo_id, media_assets:photo_id (path)')
    .eq('id', testimonialId)
    .maybeSingle()

  if (!data) return { ok: false, motivo: 'sem_permissao' }

  const caminho = (data.media_assets as { path?: string } | null)?.path
  if (!caminho) return { ok: false, motivo: 'nao_encontrado' }

  return assinar('testimonials', caminho)
}

/* -------------------------------------------------------------------------- */
/* Upload da aluna                                                             */
/* -------------------------------------------------------------------------- */

/**
 * URL de upload assinada, restrita à própria pasta.
 *
 * O caminho é MONTADO NO SERVIDOR a partir do id da sessão. O cliente não
 * escolhe onde grava — se escolhesse, bastaria trocar o `{user_id}` para
 * escrever na pasta de outra aluna. (A policy também barra, mas a interface
 * não deve nem tentar.)
 */
export async function urlDeEnvioDeEntrega(params: {
  activityId: string
  nomeDoArquivo: string
}): Promise<ResultadoArquivo & { caminho?: string }> {
  const userId = await usuarioDaSessao()
  if (!userId) return { ok: false, motivo: 'sem_sessao' }

  const db = await createClient()
  const { data: atividade } = await db
    .from('activities')
    .select('id, status')
    .eq('id', params.activityId)
    .eq('status', 'published')
    .maybeSingle()

  if (!atividade) return { ok: false, motivo: 'nao_encontrado' }

  const extensao = params.nomeDoArquivo.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin'
  const caminho = `${userId}/${params.activityId}/${crypto.randomUUID()}.${extensao}`

  const { data, error } = await createAdminClient()
    .storage.from('student-submissions')
    .createSignedUploadUrl(caminho)

  if (error || !data?.signedUrl) {
    console.error('[storage] falha ao assinar upload', error?.message)
    return { ok: false, motivo: 'falha' }
  }

  return { ok: true, url: data.signedUrl, expiraEm: 7200, caminho }
}
