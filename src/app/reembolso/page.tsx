import type { Metadata } from 'next'

import { PaginaLegal } from '@/components/pagina-legal'

export const metadata: Metadata = { title: 'Política de reembolso' }
export const dynamic = 'force-dynamic'

export default function ReembolsoPage() {
  return <PaginaLegal titulo="Política de reembolso" chave="legal.refund" />
}
