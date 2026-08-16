import { getWhatsAppTarget } from '@/lib/whatsapp'

/**
 * SUPORTE PELO WHATSAPP, FLUTUANDO NO CANTO.
 *
 * Substitui a caixa de mensagens interna. Construir um inbox significa
 * construir também a notificação, o "não lido", a busca e o histórico — e
 * quem atende já vive no WhatsApp de qualquer forma.
 *
 * O NÚMERO VEM DE UM LUGAR SÓ: a configuração `contact.whatsapp`, editável em
 * Configurações. Nenhum componente escreve número de telefone.
 *
 * Se o número ainda não foi cadastrado, o botão SOME. Um botão de suporte que
 * abre uma conversa com ninguém é pior do que não ter botão — e inventar um
 * número seria pior ainda.
 */
export async function BotaoWhatsApp({
  origem = 'site',
  mensagem,
}: {
  /** Só para diferenciar de onde veio o clique nos relatórios. */
  origem?: string
  mensagem?: string
}) {
  const whatsapp = await getWhatsAppTarget(mensagem)

  if (!whatsapp.available) return null

  return (
    <a
      className="zap"
      href={whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      data-origem={origem}
      aria-label="Precisa de ajuda? Falar no WhatsApp"
    >
      <span className="zap__dica" aria-hidden="true">
        Precisa de ajuda?
      </span>

      <svg
        className="zap__icone"
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.65-1.23-1.46-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.2 3.7.59.26 1.04.41 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
      </svg>
    </a>
  )
}
