-- ===========================================================================
-- 08 - CMS INTERNO
-- Paginas, blocos ordenaveis, rascunho, pre-visualizacao, agendamento,
-- publicacao, historico e responsavel pela alteracao.
--
-- Regra dura do escopo: o site publico NAO pode exibir placeholder como se
-- fosse informacao final. Isso e garantido por trigger: um bloco so vai para
-- 'published' se todos os campos declarados como obrigatorios no seu tipo
-- estiverem preenchidos. Enquanto faltar algo, o bloco fica 'draft' e aparece
-- apenas no painel, marcado como pendente.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Registro de tipos de bloco. O painel monta o formulario a partir daqui.
-- ---------------------------------------------------------------------------
create table public.cms_block_types (
  key             text primary key,
  name            text not null,
  description     text,
  category        text not null default 'content',
  -- JSON Schema simplificado: {"campo": {"type":"text","label":"...","required":true}}
  field_schema    jsonb not null default '{}'::jsonb,
  required_fields text[] not null default '{}',
  -- Blocos que dependem de dados que ainda nao existem (numeros, depoimentos,
  -- credenciais da instrutora). Marcados para o painel avisar.
  needs_real_data boolean not null default false,
  max_per_page    integer,
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);

comment on column public.cms_block_types.needs_real_data is
  'true = o bloco so pode ser publicado com dado real fornecido pela responsavel (ex.: numero de alunas, depoimento, formacao). Nunca preencher automaticamente.';

-- ---------------------------------------------------------------------------
-- Paginas
-- ---------------------------------------------------------------------------
create table public.cms_pages (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,      -- 'landing', 'vendas', 'obrigado', 'termos'
  name          text not null,
  path          text not null unique,      -- '/', '/vendas', '/obrigado'
  type          text not null default 'custom'
                check (type in ('landing', 'sales', 'quiz', 'result', 'thanks', 'legal', 'custom')),
  seo           jsonb not null default '{}'::jsonb,
  status        public.publication_status not null default 'draft',
  published_at  timestamptz,
  scheduled_for timestamptz,
  is_system     boolean not null default false,   -- nao pode ser apagada pelo painel
  updated_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint cms_pages_scheduled_requires_date check (
    status <> 'scheduled' or scheduled_for is not null
  )
);

