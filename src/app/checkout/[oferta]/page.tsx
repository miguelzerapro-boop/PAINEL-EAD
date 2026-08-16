import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CheckoutForm } from './checkout-form'
import { Topo } from '@/components/site-chrome'
import { Aviso, EstadoVazio } from '@/components/estados'
import { formatInstallments, formatPrice } from '@/lib/format'
import { getPublicSettings } from '@/lib/cms/page'
import { isCheckoutConfigured } from '@/lib/mercadopago/client'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Pagamento',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ params }: { params: Promise<{ oferta: string }> }) {
  const { oferta: slug } = await params
  const db = await createClient()

  const [{ data: oferta }, settings] = await Promise.all([
    db
      .from('offers')
      .select('id, slug, name, price_cents, compare_at_cents, max_installments, access_note, guarantee_text')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle(),
    getPublicSettings(),
  ])

  if (!oferta) notFound()

  const refund = settings['legal.refund']
  const temReembolso = typeof refund === 'string' && refund.trim().length > 0

  // A constraint do banco já impede publicar oferta sem preço; esta é a
  // segunda barreira, do lado da interface.
  const preco = formatPrice(oferta.price_cents)
  if (!preco) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Esta oferta ainda não está disponível"
            texto="O valor da inscrição ainda não foi definido. Assim que estiver, esta página passa a aceitar pagamento."
            acao={{ label: 'Ver os cursos', href: '/cursos' }}
          />
        </main>
      </>
    )
  }

  const parcelas = formatInstallments(oferta.price_cents, oferta.max_installments)

  return (
    <>
      <Topo />
      <main id="conteudo" className="page checkout">
        <div>
          <p className="eyebrow">Inscrição</p>
          <h1>Seus dados</h1>

          {!isCheckoutConfigured() ? (
            <div style={{ marginBlockStart: 'var(--space-5)' }}>
              <Aviso tone="warning" titulo="Pagamento indisponível">
                As credenciais do Mercado Pago ainda não foram configuradas. O formulário fica
                bloqueado até isso ser resolvido no painel.
              </Aviso>
            </div>
          ) : null}

          <div style={{ marginBlockStart: 'var(--space-5)' }}>
            <CheckoutForm
              offerSlug={oferta.slug}
              disabled={!isCheckoutConfigured()}
              temReembolso={temReembolso}
            />
          </div>
        </div>

        <aside className="checkout__resumo">
          <p className="eyebrow">Resumo</p>
          <p style={{ fontWeight: 600, marginBlockStart: 'var(--space-3)' }}>{oferta.name}</p>
          {oferta.access_note ? <p className="palheta__meta">{oferta.access_note}</p> : null}

          <div className="checkout__total">
            <span style={{ fontFamily: 'var(--font-text)', fontSize: 'var(--size-body)' }}>Total</span>
            <span>{preco}</span>
          </div>

          {parcelas ? (
            <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-2)' }}>
              em até {parcelas.count}× de {parcelas.value}
            </p>
          ) : null}

          {oferta.guarantee_text ? (
            <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-4)' }}>
              {oferta.guarantee_text}
            </p>
          ) : null}

          <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-5)' }}>
            Pagamento processado pelo Mercado Pago. Não armazenamos dados do seu cartão.
          </p>
        </aside>
      </main>
    </>
  )
}
