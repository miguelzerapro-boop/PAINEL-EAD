import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { QuizForm, type QuizPergunta } from '@/app/diagnostico/quiz-form'
import { EstadoVazio } from '@/components/estados'
import { Foto } from '@/components/foto-pendente'
import { MenuLateral, type GrupoDeMenu } from '@/components/menu-lateral'
import { Palheta, Trilho } from '@/components/palheta'

export const metadata: Metadata = {
  title: 'Amostra de tela',
  robots: { index: false, follow: false },
}

/**
 * HARNESS DE REVISÃO VISUAL — não é parte do site.
 *
 * Renderiza as composições internas com dados de AMOSTRA, para a crítica
 * visual acontecer sem depender de um banco populado. Rota `noindex`, faixa de
 * aviso permanente, todo texto reconhecível como amostra.
 */

const TELAS = [
  'quiz',
  'resultado',
  'aluna',
  'curso',
  'aula',
  'biblioteca',
  'comunidade',
  'mensagens',
  'atividades',
  'certificados',
  'perfil',
  'admin',
  'formacao',
  'nova-aula',
  'upload',
  'vendas',
] as const
type Tela = (typeof TELAS)[number]

/** Telas do painel: usam a casca do admin, não a da aluna. */
const DO_PAINEL: Tela[] = ['admin', 'formacao', 'nova-aula', 'upload']

const COM_MENU: Tela[] = [
  'aluna',
  'curso',
  'aula',
  'biblioteca',
  'comunidade',
  'mensagens',
  'atividades',
  'certificados',
  'perfil',
]

export function generateStaticParams() {
  return TELAS.map((tela) => ({ tela }))
}

