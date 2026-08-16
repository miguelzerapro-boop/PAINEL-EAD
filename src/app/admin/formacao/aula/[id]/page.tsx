import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { FormularioDeAula } from './formulario'
import { getAulaParaEdicao, getFormacao, proximaPosicao } from '@/lib/content/formacao'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Aula' }

/**
 * Cadastro de aula.
 *
 * `/admin/formacao/aula/nova` cria; `/admin/formacao/aula/{id}` edita. A lista
 * de capítulos do select vem do banco — os oito nomes não estão escritos aqui.
 */
export default async function AulaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ capitulo?: string }>
}) {
  const { id } = await params
  const { capitulo: capituloPreferido } = await searchParams

  const formacao = await getFormacao()
  const primeiroCapitulo = formacao?.capitulos[0]
  if (!formacao || !primeiroCapitulo) notFound()

  const nova = id === 'nova'
  const aula = nova ? null : await getAulaParaEdicao(id)
  if (!nova && !aula) notFound()

  const moduleIdInicial =
    aula?.moduleId ??
    (capituloPreferido && formacao.capitulos.some((c) => c.id === capituloPreferido)
      ? capituloPreferido
      : primeiroCapitulo.id)

  const posicaoSugerida = aula?.posicao ?? (await proximaPosicao(moduleIdInicial))

  return (
    <>
      <p className="admin__migalha">
        <Link href="/admin/formacao">{formacao.nome}</Link>
        {' · '}
        <Link href={`/admin/formacao/capitulo/${moduleIdInicial}`}>Capítulo</Link>
      </p>

      <h1 className="admin__titulo">{nova ? 'Adicionar aula' : 'Editar aula'}</h1>

      <FormularioDeAula
        capitulos={formacao.capitulos.map((c, i) => ({
          id: c.id,
          nome: c.nome,
          numero: i + 1,
        }))}
        moduleIdInicial={moduleIdInicial}
        posicaoSugerida={posicaoSugerida}
        aula={
          aula
            ? {
                id: aula.id,
                titulo: aula.titulo,
                descricao: aula.descricao ?? '',
                posicao: aula.posicao,
                status: aula.status,
                gratuita: aula.gratuita,
                releaseMode: aula.releaseMode,
                releaseAt: aula.releaseAt,
                releaseDays: aula.releaseDays,
                video: aula.video ? { nome: aula.video.nome, bytes: aula.video.bytes } : null,
              }
            : null
        }
      />
    </>
  )
}
