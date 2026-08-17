import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { aulasDaPrevia, previaAtiva } from '@/lib/admin/previa'
import { MARCA } from '@/lib/marca'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Capítulo' }

/**
 * UM CAPÍTULO NA ÁREA DA ALUNA.
 *
 * Hoje só responde no modo de conferência — é a tela que a responsável precisa
 * mostrar ao cliente. Para uma aluna matriculada de verdade o caminho continua
 * sendo `/aluna/curso/[slug]`, que não foi tocado nesta rodada.
 *
 * Capítulo FECHADO no plano em conferência devolve 404 em vez de mostrar a
 * lista: exibir as aulas de um capítulo bloqueado entregaria de graça o
 * conteúdo do pacote mais caro.
 *
 * Continua sendo leitura. Abrir esta tela não grava progresso nenhum.
 */
export default async function CapituloDaAlunaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/entrar?proximo=/aluna/capitulo/${id}`)

  const previa = await previaAtiva()
  if (!previa) notFound()

  const capitulo = await aulasDaPrevia(previa, id)
  if (!capitulo) notFound()

  return (
    <main id="conteudo" className="page section">
      <article className="cap-aluna">
        <header className="cap-aluna__topo">
          <p className="cap-aluna__trilha">
            <Link href="/aluna/cursos">Minha formação</Link>
          </p>
          <p className="cap-aluna__ordem mono">
            Capítulo {String(capitulo.posicao).padStart(2, '0')}
          </p>
          <h1 className="cap-aluna__titulo">{capitulo.nome}</h1>
          <p className="cap-aluna__resumo">
            {capitulo.aulas.length}{' '}
            {capitulo.aulas.length === 1 ? 'aula neste capítulo' : 'aulas neste capítulo'}
          </p>
        </header>

        <h2 className="cap-aluna__secao">Aulas deste capítulo</h2>

        {capitulo.aulas.length === 0 ? (
          /*
           * Capítulo liberado mas sem aula publicada. É o estado real hoje —
           * e dizer isso é melhor do que uma lista vazia que parece defeito.
           */
          <div className="vazio-explicado">
            <p className="vazio-explicado__titulo">Nenhuma aula publicada ainda</p>
            <p className="vazio-explicado__texto">
              Este capítulo já está liberado para você. As aulas aparecem aqui assim que forem
              publicadas.
            </p>
          </div>
        ) : (
          <ol className="cap-aluna__aulas" role="list">
            {capitulo.aulas.map((aula, i) => (
              <li className="cap-aluna__aula" key={aula.id}>
                <span className="cap-aluna__aula-ordem mono">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <span className="cap-aluna__aula-capa">
                  {aula.capa ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={aula.capa} alt="" loading="lazy" />
                  ) : (
                    <Image src={MARCA.logo.src} alt="" width={96} height={96} />
                  )}
                </span>

                <div className="cap-aluna__aula-corpo">
                  <p className="cap-aluna__aula-titulo">{aula.titulo}</p>
                  <p className="cap-aluna__aula-meta">
                    {formatarDuracao(aula.duracaoSegundos) ??
                      (aula.temVideo ? 'Vídeo' : 'Sem vídeo ainda')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </article>
    </main>
  )
}

/** Devolve `null` quando não há dado — a tela então diz outra coisa. */
function formatarDuracao(segundos: number | null): string | null {
  if (!segundos || segundos <= 0) return null
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m} min ${String(s).padStart(2, '0')}s`
}
