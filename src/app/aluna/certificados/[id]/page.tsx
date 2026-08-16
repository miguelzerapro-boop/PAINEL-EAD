import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { Aviso } from '@/components/estados'
import { formatDate, formatWorkload } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Certificado' }
export const dynamic = 'force-dynamic'

/**
 * Visualização do certificado.
 *
 * É AQUI que a moldura de diploma aparece — uma vez, grande. Na listagem ela
 * seria uma parede de molduras competindo entre si.
 */
export default async function CertificadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/certificados/${id}`)

  const { data: certificado } = await db
    .from('certificates')
    .select('id, code, course_name, student_name, workload_minutes, issued_at, revoked_at, pdf_url')
    .eq('id', id)
    .maybeSingle()

  if (!certificado) notFound()

  return (
    <main id="conteudo" className="area">
      <p className="aula-foco__migalha">
        <Link href="/aluna/certificados">Certificados</Link>
      </p>

      {certificado.revoked_at ? (
        <Aviso tone="error" titulo="Este certificado foi revogado">
          <p>Fale com a equipe se você acha que houve engano.</p>
        </Aviso>
      ) : null}

      <div className="certificado" style={{ marginBlockStart: 'var(--space-5)' }}>
        <p className="titulo-apoio">Certificado de conclusão</p>
        <h1 className="certificado__curso">{certificado.course_name}</h1>
        <p className="certificado__nome">{certificado.student_name}</p>

        <dl className="certificado__dados">
          <div>
            <dt>Emitido em</dt>
            <dd className="mono">{formatDate(certificado.issued_at, 'long')}</dd>
          </div>
          {formatWorkload(certificado.workload_minutes) ? (
            <div>
              <dt>Carga horária</dt>
              <dd className="mono">{formatWorkload(certificado.workload_minutes)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Código de validação</dt>
            <dd className="mono">{certificado.code}</dd>
          </div>
        </dl>
      </div>

      <div
        style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBlockStart: 'var(--space-6)' }}
      >
        {certificado.pdf_url ? (
          <a className="botao botao--primario" href={`/api/certificados/${certificado.id}/baixar`}>
            Baixar PDF
          </a>
        ) : (
          <span className="selo" data-tom="atencao">
            PDF ainda não gerado
          </span>
        )}
      </div>

      <p className="lista__meta" style={{ marginBlockStart: 'var(--space-5)' }}>
        Qualquer pessoa pode conferir a autenticidade informando o código acima.
      </p>
    </main>
  )
}
