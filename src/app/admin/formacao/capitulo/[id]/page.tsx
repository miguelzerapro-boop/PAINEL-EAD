import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CabecalhoAdmin } from '@/components/admin/cabecalho'
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
      <CabecalhoAdmin
        trilha={
          <>
            <Link href="/admin/formacao">{dados.cursoNome}</Link>
            {numero > 0 ? ` · Capítulo ${String(numero).padStart(2, '0')}` : null}
          </>
        }
        titulo={dados.capitulo.nome}
        descricao="As aulas aparecem para a aluna na ordem desta lista."
        selo={
          <span
            className="etiqueta"
            data-tone={dados.capitulo.status === 'published' ? 'ok' : 'rascunho'}
          >
            {dados.capitulo.status === 'published' ? 'publicado' : 'rascunho'}
          </span>
        }
        acao={
          <Link
            className="botao botao--primario"
            href={`/admin/formacao/aula/nova?capitulo=${dados.capitulo.id}`}
          >
            + Nova aula
          </Link>
        }
      />

      {/*
        Os números numa linha só. Antes eram três frases separadas por pontos
        num parágrafo do tamanho do título.
      */}
      {dados.aulas.length > 0 ? (
        <p className="resumo-linha">
          <strong>{dados.aulas.length}</strong>{' '}
          {dados.aulas.length === 1 ? 'aula' : 'aulas'}
          <span className="resumo-linha__sep" aria-hidden="true" />
          <strong>{dados.capitulo.aulas.publicadas}</strong> no ar
          {dados.capitulo.aulas.rascunhos > 0 ? (
            <>
              <span className="resumo-linha__sep" aria-hidden="true" />
              <strong>{dados.capitulo.aulas.rascunhos}</strong> em rascunho
            </>
          ) : null}
        </p>
      ) : null}

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
