'use client'

import { useActionState } from 'react'

import { salvarAjustes } from '@/app/admin/acoes'
import type { ResultadoAcao } from '@/app/admin/tipos'

/* eslint-disable @typescript-eslint/no-explicit-any */

const NOMES_DE_GRUPO: Record<string, string> = {
  site: 'Site',
  contact: 'Contato',
  legal: 'Dados legais',
  seo: 'SEO',
  checkout: 'Checkout',
}

export function FormularioAjustes({ grupos }: { grupos: Record<string, any[]> }) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(salvarAjustes, null)

  return (
    <form action={acao} style={{ display: 'grid', gap: 'var(--space-6)', maxWidth: '48rem' }}>
      {estado?.ok ? (
        <div className="aviso" data-tone="success">
          <p>Ajustes salvos.</p>
        </div>
      ) : null}
      {estado && !estado.ok ? (
        <div className="aviso" data-tone="error" role="alert">
          <p>{estado.message}</p>
        </div>
      ) : null}

      {Object.entries(grupos).map(([grupo, itens]) => (
        <fieldset key={grupo} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="eyebrow" style={{ paddingBlockEnd: 'var(--space-3)' }}>
            {NOMES_DE_GRUPO[grupo] ?? grupo}
          </legend>
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-4)',
              paddingBlockStart: 'var(--space-4)',
              borderBlockStart: 'var(--rail-width) solid var(--rail-color)',
            }}
          >
            {itens.map((item) => {
              const vazioObrigatorio = item.is_required && !item.value
              const longo = item.key.startsWith('legal.') && item.key !== 'legal.tax_id'

              return (
                <label className="campo" key={item.key} id={`campo-${item.key}`}>
                  <span className="campo__rotulo">
                    {item.label}
                    {item.is_required ? ' *' : ''}
                    {vazioObrigatorio ? (
                      <span className="campo__erro" style={{ marginInlineStart: 'var(--space-2)' }}>
                        pendente
                      </span>
                    ) : null}
                  </span>
                  {longo ? (
                    <textarea
                      className="entrada"
                      name={`ajuste.${item.key}`}
                      defaultValue={typeof item.value === 'string' ? item.value : ''}
                      rows={6}
                      aria-invalid={vazioObrigatorio || undefined}
                    />
                  ) : (
                    <input
                      className="entrada"
                      name={`ajuste.${item.key}`}
                      defaultValue={typeof item.value === 'string' ? item.value : ''}
                      aria-invalid={vazioObrigatorio || undefined}
                    />
                  )}
                  {item.description ? <span className="campo__dica">{item.description}</span> : null}
                  <span className="mono">{item.key}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <button className="botao botao--primario" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar ajustes'}
        </button>
      </div>
    </form>
  )
}