export default async function TelaDeAmostra({ params }: { params: Promise<{ tela: string }> }) {
  const { tela } = await params
  if (!TELAS.includes(tela as Tela)) notFound()
  const atual = tela as Tela

  const conteudo = (
    <>
      {atual === 'quiz' ? <AmostraQuiz /> : null}
      {atual === 'resultado' ? <AmostraResultado /> : null}
      {atual === 'aluna' ? <AmostraAluna /> : null}
      {atual === 'curso' ? <AmostraCurso /> : null}
      {atual === 'aula' ? <AmostraAula /> : null}
      {atual === 'biblioteca' ? <AmostraBiblioteca /> : null}
      {atual === 'comunidade' ? <AmostraComunidade /> : null}
      {atual === 'mensagens' ? <AmostraMensagens /> : null}
      {atual === 'atividades' ? <AmostraAtividades /> : null}
      {atual === 'certificados' ? <AmostraCertificados /> : null}
      {atual === 'perfil' ? <AmostraPerfil /> : null}
      {atual === 'admin' ? <AmostraAdmin /> : null}
      {atual === 'formacao' ? <AmostraFormacao /> : null}
      {atual === 'nova-aula' ? <AmostraNovaAula /> : null}
      {atual === 'upload' ? <AmostraUpload /> : null}
      {atual === 'vendas' ? <AmostraVendas /> : null}
    </>
  )

  if (COM_MENU.includes(atual)) {
    return (
      <>
        <Faixa tela={atual} />
        <div className="app-shell">
          <MenuLateral titulo="Amostra" grupos={menuAluna(atual)} progresso={54} />
          <div className="app-shell__conteudo">{conteudo}</div>
        </div>
      </>
    )
  }

  if (DO_PAINEL.includes(atual)) {
    return (
      <>
        <Faixa tela={atual} />
        <div className="app-shell">
          <MenuLateral titulo="Painel" grupos={menuAdmin()} rodape={<Link href="/">Ver o site →</Link>} />
          <div className="app-shell__conteudo">{conteudo}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <Faixa tela={atual} />
      {conteudo}
    </>
  )
}

function Faixa({ tela }: { tela: string }) {
  return (
    <div
      className="mostruario-faixa"
      style={{
        background: 'var(--warning-soft)',
        borderBlockEnd: '1px solid var(--warning)',
        padding: 'var(--space-2) var(--space-4)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--size-mono)',
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <strong>AMOSTRA — {tela}</strong>
      <span>dados fictícios, só para revisão de layout</span>
      <Link href="/estilo">← design system</Link>
    </div>
  )
}

function menuAluna(atual: string): GrupoDeMenu[] {
  const l = (t: string) => `/estilo/telas/${t}`
  return [
    {
      rotulo: 'Estudar',
      itens: [
        { href: l('aluna'), rotulo: 'Início', icone: 'inicio' },
        { href: l('curso'), rotulo: 'Meus cursos', icone: 'cursos' },
        { href: l('atividades'), rotulo: 'Atividades', icone: 'atividades', contador: 1 },
        { href: l('biblioteca'), rotulo: 'Biblioteca', icone: 'biblioteca' },
      ],
    },
    {
      rotulo: 'Conversar',
      itens: [
        { href: l('comunidade'), rotulo: 'Comunidade', icone: 'comunidade' },
        { href: l('mensagens'), rotulo: 'Mensagens', icone: 'mensagens', contador: 2 },
      ],
    },
    {
      rotulo: 'Conta',
      itens: [
        { href: l('certificados'), rotulo: 'Certificados', icone: 'certificado' },
        { href: l('perfil'), rotulo: 'Meu perfil', icone: 'perfil' },
      ],
    },
  ]
  void atual
}

function menuAdmin(): GrupoDeMenu[] {
  return [
    {
      rotulo: 'Conteúdo',
      itens: [
        { href: '/estilo/telas/admin', rotulo: 'Pendências', icone: 'pendencias', contador: 9 },
        { href: '/estilo/telas/formacao', rotulo: 'Formação', icone: 'atividades' },
        { href: '/estilo#cursos', rotulo: 'Cursos', icone: 'cursos' },
        { href: '/estilo#biblioteca', rotulo: 'Biblioteca', icone: 'biblioteca' },
        { href: '/estilo#instrutoras', rotulo: 'Instrutoras', icone: 'pessoas' },
        { href: '/estilo#midia', rotulo: 'Fotos e mídia', icone: 'midia' },
      ],
    },
    {
      rotulo: 'Site',
      itens: [
        { href: '/estilo#paginas', rotulo: 'Páginas', icone: 'paginas' },
        { href: '/estilo#faq', rotulo: 'Perguntas frequentes', icone: 'suporte' },
      ],
    },
    {
      rotulo: 'Pessoas',
      itens: [
        { href: '/estilo#comunidade', rotulo: 'Comunidade', icone: 'comunidade', contador: 2 },
        { href: '/estilo#mensagens', rotulo: 'Mensagens', icone: 'mensagens', contador: 3 },
        { href: '/estilo#alunas', rotulo: 'Alunas', icone: 'pessoas' },
      ],
    },
    {
      rotulo: 'Sistema',
      itens: [
        { href: '/estilo#ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
        { href: '/estilo#lgpd', rotulo: 'LGPD', icone: 'certificado' },
      ],
    },
  ]
}

/* ========================================================================== */
/* Área da aluna                                                              */
/* ========================================================================== */

function AmostraAluna() {
  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Sua área</p>
          <h1 className="titulo-pagina">Olá, Amostra</h1>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="continuar">
          <div>
            <p className="continuar__rotulo">Continuar estudando</p>
            <p className="continuar__curso">Curso de amostra — não é conteúdo real</p>
            <p className="continuar__aula">Terceira aula de amostra</p>
            <div className="continuar__progresso">
              <span className="continuar__trilha" aria-hidden="true">
                <span className="continuar__feito" style={{ width: '62%' }} />
              </span>
              <span className="continuar__valor">62%</span>
            </div>
          </div>
          <Link className="botao botao--primario" href="/estilo/telas/curso">
            Retomar
          </Link>
        </section>

        <section className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>1 atividade esperando por você</strong>
            <span className="lista__meta">Atividade de amostra · ajuste solicitado</span>
          </div>
          <Link className="botao botao--secundario" href="/estilo/telas/atividades">
            Ver atividades
          </Link>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Meus cursos</h2>
          <div className="lista">
            {[
              ['Segundo curso de amostra', '38% concluído', 'current'],
              ['Terceiro curso de amostra', 'não iniciado', 'available'],
              ['Curso concluído de amostra', 'concluído', 'done'],
            ].map(([nome, meta, estado]) => (
              <Link key={nome} className="lista__item" href="/estilo/telas/curso" data-state={estado}>
                <span className="lista__marca" aria-hidden="true" />
                <span className="lista__texto">
                  <span className="lista__titulo">{nome}</span>
                  <span className="lista__meta">{meta}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Avisos</h2>
          <div className="lista">
            <div className="lista__item">
              <span className="lista__texto">
                <span className="lista__titulo">Aviso de amostra</span>
                <span className="lista__meta">Texto de amostra do aviso da instrutora.</span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraCurso() {
  return (
    <main className="area">
      <p className="aula-foco__migalha">
        <Link href="/estilo/telas/aluna">Meus cursos</Link>
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-5)', marginBlockEnd: 'var(--space-6)' }}>
        <div style={{ maxWidth: '22rem' }}>
          <Foto
            slot={{
              key: 'curso.capa',
              name: 'Capa do curso',
              recommendedWidth: 1600,
              recommendedHeight: 900,
              aspectRatio: '16:9',
            }}
          />
        </div>
        <div>
          <h1 className="titulo-pagina">Curso de amostra</h1>
          <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
            Instrutora de amostra · 12 horas · 9 aulas
          </p>
          <p className="lead" style={{ marginBlockStart: 'var(--space-3)', maxWidth: 'var(--measure-study)' }}>
            Descrição curta de amostra, para conferir a hierarquia e a largura de leitura.
          </p>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="continuar">
          <div>
            <p className="continuar__rotulo">Continuar de onde parou</p>
            <p className="continuar__curso">Terceira aula de amostra</p>
            <div className="continuar__progresso">
              <span className="continuar__trilha" aria-hidden="true">
                <span className="continuar__feito" style={{ width: '38%' }} />
              </span>
              <span className="continuar__valor">3 de 9</span>
            </div>
          </div>
          <Link className="botao botao--primario" href="/estilo/telas/aula">
            Continuar
          </Link>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Conteúdo</h2>

          <details className="aula-indice" open>
            <summary>
              <span>
                <span className="mono" style={{ marginInlineEnd: 'var(--space-3)' }}>01</span>
                Primeiro módulo de amostra
              </span>
              <span className="lista__meta mono">2/4</span>
            </summary>
            <div className="aula-indice__modulo">
              <div className="lista" style={{ border: 0, background: 'none' }}>
                {[
                  ['Primeira aula de amostra', '04:12', 'done'],
                  ['Segunda aula de amostra', '07:40', 'done'],
                  ['Terceira aula de amostra', '05:03', 'current'],
                  ['Quarta aula de amostra', '09:21', 'available'],
                ].map(([t, d, e]) => (
                  <Link key={t} className="lista__item" href="/estilo/telas/aula" data-state={e}>
                    <span className="lista__marca" aria-hidden="true" />
                    <span className="lista__texto">
                      <span className="lista__titulo">{t}</span>
                    </span>
                    <span className="lista__fim mono">{d}</span>
                  </Link>
                ))}
              </div>
            </div>
          </details>

          <details className="aula-indice">
            <summary>
              <span>
                <span className="mono" style={{ marginInlineEnd: 'var(--space-3)' }}>02</span>
                Segundo módulo de amostra
              </span>
              <span className="lista__meta mono">0/5</span>
            </summary>
            <div className="aula-indice__modulo">
              <p className="lista__meta" style={{ paddingBlockEnd: 'var(--space-3)' }}>
                Este módulo abre 7 dias após a sua matrícula.
              </p>
              <div className="lista" style={{ border: 0, background: 'none' }}>
                <div className="lista__item" data-state="locked">
                  <span className="lista__marca" aria-hidden="true" />
                  <span className="lista__texto">
                    <span className="lista__titulo">Aula bloqueada de amostra</span>
                    <span className="lista__meta">Esta aula abre 7 dias após a sua matrícula.</span>
                  </span>
                </div>
              </div>
            </div>
          </details>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Materiais incluídos</h2>
          <div className="lista">
            <Link className="lista__item" href="/estilo/telas/biblioteca">
              <span className="lista__texto">
                <span className="lista__titulo">Guia de amostra</span>
                <span className="lista__meta">guia · 24 páginas</span>
              </span>
            </Link>
          </div>
        </section>

        <div className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>Comunidade</strong>
            <span className="lista__meta">
              Tire dúvidas e veja o que as outras alunas estão fazendo.
            </span>
          </div>
          <Link className="botao botao--secundario" href="/estilo/telas/comunidade">
            Abrir comunidade
          </Link>
        </div>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraAula() {
  return (
    <main className="aula-foco">
      <p className="aula-foco__migalha">
        <Link href="/estilo/telas/curso">Curso de amostra</Link>
        <span aria-hidden="true">·</span>
        <span>Primeiro módulo de amostra</span>
      </p>

      <div className="aula-foco__player">
        <p className="foto-pendente__rotulo">Vídeo ainda não enviado</p>
      </div>

      <h1 className="aula-foco__titulo">Terceira aula de amostra</h1>
      <p className="lista__meta mono" style={{ marginBlockStart: 'var(--space-2)' }}>5 min</p>

      <p className="lead" style={{ marginBlockStart: 'var(--space-4)', maxWidth: 'none' }}>
        Descrição de amostra da aula, apenas para conferir a hierarquia tipográfica e a largura
        máxima de leitura em cada tamanho de tela.
      </p>

      <nav className="aula-nav">
        <a className="aula-nav__link" href="#">
          <span>← Anterior</span>
          <strong>Segunda aula de amostra</strong>
        </a>
        <button className="botao botao--primario">Marcar como concluída</button>
        <a className="aula-nav__link aula-nav__proxima" href="#">
          <span>Próxima →</span>
          <strong>Quarta aula de amostra</strong>
        </a>
      </nav>

      <div className="pilha" style={{ marginBlockStart: 'var(--space-6)' }}>
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Materiais da aula</h2>
          <div className="lista">
            <a className="lista__item" href="#">
              <span className="lista__texto">
                <span className="lista__titulo">Material de amostra</span>
                <span className="lista__meta">Descrição de amostra do material.</span>
              </span>
              <span className="lista__fim selo">pdf</span>
            </a>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Checklist da prática</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
            <li className="consentimento">
              <input type="checkbox" readOnly />
              <span>Primeiro item de amostra do checklist</span>
            </li>
            <li className="consentimento">
              <input type="checkbox" readOnly />
              <span>Segundo item de amostra do checklist</span>
            </li>
          </ul>
        </section>

        <div className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>Ficou com dúvida?</strong>
            <span className="lista__meta">Pergunte na comunidade e a instrutora responde.</span>
          </div>
          <Link className="botao botao--secundario" href="/estilo/telas/comunidade">
            Conversar sobre esta aula
          </Link>
        </div>

        <details className="aula-indice">
          <summary>
            Todas as aulas do curso
            <span className="lista__meta mono">3 de 9</span>
          </summary>
          <div className="aula-indice__modulo">
            <p className="titulo-apoio">Primeiro módulo de amostra</p>
            <div className="lista" style={{ border: 0, background: 'none' }}>
              {[
                ['Primeira aula de amostra', 'done'],
                ['Segunda aula de amostra', 'done'],
                ['Terceira aula de amostra', 'current'],
                ['Quarta aula de amostra', 'available'],
              ].map(([t, e]) => (
                <a key={t} className="lista__item" href="#" data-state={e}>
                  <span className="lista__marca" aria-hidden="true" />
                  <span className="lista__texto">
                    <span className="lista__titulo">{t}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </details>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraBiblioteca() {
  const materiais = [
    ['Guia de amostra para começar', 'Guia', '24 p.'],
    ['Apostila de amostra', 'Apostila', '48 p.'],
    ['Checklist de amostra', 'Checklist', '4 p.'],
    ['E-book de amostra', 'E-book', '96 p.'],
    ['Material extra de amostra', 'Extra', null],
  ]

  return (
    <main className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Materiais</p>
          <h1 className="titulo-pagina">Biblioteca</h1>
          <p className="lead">E-books, apostilas, guias e checklists dos seus cursos.</p>
        </div>
        <div className="busca">
          <input type="search" placeholder="Buscar na biblioteca" aria-label="Buscar" />
        </div>
      </div>

      <div className="pilha">
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Continuar lendo</h2>
          <div className="lista">
            <a className="lista__item" href="#">
              <span className="lista__marca" aria-hidden="true" />
              <span className="lista__texto">
                <span className="lista__titulo">Guia de amostra para começar</span>
                <span className="lista__meta">página 12</span>
              </span>
            </a>
          </div>
        </section>

        <div className="pilha pilha--junta">
          <div className="chips">
            {['Tudo', 'E-books', 'Apostilas', 'Guias', 'Checklists', 'Livros'].map((t, i) => (
              <span key={t} className="chip" data-ativo={i === 0}>
                {t}
              </span>
            ))}
          </div>
          <div className="chips">
            {['Começando', 'Técnica', 'Atendimento', 'Negócio'].map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="grade grade--estreita">
          {materiais.map(([titulo, tipo, paginas], i) => (
            <a key={titulo} className="material" href="#" data-bloqueado={i === 4}>
              <span className="material__capa">
                <span className="foto-pendente__rotulo">{tipo}</span>
                {i === 4 ? <span className="material__tranca">bloqueado</span> : null}
              </span>
              <span className="material__corpo">
                <span className="titulo-apoio">
                  {tipo}
                  {paginas ? ` · ${paginas}` : ''}
                </span>
                <span className="material__titulo">{titulo}</span>
                <span className="lista__meta">Curso de amostra</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraComunidade() {
  const posts = [
    {
      nome: 'Amostra A',
      quando: 'há 2 h',
      canal: 'Dúvidas',
      texto:
        'Texto de amostra de uma publicação. Serve para conferir a largura de leitura, o espaçamento entre linhas e como o bloco se comporta quando o conteúdo é mais longo do que uma única frase.',
      reacoes: 7,
      comentarios: 3,
      fixada: false,
    },
    {
      nome: 'Instrutora',
      quando: 'ontem',
      canal: 'Avisos da instrutora',
      texto: 'Aviso de amostra fixado no topo do canal.',
      reacoes: 12,
      comentarios: 0,
      fixada: true,
    },
    {
      nome: 'Amostra B',
      quando: 'há 3 d',
      canal: 'Trabalhos das alunas',
      texto: 'Publicação curta de amostra.',
      reacoes: 2,
      comentarios: 1,
      fixada: false,
    },
  ]

  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Entre alunas</p>
          <h1 className="titulo-pagina">Comunidade</h1>
        </div>
        <div className="busca">
          <input type="search" placeholder="Buscar publicações" aria-label="Buscar" />
        </div>
      </div>

      <div className="pilha">
        <div className="chips">
          {['Tudo', 'Geral', 'Dúvidas', 'Trabalhos', 'Materiais', 'Inspirações', 'Avisos'].map(
            (c, i) => (
              <span key={c} className="chip" data-ativo={i === 0}>
                {c}
              </span>
            ),
          )}
        </div>

        <div className="cartao">
          <span className="lista__meta">Escrever para a comunidade…</span>
        </div>

        <div className="feed">
          {posts.map((p) => (
            <article className="post" key={p.nome + p.quando} data-fixada={p.fixada}>
              <header className="post__topo">
                <span className="avatar" aria-hidden="true">
                  {p.nome.slice(0, 1)}
                </span>
                <span className="post__autora">
                  <span className="post__nome">{p.nome}</span>
                  <span className="post__quando">
                    {p.quando} · {p.canal}
                  </span>
                </span>
                {p.fixada ? (
                  <span className="selo" data-tom="acao">
                    fixada
                  </span>
                ) : null}
              </header>
              <p className="post__corpo">{p.texto}</p>
              <footer className="post__acoes">
                <span className="post__acao">♡ {p.reacoes}</span>
                <span className="post__acao">Comentários {p.comentarios || ''}</span>
                <span className="post__acao">Denunciar</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraMensagens() {
  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Atendimento</p>
          <h1 className="titulo-pagina">Conversa de amostra</h1>
          <p className="lista__meta">Curso de amostra</p>
        </div>
      </div>

      <div className="pilha">
        <div className="mensagens">
          <div className="mensagem">
            <span className="post__nome">Suporte</span>
            <span>Mensagem de amostra da equipe, do lado esquerdo.</span>
            <span className="mensagem__quando">12/03 14:20</span>
          </div>
          <div className="mensagem" data-minha="true">
            <span className="post__nome">Você</span>
            <span>Resposta de amostra da aluna, alinhada à direita e em tinta suave.</span>
            <span className="mensagem__quando">12/03 14:32</span>
          </div>
          <div className="mensagem">
            <span className="post__nome">Instrutora</span>
            <span>Outra mensagem de amostra, um pouco mais longa, para conferir a quebra de linha dentro do balão.</span>
            <span className="mensagem__quando">12/03 15:01</span>
          </div>
        </div>

        <div className="cartao">
          <label className="campo">
            <span className="visually-hidden">Sua mensagem</span>
            <textarea className="entrada" rows={3} placeholder="Escrever uma mensagem" readOnly />
          </label>
          <button className="botao botao--primario" style={{ marginBlockStart: 'var(--space-4)' }}>
            Enviar
          </button>
        </div>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraAtividades() {
  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Prática</p>
          <h1 className="titulo-pagina">Atividades</h1>
          <p className="lead">O que você enviou, o que a instrutora devolveu e o que falta.</p>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="proximo-passo">
          <div className="proximo-passo__texto">
            <strong>1 atividade esperando por você</strong>
            <span className="lista__meta">Role até ela abaixo — está marcada em destaque.</span>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h2 className="titulo-secao" style={{ flex: '1 1 16rem' }}>
              Atividade de amostra
            </h2>
            <span className="selo" data-tom="atencao">
              ajuste solicitado
            </span>
          </div>

          <p className="lista__meta">Curso de amostra · Terceira aula de amostra · 2ª tentativa</p>

          <div className="linha-tempo">
            <div className="etapa" data-feito="true">
              <p className="etapa__rotulo">Atividade disponibilizada</p>
              <p className="lista__meta">Instrução de amostra para a prática.</p>
            </div>
            <div className="etapa" data-feito="true">
              <p className="etapa__rotulo">Você enviou</p>
              <p className="etapa__quando">12/03/2026</p>
              <div className="etapa__conteudo">
                <p>Texto de amostra enviado pela aluna junto com as fotos.</p>
              </div>
            </div>
            <div className="etapa" data-feito="true">
              <p className="etapa__rotulo">Instrutora corrigiu</p>
              <p className="etapa__quando">14/03/2026</p>
            </div>
            <div className="etapa" data-feito="true">
              <p className="etapa__rotulo">Devolutiva</p>
              <div className="etapa__conteudo">
                <p>
                  Devolutiva de amostra da instrutora. Este bloco tem destaque próprio de propósito
                  — antes o retorno ficava perdido dentro do card.
                </p>
                <p className="lista__meta mono" style={{ marginBlockStart: 'var(--space-3)' }}>
                  Nota 8,5
                </p>
              </div>
            </div>
            <div className="etapa" data-atual="true">
              <p className="etapa__rotulo">Reenvio</p>
              <div className="etapa__conteudo">
                <p>A instrutora pediu um ajuste. Você pode enviar de novo.</p>
                <button className="botao botao--primario" style={{ marginBlockStart: 'var(--space-4)' }}>
                  Reenviar prática
                </button>
              </div>
            </div>
            <div className="etapa">
              <p className="etapa__rotulo">Concluída</p>
              <p className="lista__meta">Ainda não.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraCertificados() {
  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Conquistas</p>
          <h1 className="titulo-pagina">Certificados</h1>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Conquistados</h2>
          <div className="lista">
            <div className="lista__item" data-state="done">
              <span className="lista__marca" aria-hidden="true" />
              <span className="lista__texto">
                <span className="lista__titulo">Curso concluído de amostra</span>
                <span className="lista__meta">
                  emitido em 02/02/2026 · 12 horas · código AMOSTRA123
                </span>
              </span>
              <span className="lista__fim">
                <span className="botao botao--secundario">Ver</span>
              </span>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Em andamento</h2>
          <div className="lista">
            <div className="lista__item" data-state="current">
              <span className="lista__marca" aria-hidden="true" />
              <span className="lista__texto">
                <span className="lista__titulo">Curso de amostra</span>
                <span className="lista__meta">
                  faltam 38% para emitir · você está em 62%
                </span>
              </span>
              <span className="lista__fim mono">62%</span>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Como o certificado aparece ao abrir</h2>
          <div className="certificado">
            <p className="titulo-apoio">Certificado de conclusão</p>
            <h3 className="certificado__curso">Curso concluído de amostra</h3>
            <p className="certificado__nome">Nome da Aluna de Amostra</p>
            <dl className="certificado__dados">
              <div>
                <dt>Emitido em</dt>
                <dd className="mono">02 de fevereiro de 2026</dd>
              </div>
              <div>
                <dt>Carga horária</dt>
                <dd className="mono">12 horas</dd>
              </div>
              <div>
                <dt>Código de validação</dt>
                <dd className="mono">AMOSTRA123</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ========================================================================== */

function AmostraPerfil() {
  return (
    <main className="area">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Conta</p>
          <h1 className="titulo-pagina">Meu perfil</h1>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section
          className="cartao"
          style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span className="avatar avatar--grande" aria-hidden="true">A</span>
          <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
            <p style={{ fontSize: 'var(--size-h3)', fontWeight: 600 }}>Amostra</p>
            <p className="lista__meta">Campinas · SP · na plataforma desde 02/2026</p>
          </div>
          <div className="resumo" style={{ padding: 0 }}>
            <div className="resumo__item">
              <span className="resumo__valor">3</span>
              <span className="resumo__rotulo">cursos</span>
            </div>
            <div className="resumo__item">
              <span className="resumo__valor">1</span>
              <span className="resumo__rotulo">certificados</span>
            </div>
            <div className="resumo__item">
              <span className="resumo__valor">7</span>
              <span className="resumo__rotulo">publicações</span>
            </div>
          </div>
        </section>

        <section className="cartao">
          <p className="titulo-apoio">Seus dados</p>
          <div className="pilha pilha--junta" style={{ marginBlockStart: 'var(--space-4)' }}>
            <label className="campo">
              <span className="campo__rotulo">Nome de exibição</span>
              <input className="entrada" defaultValue="Amostra" readOnly />
              <span className="campo__dica">É este nome que outras alunas veem na comunidade.</span>
            </label>
            <label className="campo">
              <span className="campo__rotulo">E-mail</span>
              <input className="entrada" defaultValue="amostra@exemplo.com" disabled />
            </label>
            <div>
              <button className="botao botao--primario">Salvar alterações</button>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Privacidade</h2>
          <div className="cartao">
            <p style={{ fontWeight: 600 }}>O que outras alunas veem</p>
            <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
              Apenas o seu nome de exibição e o que você publicar na comunidade.
            </p>
            <p style={{ fontWeight: 600, marginBlockStart: 'var(--space-5)' }}>
              O que fica só com você e a equipe
            </p>
            <p className="lista__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
              E-mail, telefone, cidade, progresso, atividades, pedidos e certificados.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ========================================================================== */

/* ==========================================================================
   FORMAÇÃO — os oito capítulos

   Os NOMES aqui são os reais, aprovados: é justamente a lista que precisa ser
   conferida. Os NÚMEROS são de amostra e estão marcados como tal — na tela de
   verdade eles são contados do banco, e capítulo sem aula mostra zero.
   ========================================================================== */

const CAPITULOS_AMOSTRA: Array<{
  nome: string
  status: 'draft' | 'published'
  total: number
  publicadas: number
  rascunhos: number
  semVideo: number
}> = [
  { nome: 'Manicure e Pedicure Iniciante', status: 'published', total: 8, publicadas: 6, rascunhos: 2, semVideo: 2 },
  { nome: 'Curso de Aperfeiçoamento Manicure', status: 'published', total: 4, publicadas: 4, rascunhos: 0, semVideo: 0 },
  { nome: 'Cutícula Fundinha', status: 'draft', total: 2, publicadas: 0, rascunhos: 2, semVideo: 1 },
  { nome: 'Acabamento Impecável', status: 'draft', total: 0, publicadas: 0, rascunhos: 0, semVideo: 0 },
  { nome: 'Curso de Esmaltação em Gel', status: 'draft', total: 0, publicadas: 0, rascunhos: 0, semVideo: 0 },
  { nome: 'Curso de Blindagem', status: 'draft', total: 0, publicadas: 0, rascunhos: 0, semVideo: 0 },
  { nome: 'Curso de Banho de Gel', status: 'draft', total: 0, publicadas: 0, rascunhos: 0, semVideo: 0 },
  { nome: 'Curso de Unhas de Fibra', status: 'draft', total: 0, publicadas: 0, rascunhos: 0, semVideo: 0 },
]

function AmostraFormacao() {
  return (
    <div className="area area--larga">
      <div className="admin__cabecalho">
        <div>
          <p className="eyebrow">Conteúdo</p>
          <h1 className="admin__titulo" style={{ marginBlockEnd: 0 }}>Formação</h1>
        </div>
        <span className="etiqueta" data-tone="rascunho">rascunho</span>
      </div>

      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-5)' }}>
        8 capítulos · 14 aulas, 10 publicadas{' '}
        <span className="mono" style={{ color: 'var(--warning)' }}>(números de amostra)</span>
      </p>

      <div className="aviso" data-tone="warning" style={{ marginBlockEnd: 'var(--space-6)' }}>
        <p className="aviso__titulo">A formação ainda não está no ar</p>
        <div>
          Os capítulos e as aulas podem ser preparados agora, mas nada aparece para as alunas
          enquanto a formação estiver em rascunho. Para publicar, é preciso escrever a{' '}
          <strong>descrição curta</strong> do curso — o banco recusa publicar sem ela, justamente
          para que o site nunca exiba um texto inventado.
        </div>
      </div>

      <ol className="capitulos">
        {CAPITULOS_AMOSTRA.map((c, i) => (
          <li key={c.nome} className="capitulo" data-status={c.status}>
            <div className="capitulo__ordem mono" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="capitulo__corpo">
              <div className="capitulo__topo">
                <h2 className="capitulo__nome">{c.nome}</h2>
                <span className="etiqueta" data-tone={c.status === 'published' ? 'ok' : 'rascunho'}>
                  {c.status === 'published' ? 'publicado' : 'rascunho'}
                </span>
              </div>

              <p className="capitulo__numeros">
                {c.total === 0 ? (
                  <span className="capitulo__vazio">Nenhuma aula cadastrada</span>
                ) : (
                  <>
                    <strong>{c.total} {c.total === 1 ? 'aula' : 'aulas'}</strong>
                    {c.publicadas > 0 ? <span> · {c.publicadas} publicadas</span> : null}
                    {c.rascunhos > 0 ? <span> · {c.rascunhos} rascunhos</span> : null}
                    {c.semVideo > 0 ? (
                      <span className="capitulo__alerta"> · {c.semVideo} sem vídeo</span>
                    ) : null}
                  </>
                )}
              </p>

              <div className="capitulo__acoes">
                <span className="botao botao--secundario botao--pequeno">Gerenciar aulas</span>
                <Link className="botao botao--primario botao--pequeno" href="/estilo/telas/nova-aula">
                  + Adicionar aula
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ==========================================================================
   NOVA AULA — o formulário
   ========================================================================== */

function AmostraNovaAula() {
  return (
    <div className="area">
      <p className="admin__migalha">Formação · Capítulo</p>
      <h1 className="admin__titulo">Adicionar aula</h1>

      <div className="form-aula">
        <div className="form-aula__estado">
          <span className="etiqueta" data-tone="rascunho">rascunho</span>
          <span className="etiqueta" data-tone="rascunho">sem vídeo</span>
        </div>

        <label className="campo">
          <span className="campo__rotulo">Capítulo</span>
          <select className="entrada" defaultValue="1">
            {CAPITULOS_AMOSTRA.map((c, i) => (
              <option key={c.nome} value={String(i + 1)}>
                {String(i + 1).padStart(2, '0')} — {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span className="campo__rotulo">Título da aula</span>
          <input className="entrada" defaultValue="" placeholder="" />
          <span className="campo__dica">O nome que a aluna vê na lista do capítulo.</span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">
            Descrição <span className="campo__dica">(opcional)</span>
          </span>
          <textarea className="entrada" rows={4} defaultValue="" />
        </label>

        <div className="campo">
          <span className="campo__rotulo">Vídeo da aula</span>
          <div className="envio">
            <div className="envio__area">
              <span className="envio__icone" aria-hidden="true">
                <IconeSubirAmostra />
              </span>
              <span className="envio__chamada">Arraste o vídeo aqui</span>
              <span className="envio__ou">ou toque para escolher do seu aparelho</span>
              <span className="envio__formatos mono">MP4, MOV ou WebM · até 5 GB</span>
            </div>
          </div>
        </div>

        <div className="form-aula__linha">
          <label className="campo">
            <span className="campo__rotulo">Ordem no capítulo</span>
            <input className="entrada" type="number" defaultValue={9} />
            <span className="campo__dica">Menor número aparece primeiro.</span>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Liberação</span>
            <select className="entrada" defaultValue="immediate">
              <option value="immediate">Imediata</option>
              <option value="after_previous_lesson">Após concluir a aula anterior</option>
              <option value="on_date">Em uma data</option>
            </select>
          </label>
        </div>

        <label className="consentimento">
          <input type="checkbox" />
          <span>
            Aula gratuita (degustação) — visível para quem ainda não comprou, desde que a formação
            esteja publicada.
          </span>
        </label>

        <div className="form-aula__acoes">
          <span className="botao botao--secundario">Salvar rascunho</span>
          <span className="botao botao--primario" aria-disabled="true" style={{ opacity: 0.5 }}>
            Publicar aula
          </span>
        </div>

        <p className="form-aula__nota">
          Enviar o vídeo não publica a aula. Enquanto estiver em rascunho, ela não aparece para
          nenhuma aluna.
        </p>
      </div>
    </div>
  )
}

/* ==========================================================================
   UPLOAD — os quatro estados de feedback, lado a lado

   Na tela real só um aparece por vez. Aqui estão juntos porque o que precisa
   ser revisado é justamente se cada um diz o suficiente: o que aconteceu, se
   o vídeo foi preservado, e o que fazer agora.
   ========================================================================== */

function AmostraUpload() {
  return (
    <div className="area">
      <p className="admin__migalha">Formação · Capítulo · Aula</p>
      <h1 className="admin__titulo">Envio de vídeo — estados</h1>
      <p className="lead" style={{ marginBlock: 'var(--space-4) var(--space-6)' }}>
        Os cinco estados que a área de envio assume. Na tela real aparece um de cada vez.
      </p>

      <div className="pilha pilha--solta">
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">1 · Enviando</h2>
          <div className="envio">
            <div className="envio__progresso">
              <div className="envio__resumo">
                <span className="envio__marca" aria-hidden="true"><IconeVideoAmostra /></span>
                <div className="envio__dados">
                  <p className="envio__nome">aula-de-amostra.mp4</p>
                  <p className="envio__meta mono">312 MB de 843 MB</p>
                </div>
                <span className="botao botao--texto">Cancelar</span>
              </div>
              <div className="envio__barra" role="progressbar" aria-valuenow={37} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
                <span className="envio__barra-feito" style={{ width: '37%' }} />
              </div>
              <p className="envio__estado">Enviando vídeo — 37%</p>
            </div>
            <p className="envio__aviso-saida">
              Não feche esta página enquanto o envio estiver em andamento.
            </p>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">2 · Conexão interrompida — o estado que o TUS resolve</h2>
          <div className="envio">
            <div className="envio__pausado">
              <p className="envio__estado">
                A conexão foi interrompida. Seu progresso foi preservado.
              </p>
              <div
                className="envio__barra"
                role="progressbar"
                aria-valuenow={82}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso do envio"
              >
                <span className="envio__barra-feito" style={{ width: '82%' }} />
              </div>
              <p className="envio__meta mono">691 MB de 843 MB enviados</p>
              <div className="envio__acoes">
                <span className="botao botao--primario botao--pequeno">Retomar upload</span>
                <span className="botao botao--texto botao--pequeno">Cancelar</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">3 · Concluído</h2>
          <div className="envio">
            <div className="envio__ok">
              <p className="envio__estado">Upload concluído.</p>
              <p className="envio__nota">
                O vídeo está guardado e ligado à aula. A aula continua em <strong>rascunho</strong> —
                nada foi publicado ainda.
              </p>
              <span className="botao botao--secundario botao--pequeno">Enviar outro vídeo</span>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">4 · Erro — arquivo recusado</h2>
          <div className="envio">
            <div className="envio__erro" role="alert">
              <p className="envio__erro-titulo">Não foi possível concluir o envio</p>
              <p className="envio__erro-texto">
                O conteúdo do arquivo não corresponde a um vídeo. Verifique se o arquivo não foi
                apenas renomeado. Nada foi publicado.
              </p>
              <p className="envio__nota">
                O vídeo que subiu está guardado no servidor. Tentar de novo não recomeça o envio do
                zero.
              </p>
              <div className="envio__acoes">
                <span className="botao botao--primario botao--pequeno">Tentar de novo</span>
                <span className="botao botao--secundario botao--pequeno">Escolher outro arquivo</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">5 · Vídeo já enviado</h2>
          <div className="envio envio--pronto">
            <div className="envio__resumo">
              <span className="envio__marca" aria-hidden="true"><IconeVideoAmostra /></span>
              <div className="envio__dados">
                <p className="envio__nome">aula-de-amostra.mp4</p>
                <p className="envio__meta mono">843 MB</p>
              </div>
              <span className="botao botao--secundario botao--pequeno">Trocar vídeo</span>
            </div>
            <p className="envio__nota">
              Este vídeo já está ligado à aula. Trocar não publica nada — a aula continua como está
              até você publicar.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function IconeSubirAmostra() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

function IconeVideoAmostra() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="13" height="13" rx="2" />
      <path d="m15.5 10.5 6-3v9l-6-3z" />
    </svg>
  )
}

function AmostraAdmin() {
  const bloqueiam = [
    [
      'Número de WhatsApp',
      'A configuração `contact.whatsapp` está vazia.',
      'Todo botão de WhatsApp some do site enquanto isso.',
    ],
    [
      'Nenhum curso publicado',
      'Não existe curso real publicado no catálogo.',
      'O catálogo e a vitrine da landing ficam ocultos.',
    ],
  ]
  const importantes = [
    [
      'Bloco "hero" incompleto',
      'Faltam os campos: lead, cta_label.',
      'A página "Landing do diagnóstico" não exibe este bloco.',
    ],
    [
      '2 denúncia(s) na comunidade',
      'Alunas sinalizaram publicações que precisam de análise.',
      'Conteúdo denunciado continua visível até alguém avaliar.',
    ],
  ]

  return (
    <div className="area area--larga">
      <div className="area__topo">
        <div>
          <p className="titulo-apoio">Painel</p>
          <h1 className="titulo-pagina">Pendências</h1>
          <p className="lead">2 itens impedem o site de ir ao ar.</p>
        </div>
        <div className="resumo" style={{ padding: 0 }}>
          <div className="resumo__item">
            <span className="resumo__valor">9</span>
            <span className="resumo__rotulo">no total</span>
          </div>
          <div className="resumo__item">
            <span className="resumo__valor">2</span>
            <span className="resumo__rotulo">bloqueiam</span>
          </div>
        </div>
      </div>

      <div className="pilha pilha--solta">
        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">
            Bloqueia a publicação
            <span className="selo" data-tom="erro">2</span>
          </h2>
          <div className="lista">
            {bloqueiam.map(([t, d, a]) => (
              <div className="lista__item" key={t}>
                <span className="lista__texto">
                  <span className="lista__titulo">{t}</span>
                  <span className="lista__meta">{d}</span>
                  <span className="lista__meta" style={{ opacity: 0.8 }}>Afeta: {a}</span>
                </span>
                <span className="lista__fim">
                  <span className="botao botao--secundario">Resolver</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">
            Importante
            <span className="selo" data-tom="atencao">2</span>
          </h2>
          <div className="lista">
            {importantes.map(([t, d, a]) => (
              <div className="lista__item" key={t}>
                <span className="lista__texto">
                  <span className="lista__titulo">{t}</span>
                  <span className="lista__meta">{d}</span>
                  <span className="lista__meta" style={{ opacity: 0.8 }}>Afeta: {a}</span>
                </span>
                <span className="lista__fim">
                  <span className="botao botao--secundario">Resolver</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="pilha pilha--junta">
          <h2 className="titulo-secao">Últimas alterações</h2>
          <div className="lista">
            {['courses · update', 'cms_sections · publish', 'offers · update'].map((t, i) => (
              <div className="lista__item" key={t}>
                <span className="lista__texto">
                  <span className="lista__titulo">{t}</span>
                </span>
                <span className="lista__fim mono">amostra · 0{i + 1}/08/2026</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ========================================================================== */
/* Telas públicas                                                             */
/* ========================================================================== */

const PERGUNTAS_AMOSTRA: QuizPergunta[] = [
  {
    id: 'a1',
    prompt: 'Qual dessas opções mais combina com o seu momento atual?',
    helpText: null,
    type: 'single',
    required: true,
    minSelections: 1,
    maxSelections: null,
    opcoes: [
      { id: 'o1', label: 'Nunca trabalhei com unhas e quero começar do zero', value: 'v1', helpText: null },
      { id: 'o2', label: 'Faço minhas unhas ou as de pessoas próximas', value: 'v2', helpText: null },
      { id: 'o3', label: 'Já trabalho como manicure tradicional', value: 'v3', helpText: null },
      { id: 'o4', label: 'Já trabalho como nail designer e quero me aperfeiçoar', value: 'v4', helpText: null },
      { id: 'o5', label: 'Já trabalhei na área e quero voltar', value: 'v5', helpText: null },
    ],
  },
  {
    id: 'a2',
    prompt: 'O que você tem mais interesse em aprender?',
    helpText: 'Pode marcar mais de uma.',
    type: 'multiple',
    required: true,
    minSelections: 1,
    maxSelections: 3,
    opcoes: [
      { id: 'p1', label: 'Fundamentos para começar', value: 'w1', helpText: null },
      { id: 'p2', label: 'Melhorar técnica e acabamento', value: 'w2', helpText: null },
      { id: 'p3', label: 'Técnicas modernas', value: 'w3', helpText: null },
      { id: 'p4', label: 'Preços e organização', value: 'w4', helpText: null },
    ],
  },
]

function AmostraQuiz() {
  return (
    <QuizForm
      quizSlug="amostra"
      perguntas={PERGUNTAS_AMOSTRA}
      consentText="Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade."
      coleta={{ email: true, cidade: true, estado: true, apenasPrimeiroNome: true }}
    />
  )
}

function AmostraResultado() {
  return (
    <main className="page" style={{ paddingBlock: 'var(--space-6) var(--space-9)' }}>
      <Trilho rotulo="Diagnóstico concluído">
        <Palheta state="done" codigo="N.01" titulo="Respondido" />
        <Palheta state="done" codigo="N.02" titulo="Analisado" />
        <Palheta state="current" codigo="N.03" titulo="Seu momento" destaque />
      </Trilho>

      <section className="section">
        <div className="editorial">
          <p className="editorial__rotulo">Amostra, seu momento é</p>
          <div>
            <h1>Já trabalho na área</h1>
            <div style={{ marginBlockStart: 'var(--space-6)', maxWidth: 'var(--measure-sales)' }}>
              <p style={{ fontSize: 'var(--size-body-lg)' }}>
                Seu diagnóstico foi concluído. Nossa equipe vai conversar com você pelo WhatsApp
                para entender melhor seu momento e apresentar as opções disponíveis.
              </p>
              <a className="botao botao--primario" href="#" style={{ marginBlockStart: 'var(--space-5)' }}>
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function AmostraVendas() {
  return (
    <main>
      <section className="heroi">
        <div className="page heroi__grade">
          <div>
            <p className="eyebrow">Curso</p>
            <h1 className="heroi__titulo" style={{ maxWidth: '16ch' }}>
              Curso de amostra
            </h1>
            <p className="heroi__apoio">
              Descrição curta de amostra, usada apenas para revisar a hierarquia do herói.
            </p>
            <a className="botao botao--primario" href="#" style={{ marginBlockStart: 'var(--space-6)' }}>
              Quero me inscrever
            </a>
          </div>
          <div>
            <Foto
              slot={{
                key: 'curso.capa',
                name: 'Capa do curso',
                recommendedWidth: 1600,
                recommendedHeight: 900,
                aspectRatio: '16:9',
              }}
            />
          </div>
        </div>
      </section>

      <section className="section faixa-escura">
        <div className="page">
          <h2>O que você vai encontrar</h2>
          <div style={{ marginBlockStart: 'var(--space-6)' }}>
            <Trilho rotulo="Módulos (amostra)">
              <Palheta codigo="M.01" titulo="Primeiro módulo de amostra" meta="4 aulas" destaque />
              <Palheta codigo="M.02" titulo="Segundo módulo de amostra" meta="5 aulas" />
              <Palheta codigo="M.03" titulo="Terceiro módulo de amostra" meta="3 aulas" />
            </Trilho>
          </div>
        </div>
      </section>

      <section className="section section--denso">
        <div className="page">
          <EstadoVazio
            titulo="Exemplo de estado vazio nesta página"
            texto="Quando não houver depoimento verificado, a seção inteira desaparece do site público."
          />
        </div>
      </section>
    </main>
  )
}
