-- ===========================================================================
-- 04 - ATIVIDADES, AVALIACOES, TURMAS E LIBERACAO MANUAL
--
-- Nenhuma atividade ou avaliacao real e criada aqui. Apenas a estrutura.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Turmas (para release_mode = 'by_cohort')
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  name        text not null,
  slug        text,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  capacity    integer check (capacity is null or capacity > 0),
  status      public.publication_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, slug)
);

create trigger cohorts_set_updated_at
  before update on public.cohorts
  for each row execute function public.tg_set_updated_at();

alter table public.modules
  add constraint modules_release_cohort_fk
  foreign key (release_cohort_id) references public.cohorts (id) on delete set null;

alter table public.lessons
  add constraint lessons_release_cohort_fk
  foreign key (release_cohort_id) references public.cohorts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Liberacao manual (release_mode = 'manual')
-- O admin libera um modulo ou uma aula para uma aluna especifica.
-- ---------------------------------------------------------------------------
create table public.manual_releases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  module_id   uuid references public.modules (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete cascade,
  released_at timestamptz not null default now(),
  released_by uuid references public.profiles (id) on delete set null,
  note        text,
  constraint manual_releases_single_target check (
    (module_id is not null)::int + (lesson_id is not null)::int = 1
  )
);

create unique index manual_releases_module_uniq
  on public.manual_releases (user_id, module_id) where module_id is not null;
create unique index manual_releases_lesson_uniq
  on public.manual_releases (user_id, lesson_id) where lesson_id is not null;

-- ---------------------------------------------------------------------------
-- Atividades praticas
-- ---------------------------------------------------------------------------
create table public.activities (
  id                uuid primary key default gen_random_uuid(),
  lesson_id         uuid references public.lessons (id) on delete cascade,
  module_id         uuid references public.modules (id) on delete cascade,
  course_id         uuid references public.courses (id) on delete cascade,

  title             text not null,
  instructions      text,
  submission_type   text not null default 'photo'
                    check (submission_type in ('none', 'text', 'file', 'photo', 'link')),
  max_files         integer not null default 3 check (max_files between 1 and 20),
  allow_resubmit    boolean not null default true,
  requires_review   boolean not null default true,
  is_required_for_completion boolean not null default false,
  due_days_after_release integer,
  position          integer not null default 0,
  status            public.publication_status not null default 'draft',
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint activities_single_owner check (
    (lesson_id is not null)::int + (module_id is not null)::int + (course_id is not null)::int = 1
  )
);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.tg_set_updated_at();

create table public.activity_submissions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  attempt      integer not null default 1,
  content      text,
  files        jsonb not null default '[]'::jsonb,   -- [{media_id, alt}]
  link_url     text,
  status       text not null default 'submitted'
               check (status in ('draft', 'submitted', 'in_review', 'approved', 'changes_requested')),
  grade        numeric(5, 2),
  feedback     text,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id, user_id, attempt)
);

create index activity_submissions_user_idx on public.activity_submissions (user_id);
create index activity_submissions_review_idx on public.activity_submissions (status)
  where status in ('submitted', 'in_review');

create trigger activity_submissions_set_updated_at
  before update on public.activity_submissions
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Avaliacoes
-- ---------------------------------------------------------------------------
create table public.assessments (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid references public.lessons (id) on delete cascade,
  module_id      uuid references public.modules (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete cascade,

  title          text not null,
  description    text,
  passing_score  numeric(5, 2) not null default 70 check (passing_score between 0 and 100),
  max_attempts   integer check (max_attempts is null or max_attempts > 0),
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  show_answers_after text not null default 'submission'
                     check (show_answers_after in ('never', 'submission', 'pass')),
  is_required_for_completion boolean not null default false,
  status         public.publication_status not null default 'draft',
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint assessments_single_owner check (
    (lesson_id is not null)::int + (module_id is not null)::int + (course_id is not null)::int = 1
  )
);

create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.tg_set_updated_at();

create table public.assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  prompt        text not null,
  help_text     text,
  type          text not null default 'single'
                check (type in ('single', 'multiple', 'true_false', 'text')),
  points        numeric(5, 2) not null default 1,
  explanation   text,
  media_id      uuid references public.media_assets (id) on delete set null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index assessment_questions_idx on public.assessment_questions (assessment_id, position);

create table public.assessment_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  label       text not null,
  is_correct  boolean not null default false,
  position    integer not null default 0
);

create index assessment_options_idx on public.assessment_options (question_id, position);

create table public.assessment_attempts (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  attempt       integer not null default 1,
  answers       jsonb not null default '{}'::jsonb,   -- {question_id: [option_id] | "texto"}
  score         numeric(5, 2),
  passed        boolean,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  graded_by     uuid references public.profiles (id) on delete set null,
  feedback      text,
  unique (assessment_id, user_id, attempt)
);

create index assessment_attempts_user_idx on public.assessment_attempts (user_id);
