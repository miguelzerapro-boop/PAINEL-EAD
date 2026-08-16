-- ===========================================================================
-- 03 - CATALOGO EDITAVEL
-- Curso > Modulo > Aula > Blocos de conteudo.
--
-- IMPORTANTE: nenhuma grade curricular, nome de curso, quantidade de modulos
-- ou tecnica esta definida neste projeto. Esta migration cria apenas os
-- CAMPOS. O conteudo entra depois, pelo painel.
--
-- Categorias e niveis sao TABELAS (nao enums) porque a responsavel ainda vai
-- definir como quer nomear.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Taxonomias editaveis
-- ---------------------------------------------------------------------------
create table public.course_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_id    uuid references public.media_assets (id) on delete set null,
  position    integer not null default 0,
  status      public.publication_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.course_levels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  position    integer not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger course_categories_set_updated_at
  before update on public.course_categories
  for each row execute function public.tg_set_updated_at();

create trigger course_levels_set_updated_at
  before update on public.course_levels
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------------------------
create table public.courses (
  id                  uuid primary key default gen_random_uuid(),

  -- Identificacao
  name                text not null,
  slug                text not null unique,
  short_description   text,
  full_description    text,

  -- Midia
  cover_id            uuid references public.media_assets (id) on delete set null,
  cover_slot_key      text references public.image_slots (key) on delete set null,
  promo_video_url     text,
  promo_video_id      uuid references public.media_assets (id) on delete set null,

  -- Classificacao
  category_id         uuid references public.course_categories (id) on delete set null,
  level_id            uuid references public.course_levels (id) on delete set null,

  -- Carga horaria: guardada em minutos. NULL = ainda nao definida.
  -- O front nunca deve exibir "0h": se for NULL, a secao simplesmente nao sai.
  workload_minutes    integer check (workload_minutes is null or workload_minutes > 0),

  -- Prazo de acesso
  access_mode         public.access_mode not null default 'lifetime',
  access_days         integer check (access_days is null or access_days > 0),
  access_until        date,

  -- Publicacao
  status              public.publication_status not null default 'draft',
  position            integer not null default 0,
  published_at        timestamptz,

  -- Comercial (FK para products adicionada na migration de comercio)
  product_id          uuid,

  -- Certificado e conclusao
  certificate_enabled boolean not null default false,
  -- Criterios de conclusao. Formato:
  -- { "min_progress_pct": 100, "require_all_assessments": true, "min_score": 70,
  --   "require_all_activities": false }
  completion_criteria jsonb not null default
    '{"min_progress_pct": 100, "require_all_assessments": false, "min_score": null, "require_all_activities": false}'::jsonb,

  -- SEO
  seo                 jsonb not null default '{}'::jsonb,

  -- Texto livre preenchido pelo painel. Vazio = secao nao renderiza.
  audience            text,        -- publico
  prerequisites       text,        -- pre-requisitos
  required_materials  text,        -- materiais necessarios
  welcome_message     text,        -- mensagem de boas-vindas na matricula

  is_demo             boolean not null default false,

  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Coerencia do prazo de acesso
  constraint courses_access_days_required check (
    access_mode <> 'days' or access_days is not null
  ),
  constraint courses_access_until_required check (
    access_mode <> 'until_date' or access_until is not null
  ),
  -- Nao deixa publicar sem o minimo para a pagina do curso existir.
  constraint courses_publish_requires_description check (
    status <> 'published' or (short_description is not null and length(trim(short_description)) > 0)
  ),
  constraint courses_scheduled_requires_date check (
    status <> 'scheduled' or published_at is not null
  )
);

comment on column public.courses.completion_criteria is
  'Criterios de conclusao usados para liberar certificado. Editavel pelo painel.';
comment on column public.courses.workload_minutes is
  'NULL enquanto a carga horaria nao for definida. Nunca exibir valor inventado.';

create index courses_status_idx on public.courses (status, position);
create index courses_category_idx on public.courses (category_id);
create index courses_demo_idx on public.courses (is_demo) where is_demo;

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.tg_set_updated_at();

-- Uma ou mais instrutoras por curso.
create table public.course_instructors (
  course_id     uuid not null references public.courses (id) on delete cascade,
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  role_label    text,          -- ex.: "instrutora principal", "convidada"
  position      integer not null default 0,
  primary key (course_id, instructor_id)
);

-- ---------------------------------------------------------------------------
-- Modulos
-- ---------------------------------------------------------------------------
create table public.modules (
  id                    uuid primary key default gen_random_uuid(),
  course_id             uuid not null references public.courses (id) on delete cascade,

  name                  text not null,
  slug                  text,
  description           text,
  image_id              uuid references public.media_assets (id) on delete set null,
  position              integer not null default 0,

  -- Liberacao
  release_mode          public.release_mode not null default 'immediate',
  release_at            timestamptz,                 -- para 'on_date'
  release_days          integer,                     -- para 'days_after_enrollment'
  release_cohort_id     uuid,                        -- FK adicionada em 0004
  prerequisite_module_id uuid references public.modules (id) on delete set null,

  status                public.publication_status not null default 'draft',
  published_at          timestamptz,
  is_demo               boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (course_id, slug),
  constraint modules_release_date_required check (
    release_mode <> 'on_date' or release_at is not null
  ),
  constraint modules_release_days_required check (
    release_mode <> 'days_after_enrollment' or (release_days is not null and release_days >= 0)
  ),
  constraint modules_prereq_not_self check (prerequisite_module_id is distinct from id)
);

