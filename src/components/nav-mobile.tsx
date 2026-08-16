'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * Navegação de celular do site público.
 *
 * Antes desta versão o cabeçalho mobile tinha só a marca e um CTA: "Cursos" e
 * "Entrar" existiam apenas no rodapé. Era falha de navegação, não de estilo.
 *
 * É um painel curto ancorado no cabeçalho, não uma tela cheia. O foco fica
 * contido enquanto aberto e volta para o botão ao fechar.
 */

export type ItemNav = { href: string; rotulo: string; cta?: boolean }

export function NavMobile({ itens }: { itens: ItemNav[] }) {
  const [aberto, setAberto] = useState(false)
  const painelId = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  // Guarda se o fechamento veio de uma ação do usuário, para só então devolver
  // o foco. Fechar por navegação não deve roubar o foco da página nova.
  const devolverFoco = useRef(false)

  function fechar(comFoco: boolean) {
    devolverFoco.current = comFoco
    setAberto(false)
  }

  useEffect(() => {
    if (!aberto) {
      if (devolverFoco.current) {
        botaoRef.current?.focus()
        devolverFoco.current = false
      }
      return
    }

    // Trava a rolagem de fundo sem deslocar o layout: compensa a barra que some.
    const largura = window.innerWidth - document.documentElement.clientWidth
    const overflowAnterior = document.body.style.overflow
    const paddingAnterior = document.body.style.paddingInlineEnd
    document.body.style.overflow = 'hidden'
    if (largura > 0) document.body.style.paddingInlineEnd = `${largura}px`

    const primeiro = painelRef.current?.querySelector<HTMLElement>('a, button')
    primeiro?.focus()

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        fechar(true)
        return
      }
      if (e.key !== 'Tab') return

      // Contenção do foco: botão + itens do painel formam o ciclo.
      const focaveis = [
        botaoRef.current,
        ...Array.from(painelRef.current?.querySelectorAll<HTMLElement>('a, button') ?? []),
      ].filter((el): el is HTMLElement => Boolean(el))
      if (focaveis.length === 0) return

      const atual = document.activeElement as HTMLElement | null
      const i = atual ? focaveis.indexOf(atual) : -1
      const ultimo = focaveis.length - 1
      const primeiroEl = focaveis[0]
      const ultimoEl = focaveis[ultimo]
      if (!primeiroEl || !ultimoEl) return

      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        ultimoEl.focus()
      } else if (!e.shiftKey && i === ultimo) {
        e.preventDefault()
        primeiroEl.focus()
      }
    }

    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return
      fechar(false)
    }

    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicarFora)

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicarFora)
      document.body.style.overflow = overflowAnterior
      document.body.style.paddingInlineEnd = paddingAnterior
    }
  }, [aberto])

  return (
    <div className="nav-mobile">
      <button
        ref={botaoRef}
        type="button"
        className="nav-mobile__botao"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => (aberto ? fechar(true) : setAberto(true))}
      >
        <span className="nav-mobile__risos" aria-hidden="true" data-aberto={aberto}>
          <span />
          <span />
        </span>
        {aberto ? 'Fechar menu' : 'Menu'}
      </button>

      <div
        ref={painelRef}
        id={painelId}
        className="nav-mobile__painel"
        data-aberto={aberto}
        hidden={!aberto}
      >
        <ul className="nav-mobile__lista">
          {itens.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={item.cta ? 'botao botao--primario nav-mobile__cta' : 'nav-mobile__link'}
                onClick={() => fechar(false)}
              >
                {item.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
