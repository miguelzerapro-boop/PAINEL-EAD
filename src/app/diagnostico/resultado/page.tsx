import Link from 'next/link'
import type { Metadata } from 'next'

import { Palheta, Trilho } from '@/components/palheta'
import { Rodape, Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { um } from '@/lib/rel'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/token'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Seu diagnóstico',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Resultado do diagnóstico.
 *
 * A tela NUNCA afirma que existe curso ou trilha. O destino foi resolvido no
 * banco por resolve_quiz_outcome(): curso publicado > oferta ativa > página
 * configurada > WhatsApp. Sem nenhum desses, mostra a mensagem oficial de
 * encaminhamento.
 */
export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const { d } = await searchParams
  const payload = d ? verifyToken<{ r: string }>(d) : null

  if (!payload?.r) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Não encontramos este diagnóstico"
            texto="O link pode ter expirado. Você pode refazer o diagnóstico — leva menos de dois minutos."
            acao={{ label: 'Refazer o diagnóstico', href: '/diagnostico' }}
          />
        </main>
        <Rodape />
      </>
    )
  }

  const db = createAdminClient()
  const { data: resposta } = await db
    .from('quiz_responses')
    .select('id, resolved_action, quiz_outcomes (key, name, description), leads (name)')
    .eq('id', payload.r)
    .maybeSingle()

  if (!resposta) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="Não encontramos este diagnóstico"
            texto="Você pode refazer o diagnóstico — leva menos de dois minutos."
            acao={{ label: 'Refazer o diagnóstico', href: '/diagnostico' }}
          />
        </main>
        <Rodape />
      </>
    )
  }

  const outcome = um<{ key: string; name: string; description: string | null }>(resposta.quiz_outcomes)
  const acao = (resposta.resolved_action ?? {}) as { action?: string; url?: string; message?: string }
  const lead = um<{ name: string | null }>(resposta.leads)

  const whatsapp = acao.action === 'whatsapp' ? await getWhatsAppTarget(acao.message) : null

  return (
    <>
      <Topo />
      <main id="conteudo">
        <section className="page" style={{ paddingBlockStart: 'var(--space-6)' }}>
          <Trilho rotulo="Diagnóstico concluído">
            <Palheta state="done" codigo="N.01" titulo="Respondido" />
            <Palheta state="done" codigo="N.02" titulo="Analisado" />
            <Palheta state="current" codigo="N.03" titulo="Seu momento" destaque />
          </Trilho>
        </section>

        <section className="section">
          <div className="page editorial">
            <p className="editorial__rotulo">
              {lead?.name ? `${lead.name.split(' ')[0]}, seu momento é` : 'Seu momento é'}
            </p>

            <div>
              <h1>{outcome?.name ?? 'Ainda estou pesquisando'}</h1>
              {outcome?.description ? (
                <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>{outcome.description}</p>
              ) : null}

              <div style={{ marginBlockStart: 'var(--space-6)', maxWidth: 'var(--measure-sales)' }}>
                {acao.action === 'course' || acao.action === 'offer' || acao.action === 'page' ? (
                  <Link className="botao botao--primario" href={acao.url ?? '/cursos'}>
                    Ver o que está disponível
                  </Link>
                ) : (
                  <>
                    {/* Sem curso publicado nem oferta ativa: mensagem oficial. */}
                    <p style={{ fontSize: 'var(--size-body-lg)' }}>
                      {acao.message ??
                        'Seu diagnóstico foi concluído. Nossa equipe vai conversar com você pelo WhatsApp para entender melhor seu momento e apresentar as opções disponíveis.'}
                    </p>
                    {whatsapp?.available ? (
                      <a
                        className="botao botao--primario"
                        href={whatsapp.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginBlockStart: 'var(--space-5)' }}
                      >
                        Falar no WhatsApp
                      </a>
                    ) : (
                      /*
                       * WhatsApp não configurado. Antes a tela simplesmente
                       * terminava aqui: a pessoa lia que a equipe entraria em
                       * contato e não tinha nenhum passo seguinte. Nada de
                       * botão quebrado nem número inventado — só a orientação
                       * neutra e o caminho de volta.
                       */
                      <p className="resultado__sem-canal">
                        Guarde este link: ele abre o seu resultado de novo quando você precisar.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  )
}
