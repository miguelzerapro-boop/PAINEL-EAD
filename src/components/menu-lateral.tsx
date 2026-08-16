'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * MENU LATERAL — apoio, não protagonista.
 *
 * A versão anterior competia com o conteúdo: 17rem, título em serifada
 * display, badges vermelhos saturados e um bloco de progresso ocupando o
 * rodapé. Esta versão:
 *
 *   · 13.5rem em vez de 17rem;
 *   · recolhe para 4.5rem no desktop, ficando só os ícones (a preferência
 *     fica no localStorage);
 *   · badge discreto — fundo neutro, sem vermelho, e só aparece quando há
 *     número;
 *   · progresso como um fio de 3px, não como bloco;
 *   · o trilho vertical continua, mas com 60% do contraste anterior: ele
 *     organiza, não decora.
 *
 * Mobile: gaveta, fecha ao navegar, no Esc e no clique fora.
 */

export type ItemDeMenu = {
  href: string
  rotulo: string
  icone: IconeNome
  contador?: number | null
}

export type GrupoDeMenu = {
  rotulo: string
  itens: ItemDeMenu[]
}

const CHAVE_RECOLHIDO = 'menu:recolhido'

export function MenuLateral({
  titulo,
  grupos,
  progresso,
  rodape,
}: {
  titulo: string
  grupos: GrupoDeMenu[]
  /** Percentual 0–100. Vira um fio fino no rodapé; omitir esconde a área. */
  progresso?: number | null
  rodape?: React.ReactNode
}) {
  const caminho = usePathname()
  const [aberto, setAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(false)

  useEffect(() => {
    setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === '1')
  }, [])

  useEffect(() => setAberto(false), [caminho])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto])

  function alternarRecolhido() {
    setRecolhido((v) => {
      const novo = !v
      localStorage.setItem(CHAVE_RECOLHIDO, novo ? '1' : '0')
      return novo
    })
  }

  function estaAtivo(href: string) {
    const raiz = href === '/aluna' || href === '/admin'
    return raiz ? caminho === href : caminho === href || caminho.startsWith(`${href}/`)
  }

  return (
    <>
      <div className="barra-mobile">
        <button
          type="button"
          className="barra-mobile__botao"
          aria-expanded={aberto}
          aria-controls="menu-lateral"
          onClick={() => setAberto((v) => !v)}
        >
          <span className="barra-mobile__traco" aria-hidden="true" />
          <span className="visually-hidden">Abrir menu</span>
        </button>
        <span className="barra-mobile__titulo">{titulo}</span>
      </div>

      {aberto ? (
        <button
          type="button"
          className="menu__cortina"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
        />
      ) : null}

      <nav
        id="menu-lateral"
        className="menu"
        data-aberto={aberto}
        data-recolhido={recolhido}
        aria-label={`Navegação — ${titulo}`}
      >
        <div className="menu__topo">
          <span className="menu__titulo">{titulo}</span>
          <button
            type="button"
            className="menu__recolher"
            onClick={alternarRecolhido}
            aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
          >
            <Chevron />
          </button>
        </div>

        <div className="menu__corpo">
          {grupos.map((grupo) => (
            <div className="menu__grupo" key={grupo.rotulo}>
              <p className="menu__rotulo">{grupo.rotulo}</p>
              <div className="menu__trilho">
                {grupo.itens.map((item) => {
                  const ativo = estaAtivo(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="menu__item"
                      data-ativo={ativo}
                      aria-current={ativo ? 'page' : undefined}
                      title={recolhido ? item.rotulo : undefined}
                    >
                      <span className="menu__icone" aria-hidden="true">
                        <Icone nome={item.icone} />
                      </span>
                      <span className="menu__texto">{item.rotulo}</span>
                      {typeof item.contador === 'number' && item.contador > 0 ? (
                        <span className="menu__badge mono">{item.contador}</span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {typeof progresso === 'number' || rodape ? (
          <div className="menu__rodape">
            {typeof progresso === 'number' ? (
              <div className="menu__progresso" title={`Progresso geral: ${Math.round(progresso)}%`}>
                <span className="menu__progresso-rotulo">Progresso</span>
                <span className="menu__progresso-trilha" aria-hidden="true">
                  <span
                    className="menu__progresso-feito"
                    style={{ width: `${Math.max(0, Math.min(100, progresso))}%` }}
                  />
                </span>
                <span className="menu__progresso-valor mono">{Math.round(progresso)}%</span>
              </div>
            ) : null}
            {rodape ? <div className="menu__extra">{rodape}</div> : null}
          </div>
        ) : null}
      </nav>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Ícones — desenhados aqui, sem biblioteca.                                   */
/* Traço de 1.5, cantos vivos: a mesma precisão do resto do sistema.           */
/* -------------------------------------------------------------------------- */

export type IconeNome =
  | 'inicio'
  | 'cursos'
  | 'atividades'
  | 'biblioteca'
  | 'comunidade'
  | 'mensagens'
  | 'certificado'
  | 'perfil'
  | 'suporte'
  | 'pendencias'
  | 'paginas'
  | 'midia'
  | 'ofertas'
  | 'pessoas'
  | 'ajustes'

function Icone({ nome }: { nome: IconeNome }) {
  const comum = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (nome) {
    case 'inicio':
      // A palheta: a forma de assinatura do produto.
      return (
        <svg {...comum}>
          <path d="M5 7.5a4 4 0 0 1 8 0V14H5V7.5Z" />
          <path d="M9 3.5v1" />
        </svg>
      )
    case 'cursos':
      return (
        <svg {...comum}>
          <path d="M3 4.5h5a2 2 0 0 1 2 2V15a2 2 0 0 0-2-2H3V4.5Z" />
          <path d="M15 4.5h-3a2 2 0 0 0-2 2V15" />
        </svg>
      )
    case 'atividades':
      return (
        <svg {...comum}>
          <path d="M4 3h10v12H4z" />
          <path d="M6.5 7.5h5M6.5 10.5h3" />
        </svg>
      )
    case 'biblioteca':
      return (
        <svg {...comum}>
          <path d="M3.5 3.5h3v11h-3zM7.5 3.5h3v11h-3z" />
          <path d="m11.8 4.2 2.7.7-2.4 10.1-2.1-.6" />
        </svg>
      )
    case 'comunidade':
      return (
        <svg {...comum}>
          <path d="M2.5 6.5h9v6h-4l-3 2.5v-2.5h-2z" />
          <path d="M7.5 4h8v6h-1.5v2l-2-2" />
        </svg>
      )
    case 'mensagens':
      return (
        <svg {...comum}>
          <path d="M2.5 4h13v9h-8l-3.5 2.5V13h-1.5z" />
        </svg>
      )
    case 'certificado':
      return (
        <svg {...comum}>
          <circle cx="9" cy="7" r="3.5" />
          <path d="m6.5 10.5-1 4.5L9 13.5l3.5 1.5-1-4.5" />
        </svg>
      )
    case 'perfil':
      return (
        <svg {...comum}>
          <circle cx="9" cy="6" r="2.75" />
          <path d="M3.5 15a5.5 5.5 0 0 1 11 0" />
        </svg>
      )
    case 'suporte':
      return (
        <svg {...comum}>
          <circle cx="9" cy="9" r="6.5" />
          <path d="M7 7a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1v.3M9 13h.01" />
        </svg>
      )
    case 'pendencias':
      return (
        <svg {...comum}>
          <path d="M9 3.5 15.5 15h-13z" />
          <path d="M9 8v2.5M9 12.5h.01" />
        </svg>
      )
    case 'paginas':
      return (
        <svg {...comum}>
          <path d="M4 2.5h6l4 4V15.5H4z" />
          <path d="M10 2.5v4h4" />
        </svg>
      )
    case 'midia':
      return (
        <svg {...comum}>
          <path d="M2.5 4h13v10h-13z" />
          <path d="m2.5 11 3.5-3 3 2.5 2.5-2 4 3.5" />
          <circle cx="6.5" cy="7" r="1" />
        </svg>
      )
    case 'ofertas':
      return (
        <svg {...comum}>
          <path d="M9 2.5 15.5 9 9 15.5 2.5 9z" />
          <path d="M9 6.5v5M7 8.5h4M7 11h4" />
        </svg>
      )
    case 'pessoas':
      return (
        <svg {...comum}>
          <circle cx="6.5" cy="6.5" r="2.25" />
          <path d="M2.5 14.5a4 4 0 0 1 8 0" />
          <path d="M11.5 5.2a2.25 2.25 0 0 1 0 4.3M12.5 14.5a4 4 0 0 0-1.2-2.9" />
        </svg>
      )
    case 'ajustes':
      return (
        <svg {...comum}>
          <circle cx="9" cy="9" r="2.5" />
          <path d="M9 2.5v2M9 13.5v2M2.5 9h2M13.5 9h2M4.4 4.4l1.4 1.4M12.2 12.2l1.4 1.4M13.6 4.4l-1.4 1.4M5.8 12.2l-1.4 1.4" />
        </svg>
      )
  }
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 3.5 5 7l3.5 3.5" />
    </svg>
  )
}
