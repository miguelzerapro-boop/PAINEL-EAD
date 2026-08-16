-- ===========================================================================
-- 01 - FUNDACAO
-- Extensoes, enums compartilhados, helpers de papel e tabela de configuracoes.
--
-- Nenhum conteudo pedagogico e definido aqui. Niveis, categorias e tipos de
-- conteudo que a responsavel possa querer renomear vivem em TABELAS, nao em
-- enums, justamente para serem editaveis pelo painel.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums de sistema (conceitos estruturais, nao conteudo)
-- ---------------------------------------------------------------------------

-- Ciclo de vida usado por curso, modulo, aula, pagina de CMS, oferta etc.
create type public.publication_status as enum (
  'draft',      -- rascunho, invisivel no site publico
  'scheduled',  -- agendado, publica automaticamente em published_at
  'published',  -- visivel
  'archived'    -- retirado do ar, historico preservado
);

create type public.user_role as enum (
  'student',
  'instructor',
  'admin',
  'owner'
);

-- Tipos de conteudo suportados pela aula. Conforme escopo.
create type public.content_type as enum (
  'video',
  'text',
  'audio',
  'pdf',
  'image',
  'download',
  'link',
  'live',      -- aula ao vivo
  'quiz',
  'practice',  -- atividade pratica
  'form',
  'embed'      -- conteudo incorporado
);

-- Regras de liberacao suportadas por modulo e aula. Conforme escopo.
create type public.release_mode as enum (
  'immediate',
  'after_previous_module',
  'after_previous_lesson',
  'on_date',
  'days_after_enrollment',
  'manual',
  'by_cohort'
);

create type public.access_mode as enum (
  'lifetime',   -- sem prazo
  'days',       -- N dias a partir da matricula
  'until_date'  -- data fixa
);

create type public.enrollment_status as enum (
  'active',
  'suspended',
  'expired',
  'cancelled',
  'completed'
);

create type public.order_status as enum (
  'pending',
  'in_process',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'chargeback'
);

create type public.lesson_progress_status as enum (
  'not_started',
  'in_progress',
  'completed'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Mantem updated_at coerente sem depender da aplicacao.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Slug estavel a partir de um texto em portugues.
-- Usa translate() em vez de unaccent() para nao depender do schema em que a
-- extensao foi instalada (o Supabase instala em `extensions`, nao em `public`).
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(
          coalesce(input, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
        )),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Configuracoes globais editaveis (WhatsApp, dados legais, rodape, SEO padrao)
-- Nenhum valor real e semeado: tudo comeca vazio e precisa ser preenchido.
-- ---------------------------------------------------------------------------
create table public.settings (
  key           text primary key,
  group_key     text not null,
  label         text not null,
  description   text,
  value         jsonb,
  value_schema  jsonb,             -- descreve o formato esperado para o painel
  is_required   boolean not null default false,
  is_secret     boolean not null default false,
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table public.settings is
  'Chave/valor editavel pelo painel. is_required=true e value nulo significa "pendencia de preenchimento" e deve bloquear a publicacao do bloco que depende dela.';

create index settings_group_idx on public.settings (group_key);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.tg_set_updated_at();
