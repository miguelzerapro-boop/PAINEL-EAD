-- ===========================================================================
-- SHIM DO SUPABASE PARA HOMOLOGACAO LOCAL
--
-- As migrations do projeto dependem de coisas que o Supabase provisiona antes
-- de qualquer migration rodar: o schema `auth`, a tabela `auth.users`, a
-- funcao `auth.uid()` e os papeis `anon`, `authenticated` e `service_role`.
--
-- Este arquivo recria o MINIMO necessario para validar as migrations num
-- PostgreSQL puro. NAO faz parte do projeto e NAO deve ser aplicado no
-- Supabase - la essas estruturas ja existem.
--
-- Fidelidade: `auth.uid()` le `request.jwt.claim.sub`, exatamente como no
-- Supabase, entao os testes de RLS trocam de usuario com
--   set local request.jwt.claim.sub = '<uuid>';
--   set local role authenticated;
-- ===========================================================================

create schema if not exists auth;
create schema if not exists extensions;

-- Papeis usados nas policies.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- Tabela de usuarios (subconjunto do que o Supabase cria).
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

grant select on auth.users to authenticated, service_role;

-- auth.uid(): mesma semantica do Supabase.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- ===========================================================================
-- SHIM DO SCHEMA `storage`
--
-- No Supabase, `storage.buckets` e `storage.objects` já existem e o limite de
-- tamanho e de MIME é aplicado pela API de Storage, ANTES de a linha chegar ao
-- banco. Aqui recriamos as duas tabelas com as mesmas colunas relevantes e
-- emulamos aquela validação por trigger, para que a configuração dos buckets
-- possa ser testada de verdade.
--
-- NADA disto vai para o Supabase. As migrations do projeto apenas INSEREM
-- buckets e CRIAM policies — nunca criam o schema.
-- ===========================================================================

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id           uuid primary key default gen_random_uuid(),
  bucket_id    text not null references storage.buckets (id) on delete cascade,
  name         text not null,
  owner        uuid,
  mime_type    text,
  size         bigint,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (bucket_id, name)
);

grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

-- Utilitário que o Supabase expõe e que policies costumam usar.
create or replace function storage.foldername(p_name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(p_name, '/'))[1:array_length(string_to_array(p_name, '/'), 1) - 1];
$$;

create or replace function storage.filename(p_name text)
returns text
language sql
immutable
as $$
  select (string_to_array(p_name, '/'))[array_length(string_to_array(p_name, '/'), 1)];
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant execute on function storage.filename(text) to anon, authenticated, service_role;

-- Emula a validação que a API de Storage faz no Supabase.
create or replace function storage.tg_valida_bucket()
returns trigger
language plpgsql
as $$
declare
  b record;
begin
  select * into b from storage.buckets where id = new.bucket_id;
  if not found then
    raise exception 'Bucket % nao existe', new.bucket_id using errcode = 'foreign_key_violation';
  end if;

  if b.file_size_limit is not null and new.size is not null and new.size > b.file_size_limit then
    raise exception 'Arquivo de % bytes excede o limite de % bytes do bucket %',
      new.size, b.file_size_limit, b.id using errcode = 'check_violation';
  end if;

  if b.allowed_mime_types is not null and new.mime_type is not null
     and not (new.mime_type = any(b.allowed_mime_types)) then
    raise exception 'Tipo % nao permitido no bucket %', new.mime_type, b.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists objects_valida_bucket on storage.objects;
create trigger objects_valida_bucket
  before insert or update on storage.objects
  for each row execute function storage.tg_valida_bucket();
