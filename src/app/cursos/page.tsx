import type { Metadata } from 'next'

import { Palheta, Trilho } from '@/components/palheta'
import { Rodape, Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { listPublishedCourses } from '@/lib/content/catalog'
import { formatWorkload } from '@/lib/format'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Cursos',
}

export const revalidate = 300

/**
 * Catálogo público.
 * Renderiza SOMENTE cursos cadastrados e publicados pelo administrador.
 */
export default async function CatalogoPage() {
  const cursos = await listPublishedCourses()
  const whatsapp = await getWhatsAppTarget()

  return (
    <>
      <Topo />
      <main id="conteudo" className="page section">
        <p className="eyebrow">Mostruário</p>
        <h1>Cursos</h1>

        {cursos.length === 0 ? (
          <div style={{ marginBlockStart: 'var(--space-6)' }}>
            <EstadoVazio
              titulo="Nenhum curso publicado ainda"
              texto="Os cursos aparecem aqui assim que forem cadastrados e publicados. Se quiser saber quando isso acontece, fale com a gente."
              acao={
                whatsapp.available
                  ? { label: 'Falar no WhatsApp', href: whatsapp.href }
                  : { label: 'Fazer o diagnóstico', href: '/diagnostico' }
              }
            />
          </div>
        ) : (
          <div style={{ marginBlockStart: 'var(--space-7)' }}>
            <Trilho rotulo="Cursos disponíveis">
              {cursos.map((curso, i) => (
                <Palheta
                  key={curso.id}
                  codigo={`N.${String(i + 1).padStart(2, '0')}`}
                  titulo={curso.name}
                  meta={
                    [curso.levelName, formatWorkload(curso.workloadMinutes), curso.instructorNames[0]]
                      .filter(Boolean)
                      .join(' · ') || null
                  }
                  href={`/cursos/${curso.slug}`}
                  destaque={i === 0}
                />
              ))}
            </Trilho>
          </div>
        )}
      </main>
      <Rodape />
    </>
  )
}
