'use client'

import { useActionState } from 'react'

import { salvarAjustes } from '@/app/admin/acoes'
import type { ResultadoAcao } from '@/app/admin/tipos'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Nome e explicação de cada grupo.
 *
 * "Site", "SEO" e "Dados legais" eram rótulos de quem montou o banco. A
 * responsável não procura por "SEO" — ela procura pelo que aparece quando
 * alguém compartilha o link. Cada grupo agora diz o que é e para que serve.
 */
const GRUPOS: Record<string, { nome: string; ajuda: string }> = {
  site: {
    nome: 'Marca',
    ajuda: 'Nome e logotipo que aparecem no site inteiro.',
  },
  contact: {
    nome: 'Atendimento',
    ajuda: 'Por onde as alunas falam com você. O WhatsApp alimenta o botão flutuante do site.',
  },
  legal: {
    nome: 'Empresa e documentos',
    ajuda:
      'Dados de registro e os textos que viram as páginas de termos, privacidade e reembolso.',
  },
  seo: {
    nome: 'Compartilhamento',
    ajuda: 'O título, a descrição e a imagem que aparecem quando alguém manda o link.',
  },
  checkout: {
    nome: 'Pagamento',
    ajuda: 'Configuração da cobrança.',
  },
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
        <fieldset key={grupo} className="grupo-ajuste">
          <legend className="grupo-ajuste__nome">{GRUPOS[grupo]?.nome ?? grupo}</legend>
          {GRUPOS[grupo]?.ajuda ? (
            <p className="grupo-ajuste__ajuda">{GRUPOS[grupo].ajuda}</p>
          ) : null}
          <div className="grupo-ajuste__campos">
            {itens.map((item) => {
              const vazioObrigatorio = item.is_required && !item.value
              const longo = item.key.startsWith('legal.') && item.key !== 'legal.tax_id'

              return (
                <label className="campo" key={item.key} id={`campo-${item.key}`}>
                  <span className="campo__rotulo">
                    {item.label}
                    {item.is_required ? ' *' : ''}
                    {/*
                      "pendente" nao e erro: e um campo que ainda nao foi
                      preenchido. Vermelho com borda vermelha faz a tela
                      parecer que algo quebrou quando a responsavel so ainda
                      nao chegou naquele campo.
                    */}
                    {vazioObrigatorio ? <span className="campo__pendente">falta preencher</span> : null}
                  </span>
                  {longo ? (
                    <textarea
                      className="entrada"
                      name={`ajuste.${item.key}`}
                      defaultValue={typeof item.value === 'string' ? item.value : ''}
                      rows={6}
                      data-pendente={vazioObrigatorio || undefined}
                    />
                  ) : (
                    <input
                      className="entrada"
                      name={`ajuste.${item.key}`}
                      defaultValue={typeof item.value === 'string' ? item.value : ''}
                      data-pendente={vazioObrigatorio || undefined}
                    />
                  )}
                  {item.description ? <span className="campo__dica">{item.description}</span> : null}
                  {/* O nome interno da configuracao saiu daqui: `legal.tax_id`
                      embaixo do campo "CNPJ ou CPF" nao ajuda quem preenche, e
                      faz a tela parecer console de banco de dados. */}
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
