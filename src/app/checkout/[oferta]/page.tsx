import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CheckoutForm } from './checkout-form'
import { Topo } from '@/components/site-chrome'
import { Aviso, EstadoVazio } from '@/components/estados'
import { VisualizacaoDeEtapa } from '@/components/analytics/rastro'
import { EVENTO } from '@/lib/analytics/eventos'
import { estadoDaVenda } from '@/lib/comercial/gate'
import { formatInstallments, formatPrice } from '@/lib/format'
import { getPublicSettings } from '@/lib/cms/page'
import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Pagamento',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ params }: { params: Promise<{ oferta: string }> }) {
  const { oferta: slug } = await params
  const db = await createClient()

  const [{ data: oferta }, settings, venda] = await Promise.all([
    db
      .from('offers')
      .select('id, slug, name, price_cents, compare_at_cents, max_installments, access_note, guarantee_text')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle(),
    getPublicSettings(),
    /*
     * O MESMO portão que a rota /api/checkout consulta. A tela e a cobrança
     * perguntam a uma função só — é o que impede o caso em que o aviso some
     * mas a rota ainda cobra, ou o contrário.
     */
    estadoDaVenda(slug),
  ])

  if (!oferta) notFound()

  /*
   * Quais capítulos esta compra libera.
   *
   * Sai de `offer_module_access`, a mesma tabela que a regra de acesso do
   * banco consulta depois da matrícula. Quem paga vê ANTES exatamente o que
   * vai destravar — e não descobre a diferença entre os pacotes só na área
   * de estudos.
   */
  // Cliente admin pelo mesmo motivo de `getVitrine()`: a Formação está em
  // rascunho e a RLS esconde os módulos do visitante. Só nome e posição
  // atravessam — nenhuma aula.
  const { data: liberados } = await createAdminClient()
    .from('offer_module_access')
    .select('modules:module_id (id, name, position)')
    .eq('offer_id', oferta.id)

  type Capitulo = { id: string; name: string; position: number }

  const capitulos = (liberados ?? [])
    .map((l) => um<Capitulo>(l.modules))
    .filter((m): m is Capitulo => Boolean(m))
    .sort((a, b) => a.position - b.position)

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
            acao={{ label: 'Ver os planos', href: '/planos' }}
          />
        </main>
      </>
    )
  }

  const parcelas = formatInstallments(oferta.price_cents, oferta.max_installments)

  return (
    <>
      <VisualizacaoDeEtapa
        evento={EVENTO.CHECKOUT_START}
        props={{
          offerId: oferta.id,
          offerSlug: oferta.slug,
          valorCents: oferta.price_cents,
          moeda: 'BRL',
          podeCobrar: venda.podeCobrar,
        }}
      />
      <Topo />
      <main id="conteudo" className="page checkout">
        <div>
          <p className="eyebrow">Inscrição</p>
          <h1>Seus dados</h1>

          {!venda.podeCobrar ? (
            <div style={{ marginBlockStart: 'var(--space-5)' }}>
              {/*
                A página continua NAVEGÁVEL de propósito: dá para conferir
                preço, capítulos e textos legais. O que não acontece é cobrar.
                Nada de Pix falso, QR de mentira ou matrícula sem pagamento.
              */}
              <Aviso tone="warning" titulo="Pagamento indisponível">
                {venda.mensagem} Você pode conferir abaixo o que este plano inclui — o
                formulário volta a aceitar pagamento assim que as inscrições abrirem.
              </Aviso>
            </div>
          ) : null}

          <div style={{ marginBlockStart: 'var(--space-5)' }}>
            <CheckoutForm
              offerSlug={oferta.slug}
              disabled={!venda.podeCobrar}
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

          {capitulos.length > 0 ? (
            <div className="checkout__capitulos">
              <p className="eyebrow">
                {capitulos.length} {capitulos.length === 1 ? 'capítulo' : 'capítulos'} liberados
              </p>
              <ul role="list">
                {capitulos.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
              <p className="palheta__meta">
                <Link href="/planos">Comparar com os outros planos</Link>
              </p>
            </div>
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
