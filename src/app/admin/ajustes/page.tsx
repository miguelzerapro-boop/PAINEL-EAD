import { FormularioAjustes } from './formulario'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AjustesPage() {
  const db = createAdminClient()
  const { data: ajustes } = await db
    .from('settings')
    .select('key, group_key, label, description, value, is_required')
    .order('group_key')
    .order('key')

  type Ajuste = NonNullable<typeof ajustes>[number]
  const grupos = new Map<string, Ajuste[]>()
  for (const ajuste of ajustes ?? []) {
    const lista = grupos.get(ajuste.group_key) ?? []
    lista.push(ajuste)
    grupos.set(ajuste.group_key, lista)
  }

  return (
    <>
      <h1 className="admin__titulo">Ajustes</h1>
      <p className="lead" style={{ marginBlockEnd: 'var(--space-5)' }}>
        Campos marcados com * são obrigatórios para o site ir ao ar. Enquanto estiverem vazios,
        os blocos que dependem deles ficam ocultos no site público.
      </p>
      <FormularioAjustes grupos={Object.fromEntries(grupos)} />
    </>
  )
}