create trigger cms_pages_set_updated_at
  before update on public.cms_pages
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Blocos da pagina (ordem das secoes vive aqui)
-- content = versao publicada. draft_content = rascunho em edicao.
-- A pre-visualizacao le draft_content; o site publico le content.
-- ---------------------------------------------------------------------------
create table public.cms_sections (
  id             uuid primary key default gen_random_uuid(),
  page_id        uuid not null references public.cms_pages (id) on delete cascade,
  block_type     text not null references public.cms_block_types (key) on delete restrict,
  name           text,                  -- rotulo interno para o admin se achar
  position       integer not null default 0,

  content        jsonb not null default '{}'::jsonb,
  draft_content  jsonb not null default '{}'::jsonb,

  status         public.publication_status not null default 'draft',
  scheduled_for  timestamptz,
  published_at   timestamptz,

  -- Preenchido pelo trigger: lista de campos obrigatorios ainda vazios.
  missing_fields text[] not null default '{}',
  admin_note     text,

  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index cms_sections_page_idx on public.cms_sections (page_id, position);
create index cms_sections_pending_idx on public.cms_sections (page_id)
  where array_length(missing_fields, 1) > 0;

create trigger cms_sections_set_updated_at
  before update on public.cms_sections
  for each row execute function public.tg_set_updated_at();

-- Calcula pendencias e impede publicar bloco incompleto.
create or replace function public.tg_cms_section_validate()
returns trigger
language plpgsql
as $$
declare
  t record;
  f text;
  missing text[] := '{}';
  source jsonb;
begin
  select required_fields into t from public.cms_block_types where key = new.block_type;

  -- Avalia o conteudo que vai ao ar; em rascunho, avalia o rascunho.
  source := case when new.status = 'published' then new.content else new.draft_content end;

  foreach f in array coalesce(t.required_fields, '{}') loop
    if source is null
       or source -> f is null
       or source ->> f is null
       or btrim(source ->> f) = ''
       or source ->> f = '[]'
       or source ->> f = '{}' then
      missing := array_append(missing, f);
    end if;
  end loop;

  new.missing_fields := missing;

  if new.status in ('published', 'scheduled') and array_length(missing, 1) > 0 then
    raise exception
      'Bloco "%" nao pode ser publicado: campos obrigatorios vazios (%). Preencha no painel ou mantenha o bloco em rascunho.',
      new.block_type, array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger cms_sections_validate
  before insert or update on public.cms_sections
  for each row execute function public.tg_cms_section_validate();

-- ---------------------------------------------------------------------------
-- Historico de alteracoes (quem mudou, o que mudou, quando)
-- Serve para CMS, cursos, modulos, aulas, ofertas e instrutoras.
-- ---------------------------------------------------------------------------
create table public.cms_revisions (
  id          bigserial primary key,
  entity_type text not null,
  entity_id   uuid not null,
  version     integer not null,
  action      text not null
              check (action in ('create', 'update', 'publish', 'unpublish', 'schedule', 'rollback', 'delete')),
  snapshot    jsonb not null,
  changed_fields text[] not null default '{}',
  note        text,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  created_at  timestamptz not null default now()
);

create index cms_revisions_entity_idx on public.cms_revisions (entity_type, entity_id, version desc);

-- ---------------------------------------------------------------------------
-- Tokens de pre-visualizacao (draft preview com troca desktop/tablet/mobile)
-- ---------------------------------------------------------------------------
create table public.cms_preview_tokens (
  token       text primary key,
  page_id     uuid references public.cms_pages (id) on delete cascade,
  entity_type text,
  entity_id   uuid,
  created_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '2 hours',
  created_at  timestamptz not null default now()
);

create index cms_preview_tokens_expiry_idx on public.cms_preview_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Perguntas frequentes
-- ---------------------------------------------------------------------------
create table public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  scope      text not null default 'global'
             check (scope in ('global', 'landing', 'sales', 'checkout', 'course')),
  course_id  uuid references public.courses (id) on delete cascade,
  position   integer not null default 0,
  status     public.publication_status not null default 'draft',
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faqs_scope_idx on public.faqs (scope, position);

create trigger faqs_set_updated_at
  before update on public.faqs
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Depoimentos
-- A tabela nasce VAZIA e assim deve permanecer ate existirem depoimentos
-- reais, com autorizacao de uso registrada. Depoimento inventado e proibido.
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  author_name   text not null,
  author_role   text,
  author_city   text,
  content       text not null,
  photo_id      uuid references public.media_assets (id) on delete set null,
  course_id     uuid references public.courses (id) on delete set null,

  -- Procedencia obrigatoria.
  source        text not null
                check (source in ('whatsapp', 'instagram', 'form', 'video', 'email', 'in_person')),
  collected_at  date,
  consent_id    uuid,                    -- FK adicionada na migration de LGPD
  is_verified   boolean not null default false,

  position      integer not null default 0,
  status        public.publication_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Trava: nada vai ao ar sem verificacao e sem consentimento registrado.
  constraint testimonials_publish_requires_proof check (
    status <> 'published' or (is_verified and consent_id is not null)
  )
);

comment on table public.testimonials is
  'Nasce vazia. Publicar exige is_verified=true e consentimento registrado. Nunca semear depoimento de exemplo.';

create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Metricas exibidas na landing (ex.: numero de alunas)
-- Cada metrica guarda a FONTE. Sem fonte, nao publica.
-- ---------------------------------------------------------------------------
create table public.public_metrics (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  label        text not null,
  value_number numeric,
  value_text   text,
  unit         text,
  source_note  text,                    -- de onde veio o numero
  measured_at  date,
  status       public.publication_status not null default 'draft',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint public_metrics_publish_requires_source check (
    status <> 'published' or (source_note is not null and measured_at is not null
      and (value_number is not null or value_text is not null))
  )
);

comment on constraint public_metrics_publish_requires_source on public.public_metrics is
  'Metrica sem dado real e sem fonte nao pode ir ao ar.';

create trigger public_metrics_set_updated_at
  before update on public.public_metrics
  for each row execute function public.tg_set_updated_at();
