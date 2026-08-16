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
  const [dados, setDados] = useState({ name: '', email: '', phone: '', document: '' })

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

  const valido =
    dados.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(dados.email) &&
    dados.phone.replace(/\D/g, '').length >= 10 &&
    dados.document.replace(/\D/g, '').length === 11 &&
    aceite

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)

    try {
      const resposta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerSlug, buyer: dados, couponCode: cupom || undefined, idempotencyKey }),
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
        <span className="campo__dica">É por aqui que você recebe o acesso.</span>
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

      <button className="botao botao--primario botao--bloco" disabled={!valido || enviando || disabled}>
        {enviando ? 'Abrindo pagamento…' : 'Continuar para o pagamento'}
      </button>
    </form>
  )
}
