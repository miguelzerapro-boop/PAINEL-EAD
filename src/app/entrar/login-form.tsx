'use client'

import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

export function LoginForm({ proximo }: { proximo: string }) {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setEstado('enviando')
    setErro(null)

    const { error } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
      },
    })

    if (error) {
      setErro('Não conseguimos enviar o link agora. Tente de novo em alguns instantes.')
      setEstado('idle')
      return
    }
    setEstado('enviado')
  }

  if (estado === 'enviado') {
    return (
      <div className="aviso" data-tone="success">
        <p className="aviso__titulo">Link enviado</p>
        <p>
          Enviamos um link de acesso para <strong>{email}</strong>. Abra o e-mail neste mesmo
          aparelho para entrar. O link vale por 1 hora.
        </p>
      </div>
    )
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
        <span className="campo__dica">Use o mesmo e-mail da sua inscrição.</span>
      </label>

      {erro ? (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      ) : null}

      <button
        className="botao botao--primario botao--bloco"
        disabled={estado === 'enviando' || !/\S+@\S+\.\S+/.test(email)}
      >
        {estado === 'enviando' ? 'Enviando…' : 'Receber link de acesso'}
      </button>
    </form>
  )
}
