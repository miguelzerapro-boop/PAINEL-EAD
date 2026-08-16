-- ===========================================================================
-- 09 - LGPD, AUDITORIA E ANALYTICS PROPRIO
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Consentimentos (LGPD art. 8)
-- Guarda o texto exato aceito, nao apenas um booleano.
-- ---------------------------------------------------------------------------
create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  subject_email text,
  subject_phone text,
  lead_id       uuid references public.leads (id) on delete set null,
  user_id       uuid references public.profiles (id) on delete set null,

  purpose       text not null
                check (purpose in ('marketing', 'terms', 'privacy', 'cookies', 'image_use', 'testimonial')),
  policy_version text not null,
  text_snapshot text not null,      -- texto exato mostrado no momento do aceite
  granted       boolean not null,
  channel       text,               -- 'quiz', 'checkout', 'signup', 'form'
  ip_address    inet,
  user_agent    text,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index consents_subject_idx on public.consents (lower(subject_email));
create index consents_user_idx on public.consents (user_id);

-- FKs que dependiam desta tabela
alter table public.media_assets
  add constraint media_assets_consent_fk
  foreign key (consent_id) references public.consents (id) on delete set null;

alter table public.leads
  add constraint leads_consent_fk
  foreign key (consent_id) references public.consents (id) on delete set null;

alter table public.testimonials
  add constraint testimonials_consent_fk
  foreign key (consent_id) references public.consents (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Pedidos do titular (acesso, correcao, exclusao, portabilidade)
-- ---------------------------------------------------------------------------
create table public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  type          text not null
                check (type in ('access', 'rectify', 'delete', 'portability', 'revoke_consent')),
  subject_email text not null,
  user_id       uuid references public.profiles (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,
  message       text,
  status        text not null default 'open'
                check (status in ('open', 'in_progress', 'done', 'rejected')),
  handled_by    uuid references public.profiles (id) on delete set null,
  handled_at    timestamptz,
  resolution    text,
  requested_at  timestamptz not null default now(),
  due_at        timestamptz not null default now() + interval '15 days',
  created_at    timestamptz not null default now()
);

create index data_requests_status_idx on public.data_requests (status, due_at);

-- ---------------------------------------------------------------------------
-- Politica de retencao: quanto tempo cada tipo de dado fica guardado.
-- Editavel pelo painel; a rotina de expurgo le daqui.
-- ---------------------------------------------------------------------------
create table public.retention_policies (
  entity        text primary key,
  label         text not null,
  retention_days integer not null check (retention_days > 0),
  legal_basis   text,
  note          text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auditoria de alteracoes sensiveis
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.user_role,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- Trigger generico de auditoria, aplicado nas tabelas sensiveis.
create or replace function public.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    public.current_role(),
    lower(tg_op),
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger courses_audit
  after insert or update or delete on public.courses
  for each row execute function public.tg_audit_row();

create trigger offers_audit
  after insert or update or delete on public.offers
  for each row execute function public.tg_audit_row();

create trigger orders_audit
  after insert or update or delete on public.orders
  for each row execute function public.tg_audit_row();

create trigger enrollments_audit
  after insert or update or delete on public.enrollments
  for each row execute function public.tg_audit_row();

create trigger cms_sections_audit
  after insert or update or delete on public.cms_sections
  for each row execute function public.tg_audit_row();

create trigger profiles_audit
  after update or delete on public.profiles
  for each row execute function public.tg_audit_row();

-- ---------------------------------------------------------------------------
-- Analytics proprio (first-party). Evita depender so de pixel de terceiro e
-- reduz dado pessoal enviado para fora.
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id          bigserial primary key,
  name        text not null,
  session_id  text,
  lead_id     uuid references public.leads (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  path        text,
  referrer    text,
  utm         jsonb not null default '{}'::jsonb,
  props       jsonb not null default '{}'::jsonb,
  device      text check (device in ('desktop', 'tablet', 'mobile')),
  created_at  timestamptz not null default now()
);

create index analytics_events_name_idx on public.analytics_events (name, created_at desc);
create index analytics_events_session_idx on public.analytics_events (session_id);

-- Funil resumido, para o painel nao precisar varrer a tabela inteira.
create or replace view public.funnel_daily as
select
  date_trunc('day', created_at)::date as day,
  name,
  count(*) as events,
  count(distinct session_id) as sessions
from public.analytics_events
group by 1, 2;
