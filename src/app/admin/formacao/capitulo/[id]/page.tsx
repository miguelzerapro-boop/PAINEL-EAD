import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ListaDeAulas } from './lista'
import { getCapituloComAulas, getFormacao } from '@/lib/content/formacao'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Aulas do capítulo' }

export default async function CapituloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [dados, formacao] = await Promise.all([getCapituloComAulas(id), getFormacao()])
  if (!dados) notFound()

  const numero = formacao ? formacao.capitulos.findIndex((c) => c.id === id) + 1 : 0

  return (
    <>
      <p className="admin__migalha">
        <Link href="/admin/formacao">{dados.cursoNome}</Link>
      </p>

      <div className="admin__cabecalho">
        <div>
          {numero > 0 ? (
            <p className="eyebrow mono">Capítulo {String(numero).padStart(2, '0')}</p>
          ) : null}
          <h1 className="admin__titulo" style={{ marginBlockEnd: 0 }}>
            {dados.capitulo.nome}
          </h1>
        </div>
        <span className="etiqueta" data-tone={dados.capitulo.status === 'published' ? 'ok' : 'rascunho'}>
          {dados.capitulo.status === 'published' ? 'publicado' : 'rascunho'}
        </span>
      </div>

      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-6)' }}>
        {dados.aulas.length === 0
          ? 'Nenhuma aula cadastrada neste capítulo.'
          : `${dados.aulas.length} ${dados.aulas.length === 1 ? 'aula' : 'aulas'} · ${
              dados.capitulo.aulas.publicadas
            } publicadas · ${dados.capitulo.aulas.rascunhos} rascunhos`}
      </p>

      <ListaDeAulas
        moduleId={dados.capitulo.id}
        aulas={dados.aulas}
        capitulos={(formacao?.capitulos ?? []).map((c, i) => ({
          id: c.id,
          nome: c.nome,
          numero: i + 1,
        }))}
      />
    </>
  )
}
