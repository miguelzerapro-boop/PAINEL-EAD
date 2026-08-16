import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * A FORMAÇÃO E SEUS CAPÍTULOS
 *
 * Camada de leitura do painel. Duas regras governam este arquivo:
 *
 *  1. Nenhum nome de capítulo mora aqui. Os oito nomes estão no BANCO
 *     (migration 23) e a responsável pode renomear, reordenar, arquivar ou
 *     acrescentar pelo painel. Escrevê-los no frontend transformaria conteúdo
 *     editável em constante de código.
 *
 *  2. Todo número exibido é contado do banco. Não existe "8 aulas" default,
 *     não existe duração estimada. Capítulo sem aula devolve 0 e a tela diz
 *     isso com todas as letras, em vez de fingir conteúdo.
 *
 * Qual curso é "a formação" vem de settings.content_main_course — trocar o
 * valor aponta o painel para outra formação sem tocar em código.
 */

export type ContagemDeAulas = {
  total: number
  publicadas: number
  rascunhos: number
  agendadas: number
  arquivadas: number
  /** Quantas já têm vídeo enviado e ligado. */
  comVideo: number
}

export type Capitulo = {
  id: string
  nome: string
  slug: string | null
  descricao: string | null
  posicao: number
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  releaseMode: string
  aulas: ContagemDeAulas
}

export type Formacao = {
  id: string
  nome: string
  slug: string
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  descricaoCurta: string | null
  capitulos: Capitulo[]
}

const CONTAGEM_ZERO: ContagemDeAulas = {
  total: 0,
  publicadas: 0,
  rascunhos: 0,
  agendadas: 0,
  arquivadas: 0,
  comVideo: 0,
}

/** Slug do curso que o painel trata como "a formação". */
export async function slugDaFormacao(): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('settings')
    .select('value')
    .eq('key', 'content.main_course')
    .maybeSingle()

  return typeof data?.value === 'string' && data.value.trim() ? data.value.trim() : null
}

/**
 * A formação com os capítulos e a contagem real de aulas de cada um.
 *
 * Arquivados ficam de fora da listagem principal do painel — continuam no
 * banco, só não competem com o que está em produção.
 */
export async function getFormacao(): Promise<Formacao | null> {
  const slug = await slugDaFormacao()
  if (!slug) return null

  const db = createAdminClient()

  const { data: curso } = await db
    .from('courses')
    .select('id, name, slug, status, short_description')
    .eq('slug', slug)
    .maybeSingle()

  if (!curso) return null

  const [{ data: modulos }, { data: aulas }] = await Promise.all([
    db
      .from('modules')
      .select('id, name, slug, description, position, status, release_mode')
      .eq('course_id', curso.id)
      .neq('status', 'archived')
      .order('position'),
    db
      .from('lessons')
      .select('id, module_id, status, video_asset_id')
      .eq('course_id', curso.id),
  ])

  // Contagem por capítulo, feita sobre as linhas reais.
  const porModulo = new Map<string, ContagemDeAulas>()
  for (const aula of aulas ?? []) {
    const atual = porModulo.get(aula.module_id) ?? { ...CONTAGEM_ZERO }
    atual.total += 1
    if (aula.status === 'published') atual.publicadas += 1
    else if (aula.status === 'draft') atual.rascunhos += 1
    else if (aula.status === 'scheduled') atual.agendadas += 1
    else if (aula.status === 'archived') atual.arquivadas += 1
    if (aula.video_asset_id) atual.comVideo += 1
    porModulo.set(aula.module_id, atual)
  }

  return {
    id: curso.id,
    nome: curso.name,
    slug: curso.slug,
    status: curso.status,
    descricaoCurta: curso.short_description,
    capitulos: (modulos ?? []).map((m) => ({
      id: m.id,
      nome: m.name,
      slug: m.slug,
      descricao: m.description,
      posicao: m.position,
      status: m.status,
      releaseMode: m.release_mode,
      aulas: porModulo.get(m.id) ?? { ...CONTAGEM_ZERO },
    })),
  }
}

export type AulaDoCapitulo = {
  id: string
  titulo: string
  descricao: string | null
  posicao: number
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  gratuita: boolean
  duracaoSegundos: number | null
  temVideo: boolean
  videoPath: string | null
  videoNome: string | null
  videoBytes: number | null
  /** Alguma aluna já tem progresso nesta aula? Decide excluir vs. arquivar. */
  temHistorico: boolean
}

export type CapituloComAulas = {
  capitulo: Capitulo
  cursoId: string
  cursoNome: string
  aulas: AulaDoCapitulo[]
}