create index modules_course_idx on public.modules (course_id, position);

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Aulas
-- ---------------------------------------------------------------------------
create table public.lessons (
  id                     uuid primary key default gen_random_uuid(),
  module_id              uuid not null references public.modules (id) on delete cascade,
  course_id              uuid not null references public.courses (id) on delete cascade,

  title                  text not null,
  slug                   text,
  description            text,

  -- Tipo principal. Determina o layout que a tela da aula monta.
  -- Blocos adicionais ficam em lesson_blocks.
  content_type           public.content_type not null default 'video',

  -- Video
  video_provider         text check (video_provider in ('upload', 'youtube', 'vimeo', 'panda', 'bunny', 'other')),
  video_url              text,
  video_asset_id         uuid references public.media_assets (id) on delete set null,
  video_thumbnail_id     uuid references public.media_assets (id) on delete set null,

  -- Audio
  audio_url              text,
  audio_asset_id         uuid references public.media_assets (id) on delete set null,

  -- Texto e acessibilidade
  body                   text,           -- conteudo em markdown/rich text
  transcript             text,

  -- Duracao em segundos. NULL = ainda nao definida (nao exibir "0 min").
  duration_seconds       integer check (duration_seconds is null or duration_seconds > 0),

  position               integer not null default 0,
  is_free                boolean not null default false,   -- aula gratuita / degustacao

  -- Liberacao
  release_mode           public.release_mode not null default 'immediate',
  release_at             timestamptz,
  release_days           integer,
  release_cohort_id      uuid,
  prerequisite_lesson_id uuid references public.lessons (id) on delete set null,

  -- Aula ao vivo
  live_starts_at         timestamptz,
  live_ends_at           timestamptz,
  live_url               text,
  live_replay_url        text,

  status                 public.publication_status not null default 'draft',
  published_at           timestamptz,
  is_demo                boolean not null default false,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (module_id, slug),
  constraint lessons_release_date_required check (
    release_mode <> 'on_date' or release_at is not null
  ),
  constraint lessons_release_days_required check (
    release_mode <> 'days_after_enrollment' or (release_days is not null and release_days >= 0)
  ),
  constraint lessons_prereq_not_self check (prerequisite_lesson_id is distinct from id),
  constraint lessons_live_requires_start check (
    content_type <> 'live' or live_starts_at is not null
  )
);

create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);
create index lessons_free_idx on public.lessons (course_id) where is_free;

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.tg_set_updated_at();

-- Mantem lessons.course_id sempre igual ao curso do modulo.
create or replace function public.tg_lesson_sync_course()
returns trigger
language plpgsql
as $$
begin
  select m.course_id into new.course_id
  from public.modules m
  where m.id = new.module_id;
  return new;
end;
$$;

create trigger lessons_sync_course
  before insert or update of module_id on public.lessons
  for each row execute function public.tg_lesson_sync_course();

-- ---------------------------------------------------------------------------
-- Legendas (acessibilidade)
-- ---------------------------------------------------------------------------
create table public.lesson_captions (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  language   text not null default 'pt-BR',
  label      text not null default 'Portugues (Brasil)',
  url        text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  unique (lesson_id, language)
);

-- ---------------------------------------------------------------------------
-- Blocos de conteudo adicionais da aula
-- Permite compor uma aula com varios tipos sem criar campos vazios na tela:
-- a tela renderiza SOMENTE os blocos existentes.
-- ---------------------------------------------------------------------------
create table public.lesson_blocks (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  type       public.content_type not null,
  title      text,
  -- Payload valido por tipo, validado na aplicacao (zod) e no painel.
  data       jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  status     public.publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_blocks_lesson_idx on public.lesson_blocks (lesson_id, position);

create trigger lesson_blocks_set_updated_at
  before update on public.lesson_blocks
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Materiais complementares
-- Podem pertencer a um curso, a um modulo ou a uma aula.
-- ---------------------------------------------------------------------------
create table public.materials (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references public.courses (id) on delete cascade,
  module_id    uuid references public.modules (id) on delete cascade,
  lesson_id    uuid references public.lessons (id) on delete cascade,

  title        text not null,
  description  text,
  kind         text not null default 'pdf'
               check (kind in ('pdf', 'image', 'download', 'link', 'embed')),
  asset_id     uuid references public.media_assets (id) on delete set null,
  external_url text,
  file_size    bigint,
  position     integer not null default 0,
  status       public.publication_status not null default 'published',
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Precisa pertencer a exatamente um dono.
  constraint materials_single_owner check (
    (course_id is not null)::int + (module_id is not null)::int + (lesson_id is not null)::int = 1
  ),
  constraint materials_has_target check (asset_id is not null or external_url is not null)
);

create index materials_lesson_idx on public.materials (lesson_id, position);
create index materials_module_idx on public.materials (module_id, position);
create index materials_course_idx on public.materials (course_id, position);

create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Checklist da aula
-- ---------------------------------------------------------------------------
create table public.lesson_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  text        text not null,
  help_text   text,
  is_required boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index lesson_checklist_lesson_idx on public.lesson_checklist_items (lesson_id, position);

create table public.lesson_checklist_marks (
  item_id    uuid not null references public.lesson_checklist_items (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
