import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const NOMES_DE_GRUPO: Record<string, string> = {
  landing: 'Landing',
  instrutora: 'Instrutora',
  detalhe: 'Detalhes técnicos',
  ambiente: 'Bancada e ambiente',
  portfolio: 'Portfólio',
  alunas: 'Alunas',
  ead: 'Área da aluna',
  seo: 'Compartilhamento',
}

/**
 * Lista de produção fotográfica.
 *
 * Enquanto uma vaga estiver pendente, o site mostra placeholder identificado.
 * Nenhuma imagem de banco e nenhuma imagem gerada por IA pode ocupar vaga de
 * instrutora, aluna ou resultado real.
 */
export default async function MidiaPage() {
  const db = createAdminClient()
  const { data: vagas } = await db
    .from('image_slots')
    .select('*, media:media_assets (path, alt, source, depicts_real_person)')
    .order('group_key')
    .order('key')

  const pendentes = (vagas ?? []).filter((v) => v.status === 'pending')

  const grupos = new Map<string, typeof vagas>()
  for (const vaga of vagas ?? []) {
    const lista = grupos.get(vaga.group_key) ?? []
    lista.push(vaga)
    grupos.set(vaga.group_key, lista)
  }

  return (
    <>
      <h1 className="admin__titulo">Fotos e mídia</h1>

      <div className="aviso" data-tone={pendentes.length > 0 ? 'warning' : 'success'}>
        <p className="aviso__titulo">
          {pendentes.length > 0
            ? `${pendentes.length} fotos ainda não produzidas`
            : 'Todas as fotos previstas foram entregues'}
        </p>
        <p>
          Regra do projeto: nenhuma imagem gerada por IA e nenhuma foto de banco pode ser
          apresentada como aluna, instrutora ou resultado real.
        </p>
      </div>

      {[...grupos.entries()].map(([grupo, itens]) => (
        <section key={grupo} style={{ marginBlockStart: 'var(--space-7)' }}>
          <h2>{NOMES_DE_GRUPO[grupo] ?? grupo}</h2>
          <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
            {(itens ?? []).map((vaga) => (
              <div key={vaga.key} className="lista-admin__linha">
                <div>
                  <strong>{vaga.name}</strong>
                  {vaga.is_required ? <span className="campo__erro"> *</span> : null}
                  <p className="palheta__meta">{vaga.purpose}</p>
                  <p className="mono">
                    {vaga.recommended_width}×{vaga.recommended_height} · {vaga.aspect_ratio} ·{' '}
                    {vaga.orientation}
                  </p>
                  {vaga.framing_notes ? (
                    <p className="palheta__meta">Enquadramento: {vaga.framing_notes}</p>
                  ) : null}
                  {!vaga.art_direction ? (
                    <p className="palheta__motivo">
                      Direção de arte a definir junto com o ensaio.
                    </p>
                  ) : null}
                </div>
                <span className="etiqueta" data-tone={vaga.status === 'pending' ? 'demo' : undefined}>
                  {vaga.status === 'pending' ? 'pendente' : vaga.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
