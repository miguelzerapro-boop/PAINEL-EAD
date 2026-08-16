import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormularioGenerico } from './formulario'
import { Aviso } from '@/components/estados'
import { pegarSpec } from '@/lib/admin/specs'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EditarGenerico({
  params,
  searchParams,
}: {
  params: Promise<{ entidade: string; id: string }>
  searchParams: Promise<{ pai?: string }>
}) {
  const [{ entidade, id }, { pai }] = await Promise.all([params, searchParams])
  const spec = pegarSpec(entidade)
  if (!spec) notFound()

  const db = createAdminClient()

  // Carrega as opções dos campos de referência.
  const referencias: Record<string, Array<{ id: string; label: string }>> = {}
  for (const campo of spec.campos) {
    if (campo.tipo !== 'reference' || !campo.referencia) continue
    const { data } = await db
      .from(campo.referencia.tabela)
      .select(`id, ${campo.referencia.rotulo}`)
      .limit(200)
    referencias[campo.nome] = (data ?? []).map((linha) => {
      const l = linha as unknown as Record<string, string | undefined>
      return { id: l.id ?? '', label: l[campo.referencia!.rotulo] ?? l.id ?? '' }
    })
  }

  if (id === 'novo') {
    return (
      <>
        <h1 className="admin__titulo">Novo {spec.singular.toLowerCase()}</h1>
        <FormularioGenerico entidade={entidade} spec={spec} referencias={referencias} paiId={pai} />
      </>
    )
  }

  const { data: registro } = await db.from(spec.tabela).select('*').eq('id', id).maybeSingle()
  if (!registro) notFound()

  const r = registro as Record<string, unknown>
  const titulo = String(r[spec.colunaTitulo] ?? spec.singular)

  return (
    <>
      <h1 className="admin__titulo">{titulo}</h1>

      {r.is_demo ? (
        <div style={{ marginBlockEnd: 'var(--space-5)' }}>
          <Aviso tone="warning" titulo="Registro de demonstração">
            Este registro foi criado apenas para testar a plataforma e deve ser removido antes da
            publicação.
          </Aviso>
        </div>
      ) : null}

      {/* Atalho para os filhos: curso → módulos, módulo → aulas */}
      {entidade === 'modulos' ? (
        <p style={{ marginBlockEnd: 'var(--space-5)' }}>
          <Link href={`/admin/aulas?pai=${id}`}>Ver as aulas deste módulo →</Link>
        </p>
      ) : null}

      <FormularioGenerico
        entidade={entidade}
        spec={spec}
        registro={r}
        referencias={referencias}
        paiId={spec.pai ? String(r[spec.pai.coluna] ?? '') : undefined}
      />
    </>
  )
}
