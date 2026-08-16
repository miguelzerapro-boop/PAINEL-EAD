'use client'

import { useActionState } from 'react'

import { salvarCurso } from '@/app/admin/acoes'
import type { ResultadoAcao } from '@/app/admin/tipos'

type Opcao = { id: string; name: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
export function FormularioCurso({
  curso,
  categorias,
  niveis,
}: {
  curso?: any
  categorias: Opcao[]
  niveis: Opcao[]
}) {
  const [estado, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(salvarCurso, null)

  const criterios = curso?.completion_criteria ?? {}
  const seo = curso?.seo ?? {}

  return (
    <form action={acao} style={{ display: 'grid', gap: 'var(--space-6)', maxWidth: '52rem' }}>
      {curso?.id ? <input type="hidden" name="id" value={curso.id} /> : null}

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

      <Grupo titulo="Identificação">
        <Campo rotulo="Nome do curso" nome="name" valor={curso?.name} obrigatorio />
        <Campo
          rotulo="Endereço (slug)"
          nome="slug"
          valor={curso?.slug}
          dica="Só letras minúsculas, números e hífen. Aparece na URL."
          obrigatorio
        />
        <Campo
          rotulo="Descrição curta"
          nome="short_description"
          valor={curso?.short_description}
          tipo="textarea"
          dica="Obrigatória para publicar. Aparece no catálogo e na busca."
        />
        <Campo
          rotulo="Descrição completa"
          nome="full_description"
          valor={curso?.full_description}
          tipo="textarea"
          dica="Separe parágrafos com uma linha em branco."
        />
      </Grupo>

      <Grupo titulo="Classificação">
        <Selecao rotulo="Categoria" nome="category_id" valor={curso?.category_id} opcoes={categorias} />
        <Selecao rotulo="Nível" nome="level_id" valor={curso?.level_id} opcoes={niveis} />
        <Campo
          rotulo="Carga horária (minutos)"
          nome="workload_minutes"
          valor={curso?.workload_minutes}
          tipo="number"
          dica="Deixe vazio enquanto não estiver definida. Vazio não aparece no site."
        />
      </Grupo>

      <Grupo titulo="Prazo de acesso">
        <label className="campo">
          <span className="campo__rotulo">Modo</span>
          <select className="entrada" name="access_mode" defaultValue={curso?.access_mode ?? 'lifetime'}>
            <option value="lifetime">Sem prazo</option>
            <option value="days">Número de dias após a matrícula</option>
            <option value="until_date">Até uma data fixa</option>
          </select>
        </label>
        <Campo rotulo="Dias de acesso" nome="access_days" valor={curso?.access_days} tipo="number" />
        <Campo rotulo="Acesso até" nome="access_until" valor={curso?.access_until} tipo="date" />
      </Grupo>

      <Grupo titulo="Conclusão e certificado">
        <label className="consentimento">
          <input type="checkbox" name="certificate_enabled" defaultChecked={curso?.certificate_enabled} />
          <span>Este curso emite certificado</span>
        </label>
        <Campo
          rotulo="Progresso mínimo (%)"
          nome="min_progress_pct"
          valor={criterios.min_progress_pct ?? 100}
          tipo="number"
        />
        <label className="consentimento">
          <input
            type="checkbox"
            name="require_all_assessments"
            defaultChecked={criterios.require_all_assessments}
          />
          <span>Exigir aprovação em todas as avaliações obrigatórias</span>
        </label>
        <label className="consentimento">
          <input
            type="checkbox"
            name="require_all_activities"
            defaultChecked={criterios.require_all_activities}
          />
          <span>Exigir aprovação em todas as atividades obrigatórias</span>
        </label>
      </Grupo>

      <Grupo titulo="Informações para a aluna">
        <Campo rotulo="Público" nome="audience" valor={curso?.audience} tipo="textarea" />
        <Campo rotulo="Pré-requisitos" nome="prerequisites" valor={curso?.prerequisites} tipo="textarea" />
        <Campo
          rotulo="Materiais necessários"
          nome="required_materials"
          valor={curso?.required_materials}
          tipo="textarea"
        />
        <Campo
          rotulo="Mensagem de boas-vindas"
          nome="welcome_message"
          valor={curso?.welcome_message}
          tipo="textarea"
          dica="Aparece no topo do curso quando a aluna entra."
        />
      </Grupo>

      <Grupo titulo="SEO">
        <Campo rotulo="Título" nome="seo_title" valor={seo.title} />
        <Campo rotulo="Descrição" nome="seo_description" valor={seo.description} tipo="textarea" />
      </Grupo>

      <Grupo titulo="Publicação">
        <label className="campo">
          <span className="campo__rotulo">Situação</span>
          <select className="entrada" name="status" defaultValue={curso?.status ?? 'draft'}>
            <option value="draft">Rascunho — invisível no site</option>
            <option value="scheduled">Agendado</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
        <Campo
          rotulo="Data de publicação"
          nome="published_at"
          valor={curso?.published_at?.slice(0, 16)}
          tipo="datetime-local"
          dica="Obrigatória quando a situação for “Agendado”."
        />
      </Grupo>

      <div>
        <button className="botao botao--primario" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar curso'}
        </button>
      </div>
    </form>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="eyebrow" style={{ paddingBlockEnd: 'var(--space-3)' }}>
        {titulo}
      </legend>
      <div
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          paddingBlockStart: 'var(--space-4)',
          borderBlockStart: 'var(--rail-width) solid var(--rail-color)',
        }}
      >
        {children}
      </div>
    </fieldset>
  )
}

function Campo({
  rotulo,
  nome,
  valor,
  dica,
  tipo = 'text',
  obrigatorio = false,
}: {
  rotulo: string
  nome: string
  valor?: string | number | null
  dica?: string
  tipo?: string
  obrigatorio?: boolean
}) {
  return (
    <label className="campo">
      <span className="campo__rotulo">
        {rotulo}
        {obrigatorio ? ' *' : ''}
      </span>
      {tipo === 'textarea' ? (
        <textarea className="entrada" name={nome} defaultValue={valor ?? ''} />
      ) : (
        <input className="entrada" type={tipo} name={nome} defaultValue={valor ?? ''} />
      )}
      {dica ? <span className="campo__dica">{dica}</span> : null}
    </label>
  )
}

function Selecao({
  rotulo,
  nome,
  valor,
  opcoes,
}: {
  rotulo: string
  nome: string
  valor?: string | null
  opcoes: Opcao[]
}) {
  return (
    <label className="campo">
      <span className="campo__rotulo">{rotulo}</span>
      <select className="entrada" name={nome} defaultValue={valor ?? ''}>
        <option value="">Não definido</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {opcoes.length === 0 ? (
        <span className="campo__dica">Nenhuma opção cadastrada ainda.</span>
      ) : null}
    </label>
  )
}
