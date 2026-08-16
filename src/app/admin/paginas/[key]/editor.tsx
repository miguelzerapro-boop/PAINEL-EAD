'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { publicarBloco, salvarRascunhoBloco } from '@/app/admin/acoes'

/* eslint-disable @typescript-eslint/no-explicit-any */

type CampoSchema = { type: string; label?: string; required?: boolean; options?: string[] }

/**
 * Editor de página do CMS.
 *
 * Coluna esquerda: blocos na ordem em que aparecem no site.
 * Coluna direita: pré-visualização do RASCUNHO, com troca de dispositivo
 * (Desktop / Tablet / Mobile) — exigência do escopo.
 */
export function EditorDePagina({
  pageKey,
  blocos,
  tipos,
  previewToken,
}: {
  pageKey: string
  blocos: any[]
  tipos: any[]
  previewToken: string
}) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [chaveDeAtualizacao, setChaveDeAtualizacao] = useState(0)

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {blocos.map((bloco) => {
          const tipo = tipos.find((t) => t.key === bloco.block_type)
          return (
            <BlocoEditor
              key={bloco.id}
              bloco={bloco}
              tipo={tipo}
              aoSalvar={() => setChaveDeAtualizacao((k) => k + 1)}
            />
          )
        })}

        {blocos.length === 0 ? (
          <p className="lista-admin__vazia">
            Esta página ainda não tem blocos. Adicione um bloco para começar.
          </p>
        ) : null}
      </div>

      <div className="preview">
        <div className="preview__barra">
          <span className="eyebrow">Pré-visualização</span>
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={device === d ? 'botao botao--secundario' : 'botao botao--discreto'}
              onClick={() => setDevice(d)}
              aria-pressed={device === d}
            >
              {d === 'desktop' ? 'Desktop' : d === 'tablet' ? 'Tablet' : 'Celular'}
            </button>
          ))}
        </div>

        <div className="preview__moldura" data-device={device}>
          <iframe
            key={chaveDeAtualizacao}
            className="preview__quadro"
            src={`/preview/${pageKey}?t=${previewToken}`}
            title="Pré-visualização do rascunho"
          />
        </div>
      </div>
    </div>
  )
}

function BlocoEditor({
  bloco,
  tipo,
  aoSalvar,
}: {
  bloco: any
  tipo: any
  aoSalvar: () => void
}) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const schema: Record<string, CampoSchema> = tipo?.field_schema ?? {}
  const faltando: string[] = bloco.missing_fields ?? []
  const conteudo = bloco.draft_content ?? {}

  async function salvar(formData: FormData) {
    setSalvando(true)
    setErro(null)
    setMensagem(null)
    const r = await salvarRascunhoBloco(null, formData)
    setSalvando(false)
    if (r.ok) {
      setMensagem('Rascunho salvo.')
      aoSalvar()
      router.refresh()
    } else {
      setErro(r.message)
    }
  }

  async function publicar() {
    setErro(null)
    const r = await publicarBloco(bloco.id)
    if (r.ok) {
      setMensagem('Bloco publicado.')
      router.refresh()
    } else {
      setErro(r.message)
    }
  }

  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--surface-soft)',
        padding: 'var(--space-5)',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">{tipo?.name ?? bloco.block_type}</p>
          {tipo?.description ? <p className="palheta__meta">{tipo.description}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span className="etiqueta">{bloco.status}</span>
          {faltando.length > 0 ? (
            <span className="etiqueta" data-tone="demo">
              {faltando.length} pendente{faltando.length > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </header>

      {tipo?.needs_real_data ? (
        <div className="aviso" data-tone="warning" style={{ marginBlockStart: 'var(--space-4)' }}>
          <p>
            Este bloco depende de informação real fornecida pela responsável (números, depoimento,
            formação, preço). Não preencha com estimativa.
          </p>
        </div>
      ) : null}

      <form action={salvar} style={{ display: 'grid', gap: 'var(--space-4)', marginBlockStart: 'var(--space-5)' }}>
        <input type="hidden" name="id" value={bloco.id} />

        {Object.entries(schema).map(([nome, campo]) => {
          const pendente = faltando.includes(nome)
          return (
            <label className="campo" key={nome}>
              <span className="campo__rotulo">
                {campo.label ?? nome}
                {campo.required ? ' *' : ''}
                {pendente ? (
                  <span className="campo__erro" style={{ marginInlineStart: 'var(--space-2)' }}>
                    obrigatório e vazio
                  </span>
                ) : null}
              </span>

              {campo.type === 'textarea' || campo.type === 'richtext' ? (
                <textarea
                  className="entrada"
                  name={`campo.${nome}`}
                  defaultValue={conteudo[nome] ?? ''}
                  aria-invalid={pendente || undefined}
                />
              ) : campo.type === 'select' ? (
                <select className="entrada" name={`campo.${nome}`} defaultValue={conteudo[nome] ?? ''}>
                  <option value="">Não definido</option>
                  {(campo.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="entrada"
                  name={`campo.${nome}`}
                  defaultValue={conteudo[nome] ?? ''}
                  aria-invalid={pendente || undefined}
                />
              )}
            </label>
          )
        })}

        {erro ? (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        ) : null}
        {mensagem ? <p style={{ color: 'var(--success)' }}>{mensagem}</p> : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button className="botao botao--secundario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar rascunho'}
          </button>
          <button
            type="button"
            className="botao botao--primario"
            onClick={publicar}
            disabled={faltando.length > 0}
            title={faltando.length > 0 ? 'Preencha os campos obrigatórios antes de publicar' : undefined}
          >
            Publicar bloco
          </button>
        </div>
      </form>
    </section>
  )
}
