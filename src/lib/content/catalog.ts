import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * Consultas do catalogo.
 *
 * Todas partem do que esta CADASTRADO e PUBLICADO. Nenhuma devolve conteudo
 * de exemplo quando o banco esta vazio: quem trata o vazio e a interface,
 * com um estado vazio honesto.
 */

export type CourseCard = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  coverPath: string | null
  coverAlt: string | null
  workloadMinutes: number | null
  levelName: string | null
  categoryName: string | null
  instructorNames: string[]
}

export async function listPublishedCourses(options?: { categorySlug?: string; limit?: number }) {
  const db = await createClient()

  let query = db
    .from('courses')
    .select(
      `id, name, slug, short_description, workload_minutes,
       cover:media_assets!courses_cover_id_fkey (path, alt),
       level:course_levels (name),
       category:course_categories (name, slug),
       course_instructors (instructors (name))`,
    )
    .eq('status', 'published')
    .order('position', { ascending: true })

  if (options?.categorySlug) {
    query = query.eq('course_categories.slug', options.categorySlug)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    console.error('[catalog] listPublishedCourses', error)
    return [] as CourseCard[]
  }

  return (data ?? []).map(mapCourseCard)
}

export async function getCourseBySlug(slug: string) {
  const db = await createClient()

  const { data, error } = await db
    .from('courses')
    .select(
      `id, name, slug, short_description, full_description, workload_minutes,
       access_mode, access_days, access_until, certificate_enabled,
       audience, prerequisites, required_materials, welcome_message, seo,
       promo_video_url,
       cover:media_assets!courses_cover_id_fkey (path, alt),
       level:course_levels (name),
       category:course_categories (name, slug),
       course_instructors (role_label, instructors (id, name, slug, headline, bio_short, photo:media_assets!instructors_photo_id_fkey (path, alt)))`,
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[catalog] getCourseBySlug', error)
    return null
  }
  return data
}

/**
 * Arvore do curso com o gate ja aplicado pelo banco.
 * Aulas bloqueadas aparecem com titulo, mas released=false.
 */
export async function getCourseOutline(courseId: string, userId?: string) {
  const db = await createClient()

  const { data, error } = await db.rpc('course_outline', {
    p_course_id: courseId,
    p_user_id: userId ?? null,
  })

  if (error) {
    console.error('[catalog] getCourseOutline', error)
    return []
  }

  type Row = {
    module_id: string
    module_name: string
    module_position: number
    module_released: boolean
    lesson_id: string | null
    lesson_title: string | null
    lesson_position: number | null
    lesson_type: string | null
    lesson_duration: number | null
    lesson_is_free: boolean | null
    lesson_released: boolean | null
    lesson_status: string | null
  }

  const modules = new Map<
    string,
    {
      id: string
      name: string
      position: number
      released: boolean
      lessons: Array<{
        id: string
        title: string
        position: number
        type: string
        durationSeconds: number | null
        isFree: boolean
        released: boolean
        status: string
      }>
    }
  >()

  for (const row of (data ?? []) as Row[]) {
    if (!modules.has(row.module_id)) {
      modules.set(row.module_id, {
        id: row.module_id,
        name: row.module_name,
        position: row.module_position,
        released: row.module_released,
        lessons: [],
      })
    }
    if (row.lesson_id) {
      modules.get(row.module_id)!.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title ?? '',
        position: row.lesson_position ?? 0,
        type: row.lesson_type ?? 'video',
        durationSeconds: row.lesson_duration,
        isFree: row.lesson_is_free ?? false,
        released: row.lesson_released ?? false,
        status: row.lesson_status ?? 'not_started',
      })
    }
  }

  return [...modules.values()]
}

/** Aulas da aluna: cursos em que ela tem matricula ativa. */
export async function listMyEnrollments(userId: string) {
  const db = await createClient()

  const { data, error } = await db
    .from('enrollments')
    .select(
      `id, status, progress_pct, expires_at, last_activity_at,
       last_lesson:lessons!enrollments_last_lesson_id_fkey (id, title, module_id),
       course:courses (id, name, slug, short_description,
         cover:media_assets!courses_cover_id_fkey (path, alt))`,
    )
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('last_activity_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[catalog] listMyEnrollments', error)
    return []
  }
  return data ?? []
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapCourseCard(row: any): CourseCard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    coverPath: row.cover?.path ?? null,
    coverAlt: row.cover?.alt ?? null,
    workloadMinutes: row.workload_minutes,
    levelName: row.level?.name ?? null,
    categoryName: row.category?.name ?? null,
    instructorNames: (row.course_instructors ?? [])
      .map((ci: any) => ci.instructors?.name)
      .filter(Boolean),
  }
}
