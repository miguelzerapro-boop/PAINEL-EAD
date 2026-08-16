import Link from 'next/link'
import type { Metadata } from 'next'

import { Aviso, EstadoVazio } from '@/components/estados'
import { getFormacao } from '@/lib/content/formacao'

export const metadata: Metadata = { title: 'Formação' }
export const dynamic = 'force-dynamic'

/**
 * OS CAPÍTULOS DA FORMAÇÃO
 *
 * Todo número desta tela é contado no banco. Não existe "8 aulas" padrão,
 * não existe duração estimada: capítulo sem aula mostra zero e diz o que
 * fazer a respeito.
 *
 * Os nomes também vêm do banco. Renomear um capítulo no painel muda esta tela
 * — não há nenhum dos oito nomes escrito neste arquivo.
 */
export default async function FormacaoPage() {
  const formacao = await getFormacao()

  if (!formacao) {
    return (
      <>
        <h1 className="admin__titulo">Formação</h1>
        <EstadoVazio
          titulo="Nenhuma formação configurada"
          texto="A configuração “Formação principal” aponta para um curso que não existe. Ajuste em Ajustes → Conteúdo."
          acao={{ label: 'Abrir ajustes', href: '/admin/ajustes' }}
        />
      </>
    )
  }

  const totalAulas = formacao.capitulos.reduce((s, c) => s + c.aulas.total, 0)
  const totalPublicadas = formacao.capitulos.reduce((s, c) => s + c.aulas.publicadas, 0)

  return (
    <>
      <div className="admin__cabecalho">
        <div>
          <p className="eyebrow">Conteúdo</p>
          <h1 className="admin__titulo" style={{ marginBlockEnd: 0 }}>
            {formacao.nome}
          </h1>
        </div>
        <span className="etiqueta" data-tone={formacao.status === 'published' ? 'ok' : 'rascunho'}>
          {rotuloStatus(formacao.status)}
        </span>
      </div>

      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-5)' }}>
        {formacao.capitulos.length}{' '}
        {formacao.capitulos.length === 1 ? 'capítulo' : 'capítulos'} ·{' '}
        {totalAulas === 0
          ? 'nenhuma aula cadastrada ainda'
          : `${totalAulas} ${totalAulas === 1 ? 'aula' : 'aulas'}, ${totalPublicadas} ${
              totalPublicadas === 1 ? 'publicada' : 'publicadas'
            }`}
      </p>

      {formacao.status !== 'published' ? (
        <div style={{ marginBlockEnd: 'var(--space-6)' }}>
          <Aviso tone="warning" titulo="A formação ainda não está no ar">
            Os capítulos e as aulas podem ser preparados agora, mas nada aparece para as alunas
            enquanto a formação estiver em {rotuloStatus(formacao.status)}.
            {!formacao.descricaoCurta ? (
              <>
                {' '}
                Para publicar, é preciso escrever a <strong>descrição curta</strong> do curso — o
                banco recusa publicar sem ela, justamente para que o site nunca exiba um texto
                inventado.
              </>
            ) : null}{' '}
            <Link href={`/admin/cursos/${formacao.id}`}>Abrir o cadastro da formação →</Link>
          </Aviso>
        </div>
      ) : null}

      {formacao.capitulos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum capítulo cadastrado"
          texto="Os capítulos organizam as aulas da formação. Cadastre o primeiro para começar."
          acao={{ label: 'Novo capítulo', href: '/admin/modulos' }}
        />
      ) : (
        <ol className="capitulos">
          {formacao.capitulos.map((capitulo, indice) => (
            <li key={capitulo.id} className="capitulo" data-status={capitulo.status}>
              <div className="capitulo__ordem mono" aria-hidden="true">
                {String(indice + 1).padStart(2, '0')}
              </div>

              <div className="capitulo__corpo">
                <div className="capitulo__topo">
                  <h2 className="capitulo__nome">{capitulo.nome}</h2>
                  <span className="etiqueta" data-tone={capitulo.status === 'published' ? 'ok' : 'rascunho'}>
                    {rotuloStatus(capitulo.status)}
                  </span>
                </div>

                <p className="capitulo__numeros">
                  {capitulo.aulas.total === 0 ? (
                    <span className="capitulo__vazio">Nenhuma aula cadastrada</span>
                  ) : (
                    <>
                      <strong>
                        {capitulo.aulas.total} {capitulo.aulas.total === 1 ? 'aula' : 'aulas'}
                      </strong>
                      {capitulo.aulas.publicadas > 0 ? (
                        <span> · {capitulo.aulas.publicadas} publicadas</span>
                      ) : null}
                      {capitulo.aulas.rascunhos > 0 ? (
                        <span> · {capitulo.aulas.rascunhos} rascunhos</span>
                      ) : null}
                      {capitulo.aulas.agendadas > 0 ? (
                        <span> · {capitulo.aulas.agendadas} agendadas</span>
                      ) : null}
                      {capitulo.aulas.total > capitulo.aulas.comVideo ? (
                        <span className="capitulo__alerta">
                          {' '}
                          · {capitulo.aulas.total - capitulo.aulas.comVideo} sem vídeo
                        </span>
                      ) : null}
                    </>
                  )}
                </p>

                <div className="capitulo__acoes">
                  <Link
                    className="botao botao--secundario botao--pequeno"
                    href={`/admin/formacao/capitulo/${capitulo.id}`}
                  >
                    Gerenciar aulas
                  </Link>
                  <Link
                    className="botao botao--primario botao--pequeno"
                    href={`/admin/formacao/aula/nova?capitulo=${capitulo.id}`}
                  >
                    + Adicionar aula
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    draft: 'rascunho',
    scheduled: 'agendado',
    published: 'publicado',
    archived: 'arquivado',
  }
  return mapa[status] ?? status
}
