import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormularioCurso } from './formulario'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()

  const [categorias, niveis] = await Promise.all([
    db.from('course_categories').select('id, name').order('position'),
    db.from('course_levels').select('id, name').order('position'),
  ])

  if (id === 'novo') {
    return (
      <>
        <h1 className="admin__titulo">Novo curso</h1>
        <FormularioCurso categorias={categorias.data ?? []} niveis={niveis.data ?? []} />
      </>
    )
  }

  const { data: curso } = await db.from('courses').select('*').eq('id', id).maybeSingle()
  if (!curso) notFound()

  return (
    <>
      <h1 className="admin__titulo">{curso.name}</h1>
      <p style={{ marginBlockEnd: 'var(--space-5)' }}>
        <Link href={`/admin/modulos?pai=${curso.id}`}>Ver os módulos deste curso →</Link>
      </p>
      <FormularioCurso curso={curso} categorias={categorias.data ?? []} niveis={niveis.data ?? []} />
    </>
  )
}
