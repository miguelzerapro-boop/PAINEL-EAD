-- ===========================================================================
-- 07 - FUNIL: LEADS, QUIZ DE DIAGNOSTICO E WHATSAPP
--
-- O quiz identifica o MOMENTO da potencial aluna. Ele nao afirma que existe
-- curso ou trilha. O destino de cada resultado e resolvido em tempo de
-- execucao contra o banco (curso publicado > oferta ativa > pagina > WhatsApp).
-- ===========================================================================

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  phone         text,
  whatsapp      text,

  source        text not null default 'quiz'
                check (source in ('quiz', 'landing', 'sales_page', 'checkout', 'whatsapp', 'manual', 'import')),
  utm           jsonb not null default '{}'::jsonb,
  referrer      text,
  landing_path  text,

  stage         text not null default 'new'
                check (stage in ('new', 'diagnosed', 'contacted', 'negotiating', 'customer', 'lost', 'discarded')),
  owner_id      uuid references public.profiles (id) on delete set null,
  notes         text,

  user_id       uuid references public.profiles (id) on delete set null,
  consent_id    uuid,                     -- FK adicionada na migration de LGPD
  last_contact_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index leads_stage_idx on public.leads (stage, created_at desc);
create index leads_email_idx on public.leads (lower(email));
create index leads_phone_idx on public.leads (phone);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.tg_set_updated_at();

alter table public.orders
  add constraint orders_lead_fk
  foreign key (lead_id) references public.leads (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  intro_title    text,
  intro_body     text,
  -- Quando NENHUM resultado tiver destino cadastrado, esta e a mensagem final.
  fallback_message text not null,
  collect_name   boolean not null default true,
  collect_email  boolean not null default true,
  collect_phone  boolean not null default true,
  consent_text   text,
  status         public.publication_status not null default 'draft',
  version        integer not null default 1,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.tg_set_updated_at();

create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  prompt      text not null,
  help_text   text,
  type        text not null default 'single'
              check (type in ('single', 'multiple', 'scale', 'text')),
  is_required boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index quiz_questions_idx on public.quiz_questions (quiz_id, position);

-- ---------------------------------------------------------------------------
-- Resultados possiveis do diagnostico.
-- Estes cinco sao MOMENTOS da pessoa, nao produtos. Foram autorizados no
-- escopo. Nenhum deles promete curso, trilha, preco ou prazo.
-- ---------------------------------------------------------------------------
create table public.quiz_outcomes (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes (id) on delete cascade,
  key             text not null,
  name            text not null,
  description     text,

  -- Destino desejado, em ordem de preferencia. A resolucao real acontece na
  -- funcao resolve_quiz_outcome(): se o alvo nao existir ou nao estiver
  -- publicado, cai para o WhatsApp em vez de mostrar trilha inexistente.
  preferred_target text not null default 'auto'
                   check (preferred_target in ('auto', 'course', 'offer', 'page', 'whatsapp')),
  course_id       uuid references public.courses (id) on delete set null,
  offer_id        uuid references public.offers (id) on delete set null,
  target_path     text,

  whatsapp_message text,        -- mensagem pre-preenchida no link do WhatsApp
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (quiz_id, key)
);

create trigger quiz_outcomes_set_updated_at
  before update on public.quiz_outcomes
  for each row execute function public.tg_set_updated_at();

create table public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label       text not null,
  value       text not null,
  help_text   text,
  -- Peso por resultado: {"<outcome_key>": 2, "outro": 1}
  weights     jsonb not null default '{}'::jsonb,
  position    integer not null default 0
);

create index quiz_options_idx on public.quiz_options (question_id, position);

create table public.quiz_responses (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  lead_id        uuid references public.leads (id) on delete set null,
  session_id     text,
  answers        jsonb not null default '{}'::jsonb,
  scores         jsonb not null default '{}'::jsonb,
  outcome_id     uuid references public.quiz_outcomes (id) on delete set null,
  -- O que o sistema efetivamente entregou:
  -- { "action": "course"|"offer"|"page"|"whatsapp", "url": "...", "reason": "..." }
  resolved_action jsonb not null default '{}'::jsonb,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index quiz_responses_lead_idx on public.quiz_responses (lead_id);
create index quiz_responses_outcome_idx on public.quiz_responses (outcome_id);

-- ---------------------------------------------------------------------------
-- Cliques de WhatsApp (atribuicao do funil)
-- ---------------------------------------------------------------------------
create table public.whatsapp_clicks (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  origin      text not null,          -- 'quiz_result' | 'landing_header' | 'sales_page' | 'support'
  outcome_key text,
  message     text,
  utm         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index whatsapp_clicks_origin_idx on public.whatsapp_clicks (origin, created_at desc);

-- ---------------------------------------------------------------------------
-- Resolucao do destino do diagnostico.
-- Regra do escopo, nesta ordem:
--   1. existe curso publicado compativel?
--   2. existe oferta ativa?
--   3. existe pagina especifica?
--   4. senao, WhatsApp com a mensagem de fallback.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_quiz_outcome(p_outcome_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  v_slug text;
  v_offer_slug text;
  v_fallback text;
begin
  select * into o from public.quiz_outcomes where id = p_outcome_id;
  if not found then
    return jsonb_build_object('action', 'whatsapp', 'reason', 'outcome_not_found');
  end if;

  select fallback_message into v_fallback from public.quizzes where id = o.quiz_id;

  -- 1. curso publicado
  if o.preferred_target in ('auto', 'course') and o.course_id is not null then
    select slug into v_slug
    from public.courses
    where id = o.course_id and status = 'published';
    if v_slug is not null then
      return jsonb_build_object('action', 'course', 'url', '/cursos/' || v_slug, 'reason', 'published_course');
    end if;
  end if;

  -- 2. oferta ativa
  if o.preferred_target in ('auto', 'offer') and o.offer_id is not null then
    select slug into v_offer_slug
    from public.offers
    where id = o.offer_id
      and status = 'published'
      and price_cents is not null
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now());
    if v_offer_slug is not null then
      return jsonb_build_object('action', 'offer', 'url', '/oferta/' || v_offer_slug, 'reason', 'active_offer');
    end if;
  end if;

  -- 3. pagina especifica
  if o.preferred_target in ('auto', 'page') and o.target_path is not null then
    return jsonb_build_object('action', 'page', 'url', o.target_path, 'reason', 'configured_page');
  end if;

  -- 4. WhatsApp
  return jsonb_build_object(
    'action', 'whatsapp',
    'message', coalesce(o.whatsapp_message, v_fallback),
    'reason', 'no_published_target'
  );
end;
$$;

comment on function public.resolve_quiz_outcome is
  'Nunca inventa trilha. Se nao existir curso publicado nem oferta ativa, devolve o encaminhamento para WhatsApp com a mensagem cadastrada.';
