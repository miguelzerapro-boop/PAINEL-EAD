import type { Metadata } from 'next'

import { Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { getPublicSettings } from '@/lib/cms/page'
import { getWhatsAppTarget } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Suporte',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function SuportePage() {
  const [settings, whatsapp] = await Promise.all([getPublicSettings(), getWhatsAppTarget()])
  const email = typeof settings['contact.email'] === 'string' ? settings['contact.email'] : null
  const horario = typeof settings['contact.hours'] === 'string' ? settings['contact.hours'] : null

  const temCanal = Boolean(email || whatsapp.available)

  return (
    <>
      <Topo />
      <main id="conteudo" className="page section" style={{ maxWidth: 'var(--width-text)' }}>
        <p className="eyebrow">Suporte</p>
        <h1>Precisa de ajuda?</h1>

        {temCanal ? (
          <>
            {horario ? (
              <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
                {horario}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBlockStart: 'var(--space-6)', flexWrap: 'wrap' }}>
              {whatsapp.available ? (
                <a className="botao botao--primario" href={whatsapp.href} target="_blank" rel="noopener noreferrer">
                  Falar no WhatsApp
                </a>
              ) : null}
              {email ? (
                <a className="botao botao--secundario" href={`mailto:${email}`}>
                  Enviar e-mail
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <div style={{ marginBlockStart: 'var(--space-5)' }}>
            <EstadoVazio
              titulo="Os canais de atendimento ainda não foram configurados"
              texto="Assim que o WhatsApp e o e-mail forem cadastrados no painel, eles aparecem aqui."
              acao={{ label: 'Voltar', href: '/aluna' }}
            />
          </div>
        )}
      </main>
    </>
  )
}
