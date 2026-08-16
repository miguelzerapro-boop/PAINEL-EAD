'use client'

import { useActionState } from 'react'

import { salvarRegistro } from '@/app/admin/acoes'
import type { ResultadoAcao } from '@/app/admin/tipos'
import type { CampoSpec, EntidadeSpec } from '@/lib/admin/specs'

export function FormularioGenerico({
  entidade,
  spec,
  registro,
  referencias,
  paiId,
}: {
  entidade: string
  spec: EntidadeSpec
  registro?: Record<string, unknown>
  referencias: Record<string, Array<{ id: string; label: string }>>
  paiId?: string
}) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(salvarRegistro, null)

  return (
    <form action={acao} style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: '48rem' }}>
      <input type="hidden" name="__entidade" value={entidade} />
      {registro?.id ? <input type="hidden" name="__id" value={String(registro.id)} /> : null}
      {paiId ? <input type="hidden" name="__pai" value={paiId} /> : null}

      {estado && !estado.ok ? (
        <div className="aviso" data-tone="error" role="alert">
          <p className="aviso__titulo">Não foi possível salvar</p>
          <p>{estado.message}</p>
        </div>
      ) : null}

      {estado?.ok ? (
        <div className="aviso" data-tone="success">
          <p>Alterações salvas.</p>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          paddingBlockStart: 'var(--space-4)',
          borderBlockStart: 'var(--rail-width) solid var(--rail-color)',
        }}
      >
        {spec.campos.map((campo) => (
          <Campo
            key={campo.nome}
            campo={campo}
            valor={registro?.[campo.nome]}
            opcoesReferencia={referencias[campo.nome]}
          />
        ))}
      </div>

      <div>
        <button className="botao botao--primario" disabled={pendente}>
          {pendente ? 'Salvando…' : `Salvar ${spec.singular.toLowerCase()}`}
        </button>
      </div>
    </form>
  )
}

function Campo({
  campo,
  valor,
  opcoesReferencia,
}: {
  campo: CampoSpec
  valor: unknown
  opcoesReferencia?: Array<{ id: string; label: string }>
}) {
  const texto = valor === null || valor === undefined ? '' : String(valor)

  if (campo.tipo === 'checkbox') {
    return (
      <label className="consentimento">
        <input type="checkbox" name={campo.nome} defaultChecked={valor === true} />
        <span>{campo.rotulo}</span>
      </label>
    )
  }

  return (
    <label className="campo">
      <span className="campo__rotulo">
        {campo.rotulo}
        {campo.obrigatorio ? ' *' : ''}
      </span>

      {campo.tipo === 'textarea' ? (
        <textarea className="entrada" name={campo.nome} defaultValue={texto} rows={5} />
      ) : campo.tipo === 'select' ? (
        <select className="entrada" name={campo.nome} defaultValue={texto}>
          {!campo.obrigatorio ? <option value="">Não definido</option> : null}
          {(campo.opcoes ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'reference' ? (
        <>
          <select className="entrada" name={campo.nome} defaultValue={texto}>
            <option value="">Não definido</option>
            {(opcoesReferencia ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {(opcoesReferencia ?? []).length === 0 ? (
            <span className="campo__dica">Nenhuma opção cadastrada ainda.</span>
          ) : null}
        </>
      ) : (
        <input
          className="entrada"
          type={
            campo.tipo === 'number'
              ? 'number'
              : campo.tipo === 'date'
                ? 'date'
                : campo.tipo === 'datetime'
                  ? 'datetime-local'
                  : 'text'
          }
          name={campo.nome}
          defaultValue={campo.tipo === 'datetime' ? texto.slice(0, 16) : texto}
        />
      )}

      {campo.dica ? <span className="campo__dica">{campo.dica}</span> : null}
    </label>
  )
}
