import type { Metadata } from 'next'

import { PaginaLegal } from '@/components/pagina-legal'

export const metadata: Metadata = { title: 'Política de privacidade' }
export const dynamic = 'force-dynamic'

export default function PrivacidadePage() {
  return <PaginaLegal titulo="Política de privacidade" chave="legal.privacy" />
}
