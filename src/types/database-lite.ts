/**
 * Tipos mínimos escritos à mão, usados enquanto os tipos gerados não existem.
 *
 * Para gerar os tipos completos a partir do banco real:
 *   npm run db:types
 * (grava src/types/database.ts, que está no .gitignore)
 */

export type Database = {
  publication_status: 'draft' | 'scheduled' | 'published' | 'archived'
  user_role: 'student' | 'instructor' | 'admin' | 'owner'
  content_type:
    | 'video'
    | 'text'
    | 'audio'
    | 'pdf'
    | 'image'
    | 'download'
    | 'link'
    | 'live'
    | 'quiz'
    | 'practice'
    | 'form'
    | 'embed'
  release_mode:
    | 'immediate'
    | 'after_previous_module'
    | 'after_previous_lesson'
    | 'on_date'
    | 'days_after_enrollment'
    | 'manual'
    | 'by_cohort'
  lesson_progress_status: 'not_started' | 'in_progress' | 'completed'
  order_status:
    | 'pending'
    | 'in_process'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'refunded'
    | 'chargeback'
}
