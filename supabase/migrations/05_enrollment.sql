-- ===========================================================================
-- 05 - MATRICULA, PROGRESSO, CERTIFICADOS E AVISOS
-- ===========================================================================

create table public.enrollments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  cohort_id      uuid references public.cohorts (id) on delete set null,

  status         public.enrollment_status not null default 'active',
  source         text not null default 'order'
                 check (source in ('order', 'manual', 'import', 'gift', 'demo')),
  order_id       uuid,                       -- FK adicionada na migration de comercio

  enrolled_at    timestamptz not null default now(),
  starts_at      timestamptz not null default now(),
  expires_at     timestamptz,                -- calculado a partir do access_mode do curso
  completed_at   timestamptz,

  progress_pct   numeric(5, 2) not null default 0 check (progress_pct between 0 and 100),
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_activity_at timestamptz,

  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (user_id, course_id)
);

create index enrollments_user_idx on public.enrollments (user_id, status);
create index enrollments_course_idx on public.enrollments (course_id, status);

create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.tg_set_updated_at();

-- Define expires_at a partir da regra de acesso do curso, se nao vier explicito.
create or replace function public.tg_enrollment_set_expiry()
returns trigger
language plpgsql
as $$
declare
  c record;
begin
  if new.expires_at is not null then
    return new;
  end if;

  select access_mode, access_days, access_until into c
  from public.courses where id = new.course_id;

  if c.access_mode = 'days' then
    new.expires_at := new.starts_at + make_interval(days => c.access_days);
  elsif c.access_mode = 'until_date' then
    new.expires_at := c.access_until::timestamptz;
  end if;

  return new;
end;
$$;

create trigger enrollments_set_expiry
  before insert on public.enrollments
  for each row execute function public.tg_enrollment_set_expiry();

-- ---------------------------------------------------------------------------
-- Progresso por aula
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.enrollments (id) on delete cascade,
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,

  status         public.lesson_progress_status not null default 'not_started',
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at   timestamptz,
  first_opened_at timestamptz,
  updated_at     timestamptz not null default now(),

  unique (enrollment_id, lesson_id)
);

create index lesson_progress_user_idx on public.lesson_progress (user_id);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Certificados
-- Emitidos apenas se o curso tiver certificate_enabled e os criterios de
-- conclusao forem atendidos. Nenhum criterio esta definido ainda: o default
-- e conservador (100% de progresso).
-- ---------------------------------------------------------------------------
create table public.certificates (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null unique references public.enrollments (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,

  code            text not null unique,     -- codigo publico de validacao
  student_name    text not null,            -- congelado no momento da emissao
  course_name     text not null,
  workload_minutes integer,
  issued_at       timestamptz not null default now(),
  pdf_url         text,
  validation_hash text not null,
  revoked_at      timestamptz,
  revoked_reason  text,
  created_at      timestamptz not null default now()
);

create index certificates_user_idx on public.certificates (user_id);

-- ---------------------------------------------------------------------------
-- Avisos (dashboard da aluna)
-- ---------------------------------------------------------------------------
create table public.notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  severity    text not null default 'info' check (severity in ('info', 'success', 'warning', 'urgent')),
  audience    text not null default 'all'
              check (audience in ('all', 'course', 'cohort', 'user')),
  course_id   uuid references public.courses (id) on delete cascade,
  cohort_id   uuid references public.cohorts (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete cascade,
  link_url    text,
  link_label  text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  status      public.publication_status not null default 'draft',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint notices_audience_target check (
    (audience = 'all'    and course_id is null and cohort_id is null and user_id is null) or
    (audience = 'course' and course_id is not null) or
    (audience = 'cohort' and cohort_id is not null) or
    (audience = 'user'   and user_id is not null)
  )
);

create index notices_active_idx on public.notices (status, starts_at, ends_at);

create trigger notices_set_updated_at
  before update on public.notices
  for each row execute function public.tg_set_updated_at();

create table public.notice_reads (
  notice_id uuid not null references public.notices (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (notice_id, user_id)
);
