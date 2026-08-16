'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export function CheckoutForm({
  offerSlug,
  disabled,
  temReembolso = false,
}: {
  offerSlug: string
  disabled: boolean
  /** Só liga o link quando a política de reembolso já foi redigida no painel. */
  temReembolso?: boolean
}) {
  const [dados, setDados] = useState({ name: '', email: '', phone: '', document: '', password: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)

  /**
   * Chave de idempotência fixa por visita à tela.
   *
   * Duplo clique, aba duplicada ou retry de rede reaproveitam o mesmo pedido
   * pendente em vez de criar outro. Vale tanto no nosso banco quanto no
   * Mercado Pago, que recebe a mesma chave.
   */
  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
    [],
  )
  const [aceite, setAceite] = useState(false)
  const [cupom, setCupom] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const senhaCurta = dados.password.length > 0 && dados.password.length < 8

  const valido =
    dados.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(dados.email) &&
    dados.phone.replace(/\D/g, '').length >= 10 &&
    dados.document.replace(/\D/g, '').length === 11 &&
    dados.password.length >= 8 &&
    aceite

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)

    try {
      const resposta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerSlug,
          buyer: dados,
          couponCode: cupom || undefined,
          idempotencyKey,
        }),
      })

      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.message ?? 'Não foi possível iniciar o pagamento.')

      window.location.href = corpo.initPoint
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar o pagamento.')
      setEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <label className="campo">
        <span className="campo__rotulo">Nome completo</span>
        <input
          className="entrada"
          autoComplete="name"
          required
          value={dados.name}
          onChange={(e) => setDados({ ...dados, name: e.target.value })}
        />
      </label>

      <label className="campo">
        <span className="campo__rotulo">E-mail</span>
        <input
          className="entrada"
          type="email"
          autoComplete="email"
          required
          value={dados.email}
          onChange={(e) => setDados({ ...dados, email: e.target.value })}
        />
        <span className="campo__dica">É com ele que você entra na área de estudos.</span>
      </label>

      <label className="campo">
        <span className="campo__rotulo">WhatsApp</span>
        <input
          className="entrada"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={dados.phone}
          onChange={(e) => setDados({ ...dados, phone: e.target.value })}
        />
      </label>

      <label className="campo">
        <span className="campo__rotulo">CPF</span>
        <input
          className="entrada"
          inputMode="numeric"
          required
          value={dados.document}
          onChange={(e) => setDados({ ...dados, document: e.target.value })}
        />
        <span className="campo__dica">Exigido pelo Mercado Pago para emitir o pagamento.</span>
      </label>

      {/*
        A SENHA É CRIADA AQUI.

        Antes o acesso vinha por link mágico no e-mail, e quem tentava entrar
        duas vezes seguidas esbarrava no limite de envio do provedor e ficava
        sem acesso sem entender por quê. Agora a aluna escolhe a senha na
        compra e entra com ela sempre — e-mail e senha, nada mais.

        A senha vai direto para o Supabase, que faz o hash. Nenhuma tabela
        nossa guarda senha.
      */}
      <label className="campo">
        <span className="campo__rotulo">Crie uma senha</span>
        <span className="campo-senha">
          <input
            className="entrada"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            required
            value={dados.password}
            onChange={(e) => setDados({ ...dados, password: e.target.value })}
            aria-invalid={senhaCurta ? 'true' : undefined}
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
        <span className={senhaCurta ? 'campo__erro' : 'campo__dica'}>
          {senhaCurta
            ? 'A senha precisa ter pelo menos 8 caracteres.'
            : 'Mínimo de 8 caracteres. É com ela que você vai entrar depois.'}
        </span>
      </label>

      <label className="campo">
        <span className="campo__rotulo">
          Cupom <span className="campo__dica">(se tiver)</span>
        </span>
        <input className="entrada" value={cupom} onChange={(e) => setCupom(e.target.value)} />
      </label>

      <label className="consentimento">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>
          Li e aceito os <Link href="/termos">termos de uso</Link> e a{' '}
          <Link href="/privacidade">política de privacidade</Link>
          {temReembolso ? (
            <>
              , e conheço a <Link href="/reembolso">política de reembolso</Link>
            </>
          ) : null}
          .
        </span>
      </label>

      {erro ? (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      ) : null}

      <button className="botao botao--cta botao--bloco" disabled={!valido || enviando || disabled}>
        {enviando ? 'Abrindo pagamento…' : 'Continuar para o pagamento'}
      </button>

      <p className="checkout__ja-tem">
        Já comprou antes? <Link href="/entrar">Entre com seu e-mail e senha</Link>.
      </p>
    </form>
  )
}
