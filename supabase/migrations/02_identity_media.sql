-- ===========================================================================
-- 02 - IDENTIDADE E MIDIA
-- Perfis, instrutoras, acervo de midia e a "lista de producao" de fotos.
--
-- Regra do escopo: nenhuma foto de banco generica e nenhuma imagem gerada por
-- IA pode representar aluna, instrutora ou resultado real. Por isso o acervo
-- carrega origem (`source`) e consentimento, e existe uma tabela de VAGAS de
-- imagem (image_slots) que declara honestamente o que ainda falta fotografar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              public.user_role not null default 'student',
  full_name         text,
  display_name      text,
  email             text,
  phone             text,
  whatsapp          text,
  document          text,                 -- CPF, usado apenas no checkout
  birth_date        date,
  city              text,
  state             text,
  avatar_url        text,
  marketing_opt_in  boolean not null default false,
  onboarded_at      timestamptz,
  last_seen_at      timestamptz,
  notes             text,                 -- anotacao interna do admin
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Cria o perfil automaticamente no signup.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- Helpers de autorizacao. security definer para nao recursar na RLS de profiles.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'student'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'owner');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('instructor', 'admin', 'owner');
$$;

-- ---------------------------------------------------------------------------
-- Acervo de midia
-- ---------------------------------------------------------------------------
create table public.media_assets (
  id             uuid primary key default gen_random_uuid(),
  bucket         text not null default 'media',
  path           text not null,
  kind           text not null default 'image'
                 check (kind in ('image', 'video', 'audio', 'document', 'caption')),
  mime_type      text,
  byte_size      bigint,
  width          integer,
  height         integer,
  duration_secs  integer,

  -- Acessibilidade: alt e obrigatorio na pratica para imagens de conteudo.
  alt            text,
  caption        text,
  credit         text,

  -- Procedencia. Existe para impedir que material generico ou gerado por IA
  -- seja usado como se fosse aluna, instrutora ou resultado real.
  source         text not null default 'own_shoot'
                 check (source in ('own_shoot', 'client_provided', 'stock', 'ai_generated', 'illustration')),
  depicts_real_person boolean not null default false,
  consent_id     uuid,          -- FK adicionada na migration de LGPD
  usage_notes    text,

  uploaded_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (bucket, path),

  -- Trava: material de banco ou gerado por IA nunca pode ser marcado como
  -- retrato de pessoa real.
  constraint media_ai_not_real check (
    not (source in ('stock', 'ai_generated') and depicts_real_person)
  ),
  -- Trava: retrato de pessoa real exige consentimento registrado.
  constraint media_real_person_needs_consent check (
    not (depicts_real_person and consent_id is null)
  )
);

create index media_assets_kind_idx on public.media_assets (kind);
create index media_assets_source_idx on public.media_assets (source);

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Vagas de imagem = lista de producao fotografica
-- Cada slot descreve uma foto que o projeto PRECISA. Enquanto media_id for
-- nulo, a interface mostra um placeholder honesto ("foto pendente") em vez de
-- preencher espaco com imagem generica.
-- ---------------------------------------------------------------------------
create table public.image_slots (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,
  group_key          text not null,        -- landing | vendas | ead | instrutora | portfolio
  name               text not null,
  purpose            text,                 -- onde aparece e para que serve
  recommended_width  integer,
  recommended_height integer,
  aspect_ratio       text,                 -- '16:9', '4:5', '1:1', '3:2'
  orientation        text check (orientation in ('horizontal', 'vertical', 'square')),
  min_width          integer,
  framing_notes      text,                 -- enquadramento
  lighting_notes     text,                 -- iluminacao
  scene_notes        text,                 -- cenario
  casting_notes      text,                 -- diversidade de modelos
  art_direction      text,                 -- PENDENTE ate a etapa de direcao visual
  is_required        boolean not null default true,
  media_id           uuid references public.media_assets (id) on delete set null,
  status             text not null default 'pending'
                     check (status in ('pending', 'briefed', 'shot', 'approved')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.image_slots is
  'Lista de producao fotografica. status=pending significa que a foto ainda nao existe: o front deve renderizar placeholder identificado, nunca imagem de banco.';

create index image_slots_group_idx on public.image_slots (group_key);
create index image_slots_status_idx on public.image_slots (status);

create trigger image_slots_set_updated_at
  before update on public.image_slots
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Instrutoras
-- Todos os campos biograficos comecam vazios. Nada de credencial inventada.
-- ---------------------------------------------------------------------------
create table public.instructors (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid unique references public.profiles (id) on delete set null,
  name            text not null,
  slug            text not null unique,
  headline        text,                    -- uma linha, aparece ao lado do nome
  bio_short       text,
  bio_full        text,
  photo_id        uuid references public.media_assets (id) on delete set null,
  cover_id        uuid references public.media_assets (id) on delete set null,

  -- Formacao e experiencia sao listas livres preenchidas pelo painel.
  -- Ficam vazias ate a responsavel informar. Nao inventar.
  credentials     jsonb not null default '[]'::jsonb,
  specialties     jsonb not null default '[]'::jsonb,
  social_links    jsonb not null default '{}'::jsonb,

  status          public.publication_status not null default 'draft',
  position        integer not null default 0,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index instructors_status_idx on public.instructors (status, position);

create trigger instructors_set_updated_at
  before update on public.instructors
  for each row execute function public.tg_set_updated_at();
