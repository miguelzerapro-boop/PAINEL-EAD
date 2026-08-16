import Link from 'next/link'
import type { Metadata } from 'next'

import { Palheta, Trilho } from '@/components/palheta'
import { Topo } from '@/components/site-chrome'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'Inscrição recebida',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Retorno do Mercado Pago.
 *
 * O estado mostrado vem do PEDIDO no banco, não do parâmetro da URL — o
 * parâmetro é apenas uma dica, e o webhook é a fonte da verdade.
 */
export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams

  let status: string | null = null
  if (ref) {
    const db = createAdminClient()
    const { data } = await db.from('orders').select('status').eq('reference', ref).maybeSingle()
    status = data?.status ?? null
  }

  const pago = status === 'paid'
  const pendente = status === 'pending' || status === 'in_process'

  return (
    <>
      <Topo />
      <main id="conteudo" className="page section">
        <Trilho rotulo="Etapas da inscrição">
          <Palheta state="done" codigo="N.01" titulo="Dados enviados" />
          <Palheta state={pago ? 'done' : 'current'} codigo="N.02" titulo="Pagamento" />
          <Palheta
            state={pago ? 'current' : 'locked'}
            codigo="N.03"
            titulo="Acesso liberado"
            motivo={pago ? null : 'liberado após a confirmação do pagamento'}
            destaque
          />
        </Trilho>

        <div className="editorial" style={{ marginBlockStart: 'var(--space-8)' }}>
          <p className="editorial__rotulo">Inscrição</p>
          <div style={{ maxWidth: 'var(--measure-sales)' }}>
            {pago ? (
              <>
                <h1>Pagamento confirmado</h1>
                <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
                  Seu acesso foi liberado. Entre com o e-mail que você usou na inscrição.
                </p>
                <Link className="botao botao--primario" href="/entrar" style={{ marginBlockStart: 'var(--space-5)' }}>
                  Entrar na área da aluna
                </Link>
              </>
            ) : pendente ? (
              <>
                <h1>Estamos aguardando a confirmação</h1>
                <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
                  Pagamentos por boleto e Pix podem levar alguns minutos. Assim que o Mercado Pago
                  confirmar, seu acesso é liberado automaticamente e você recebe um e-mail.
                </p>
              </>
            ) : (
              <>
                <h1>Recebemos sua inscrição</h1>
                <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
                  Ainda não conseguimos confirmar o pagamento. Se você concluiu no Mercado Pago,
                  aguarde alguns minutos e atualize esta página.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
