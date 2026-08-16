import Link from 'next/link'
import type { Metadata } from 'next'

import { CabecalhoAdmin } from '@/components/admin/cabecalho'
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
      <CabecalhoAdmin
        titulo={formacao.nome}
        descricao="Gerencie os capítulos e as aulas da sua formação."
        selo={
          <span className="etiqueta" data-tone={formacao.status === 'published' ? 'ok' : 'rascunho'}>
            {rotuloStatus(formacao.status)}
          </span>
        }
        acao={
          <Link className="botao botao--primario" href="/admin/formacao/aula/nova">
            + Nova aula
          </Link>
        }
      />

      {/*
        O resumo em números, numa linha só. Antes era um parágrafo do tamanho
        do título dizendo a mesma coisa.
      */}
      <p className="resumo-linha">
        <strong>{formacao.capitulos.length}</strong>{' '}
        {formacao.capitulos.length === 1 ? 'capítulo' : 'capítulos'}
        <span className="resumo-linha__sep" aria-hidden="true" />
        {totalAulas === 0 ? (
          <span className="resumo-linha__fraco">nenhuma aula cadastrada ainda</span>
        ) : (
          <>
            <strong>{totalAulas}</strong> {totalAulas === 1 ? 'aula' : 'aulas'}
            <span className="resumo-linha__sep" aria-hidden="true" />
            <strong>{totalPublicadas}</strong> no ar
          </>
        )}
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

              </div>

              {/*
                UMA ação por capítulo, não duas.
                Antes eram "Gerenciar aulas" e "+ Adicionar aula" em cada
                linha: com oito capítulos, dezesseis botões disputando a tela e
                nenhum sendo o principal. Adicionar aula já está no cabeçalho;
                aqui a ação é abrir.
              */}
              <Link className="capitulo__abrir" href={`/admin/formacao/capitulo/${capitulo.id}`}>
                Abrir capítulo
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8h9" />
                  <path d="m8 4 4 4-4 4" />
                </svg>
              </Link>
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
