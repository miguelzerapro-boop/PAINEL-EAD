import { CabecalhoAdmin } from '@/components/admin/cabecalho'
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

  /*
   * A ORDEM DOS GRUPOS e editorial, nao alfabetica.
   *
   * O banco devolvia por `group_key`, entao "checkout" vinha primeiro e a
   * responsavel abria Configuracoes e via "Pagamento" antes do nome da
   * propria empresa. A ordem abaixo segue o que ela procura mais.
   */
  const ORDEM = ["site", "contact", "legal", "seo", "checkout"]

  const grupos = new Map<string, Ajuste[]>()
  for (const chave of ORDEM) grupos.set(chave, [])
  for (const ajuste of ajustes ?? []) {
    const lista = grupos.get(ajuste.group_key) ?? []
    lista.push(ajuste)
    grupos.set(ajuste.group_key, lista)
  }
  for (const [chave, lista] of grupos) if (lista.length === 0) grupos.delete(chave)

  return (
    <>
      <CabecalhoAdmin
        titulo="Configurações"
        descricao="Os dados da sua empresa e do site. Os campos marcados com * precisam estar preenchidos para o site ir ao ar."
      />
      <FormularioAjustes grupos={Object.fromEntries(grupos)} />
    </>
  )
}