/** Um capítulo com as aulas dele, na ordem de exibição. */
export async function getCapituloComAulas(moduleId: string): Promise<CapituloComAulas | null> {
  const db = createAdminClient()

  const { data: modulo } = await db
    .from('modules')
    .select('id, name, slug, description, position, status, release_mode, course_id, courses:course_id (name)')
    .eq('id', moduleId)
    .maybeSingle()

  if (!modulo) return null

  const { data: aulas } = await db
    .from('lessons')
    .select(
      'id, title, description, position, status, is_free, duration_seconds, video_asset_id, media_assets:video_asset_id (path, byte_size)',
    )
    .eq('module_id', moduleId)
    .order('position')

  const ids = (aulas ?? []).map((a) => a.id)

  // Quais aulas já têm progresso de aluna. Uma consulta, não uma por aula.
  const comHistorico = new Set<string>()
  if (ids.length > 0) {
    const { data: progresso } = await db
      .from('lesson_progress')
      .select('lesson_id')
      .in('lesson_id', ids)
    for (const p of progresso ?? []) comHistorico.add(p.lesson_id)
  }

  // Nome original do arquivo, para a tela mostrar algo reconhecível.
  const nomesDeArquivo = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: envios } = await db
      .from('lesson_video_uploads')
      .select('lesson_id, file_name, status')
      .in('lesson_id', ids)
      .eq('status', 'concluido')
    for (const e of envios ?? []) nomesDeArquivo.set(e.lesson_id, e.file_name)
  }

  const contagem: ContagemDeAulas = { ...CONTAGEM_ZERO }
  for (const a of aulas ?? []) {
    contagem.total += 1
    if (a.status === 'published') contagem.publicadas += 1
    else if (a.status === 'draft') contagem.rascunhos += 1
    else if (a.status === 'scheduled') contagem.agendadas += 1
    else if (a.status === 'archived') contagem.arquivadas += 1
    if (a.video_asset_id) contagem.comVideo += 1
  }

  return {
    cursoId: modulo.course_id,
    cursoNome: (modulo.courses as { name?: string } | null)?.name ?? '',
    capitulo: {
      id: modulo.id,
      nome: modulo.name,
      slug: modulo.slug,
      descricao: modulo.description,
      posicao: modulo.position,
      status: modulo.status,
      releaseMode: modulo.release_mode,
      aulas: contagem,
    },
    aulas: (aulas ?? []).map((a) => {
      const midia = a.media_assets as { path?: string; byte_size?: number } | null
      return {
        id: a.id,
        titulo: a.title,
        descricao: a.description,
        posicao: a.position,
        status: a.status,
        gratuita: a.is_free,
        duracaoSegundos: a.duration_seconds,
        temVideo: Boolean(a.video_asset_id),
        videoPath: midia?.path ?? null,
        videoNome: nomesDeArquivo.get(a.id) ?? null,
        videoBytes: midia?.byte_size ?? null,
        temHistorico: comHistorico.has(a.id),
      }
    }),
  }
}

/** Uma aula para edição no painel. */
export async function getAulaParaEdicao(lessonId: string) {
  const db = createAdminClient()

  const { data } = await db
    .from('lessons')
    .select(
      'id, module_id, course_id, title, description, position, status, is_free, content_type, duration_seconds, release_mode, release_at, release_days, video_provider, video_asset_id, media_assets:video_asset_id (path, byte_size, mime_type), capa:video_thumbnail_id (bucket, path)',
    )
    .eq('id', lessonId)
    .maybeSingle()

  if (!data) return null

  const { data: envio } = await db
    .from('lesson_video_uploads')
    .select('file_name, byte_size')
    .eq('lesson_id', lessonId)
    .eq('status', 'concluido')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const midia = data.media_assets as { path?: string; byte_size?: number; mime_type?: string } | null

  return {
    id: data.id,
    moduleId: data.module_id,
    courseId: data.course_id,
    titulo: data.title,
    descricao: data.description,
    posicao: data.position,
    status: data.status as 'draft' | 'scheduled' | 'published' | 'archived',
    gratuita: data.is_free,
    duracaoSegundos: data.duration_seconds,
    releaseMode: data.release_mode as string,
    releaseAt: data.release_at as string | null,
    releaseDays: data.release_days as number | null,
    video: midia?.path
      ? {
          path: midia.path,
          bytes: midia.byte_size ?? envio?.byte_size ?? null,
          mime: midia.mime_type ?? null,
          nome: envio?.file_name ?? null,
        }
      : null,
    /*
     * A capa vira URL pública aqui, e não no componente: `cms-media` é um
     * bucket público, então basta montar o endereço. Deixar isso para o
     * cliente espalharia o formato da URL do Storage pela interface.
     */
    capa: capaUrl(data.capa as { bucket?: string; path?: string } | null),
  }
}

function capaUrl(capa: { bucket?: string; path?: string } | null): string | null {
  if (!capa?.path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/storage/v1/object/public/${capa.bucket ?? 'cms-media'}/${capa.path}`
}

/** Próxima posição livre dentro do capítulo. Evita duas aulas na mesma ordem. */
export async function proximaPosicao(moduleId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from('lessons')
    .select('position')
    .eq('module_id', moduleId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.position ?? 0) + 1
}
