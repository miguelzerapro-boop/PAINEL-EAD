import type { Metadata } from 'next'

import { PaginaLegal } from '@/components/pagina-legal'

export const metadata: Metadata = { title: 'Termos de uso' }
export const dynamic = 'force-dynamic'

export default function TermosPage() {
  return <PaginaLegal titulo="Termos de uso" chave="legal.terms" />
}
