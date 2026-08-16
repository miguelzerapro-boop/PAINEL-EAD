'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * ENTRADA POR E-MAIL E SENHA.
 *
 * Substituiu o link mágico. O motivo é prático: o link dependia de e-mail
 * chegando na hora, e o plano gratuito do Supabase limita o envio a poucas
 * mensagens por hora — quem tentava entrar duas vezes seguidas ficava sem
 * acesso, sem entender por quê. A senha é definida na própria compra, então
 * não há passo extra para a aluna.
 *
 * A senha nunca passa por aqui em texto para lugar nenhum além do Supabase,
 * que faz o hash. Não guardamos senha em tabela nossa.
 */
/** Destino de quem clicou em "Entrar" sem vir de uma tela protegida. */
const PADRAO = '/aluna'

export function LoginForm({ proximo }: { proximo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'entrando'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  const valido = /\S+@\S+\.\S+/.test(email) && senha.length >= 8

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setEstado('entrando')
    setErro(null)

    const cliente = getBrowserClient()
    const { data, error } = await cliente.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })

    if (error) {
      /*
       * A mensagem é a MESMA para e-mail inexistente e senha errada, de
       * propósito: dizer "este e-mail não tem conta" entrega para qualquer
       * um a lista de quem comprou.
       */
      setErro('E-mail ou senha incorretos. Confira e tente de novo.')
      setEstado('idle')
      return
    }

    /*
     * PARA ONDE IR.
     *
     * Se a pessoa foi mandada para cá por uma tela protegida, volta para
     * aquela tela — é o `proximo`. Se ela clicou em "Entrar" por conta
     * própria, o destino depende de quem ela é: administradora vai para o
     * painel, aluna vai para a área de estudos. Mandar a responsável do site
     * para "você ainda não tem nenhum curso" era o comportamento anterior.
     */
    let destino = proximo

    if (destino === PADRAO && data.user) {
      const { data: perfil } = await cliente
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (perfil && ['admin', 'owner'].includes(perfil.role)) destino = '/admin'
    }

    // `refresh` antes do `push` para o servidor já enxergar a sessão nova —
    // sem isso o middleware devolve para o login em uma volta.
    router.refresh()
    router.push(destino)
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <label className="campo">
        <span className="campo__rotulo">Seu e-mail</span>
        <input
          className="entrada"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={erro ? 'true' : undefined}
        />
        <span className="campo__dica">O mesmo e-mail que você usou na compra.</span>
      </label>

      <label className="campo">
        <span className="campo__rotulo">Sua senha</span>
        <span className="campo-senha">
          <input
            className="entrada"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-invalid={erro ? 'true' : undefined}
          />
          <button
            type="button"
            className="campo-senha__olho"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-pressed={mostrarSenha}
          >
            {mostrarSenha ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
        <span className="campo__dica">A que você criou ao escolher seu plano.</span>
      </label>

      {erro ? (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      ) : null}

      <button className="botao botao--cta botao--bloco" disabled={estado === 'entrando' || !valido}>
        {estado === 'entrando' ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="entrar__rodape">
        Ainda não tem acesso? <Link href="/#planos">Escolha seu plano</Link>.
      </p>
    </form>
  )
}
