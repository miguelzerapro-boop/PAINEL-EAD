-- ===========================================================================
-- 22 - BIBLIOTECA, COMUNIDADE, MENSAGENS E NOTIFICAÇÕES
--
-- Três áreas novas pedidas para a experiência diária da aluna. Nenhuma delas
-- tinha estrutura no banco.
--
-- Princípios mantidos do resto do projeto:
--   · RLS em tudo, negando por padrão;
--   · nada de conteúdo pedagógico inventado — só a estrutura;
--   · acesso derivado de MATRÍCULA, nunca de flag no cliente;
--   · arquivo privado sai por URL assinada (buckets da migration 20).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.material_kind as enum (
  'ebook',        -- e-book digital
  'apostila',
  'guia',
  'checklist',
  'livro',        -- recomendação de livro (sem venda)
  'extra'
);

create type public.material_access as enum (
  'free',         -- qualquer pessoa autenticada
  'enrolled',     -- qualquer aluna com matrícula ativa em algum curso
  'course'        -- só quem tem matrícula no curso vinculado
);

create type public.conversation_kind as enum ('support', 'course', 'activity');
create type public.conversation_status as enum ('open', 'waiting', 'resolved');

create type public.moderation_status as enum ('published', 'hidden', 'removed');

-- ===========================================================================
-- BIBLIOTECA
-- ===========================================================================

create table public.material_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  position    integer not null default 0,
  status      public.publication_status not null default 'published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger material_categories_set_updated_at
  before update on public.material_categories
  for each row execute function public.tg_set_updated_at();

create table public.library_materials (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  description       text,
  kind              public.material_kind not null default 'ebook',
  category_id       uuid references public.material_categories (id) on delete set null,

  -- Vínculo com curso: define quem enxerga quando access = 'course'.
  course_id         uuid references public.courses (id) on delete set null,

  cover_id          uuid references public.media_assets (id) on delete set null,
  -- Caminho no bucket privado `lesson-assets`. Sai por URL assinada.
  file_path         text,
  file_size         bigint,
  page_count        integer check (page_count is null or page_count > 0),

  access            public.material_access not null default 'enrolled',
  download_allowed  boolean not null default true,

  status            public.publication_status not null default 'draft',
  published_at      timestamptz,
  position          integer not null default 0,
  is_demo           boolean not null default false,

  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Coerência: acesso por curso exige curso.
  constraint materiais_curso_obrigatorio check (access <> 'course' or course_id is not null),
  -- Não publicar material sem arquivo nem descrição.
  constraint materiais_publicar_exige_arquivo check (
    status <> 'published' or (file_path is not null and description is not null)
  )
);

comment on constraint materiais_publicar_exige_arquivo on public.library_materials is
  'Material sem arquivo não vai para a biblioteca — evita capa bonita apontando para o nada.';

create index library_materials_status_idx on public.library_materials (status, position);
create index library_materials_course_idx on public.library_materials (course_id);
create index library_materials_kind_idx on public.library_materials (kind);
create index library_materials_busca_idx on public.library_materials
  using gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));

create trigger library_materials_set_updated_at
  before update on public.library_materials
  for each row execute function public.tg_set_updated_at();

create table public.material_favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  material_id uuid not null references public.library_materials (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, material_id)
);

-- Leitura: última página e quando abriu. Alimenta "acessados recentemente".
create table public.material_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  material_id  uuid not null references public.library_materials (id) on delete cascade,
  last_page    integer not null default 1 check (last_page > 0),
  opened_at    timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, material_id)
);

create index material_progress_recentes_idx on public.material_progress (user_id, opened_at desc);

/**
 * A pessoa tem acesso a este material?
 * A regra vive no banco, como todas as outras deste projeto.
 */
create or replace function public.material_is_available(p_material_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
begin
  select * into m from public.library_materials where id = p_material_id;
  if not found or m.status <> 'published' then
    return false;
  end if;

  if p_user_id is null then
    return false;
  end if;

  case m.access
    when 'free' then
      return true;

    when 'enrolled' then
      return exists (
        select 1 from public.enrollments e
        where e.user_id = p_user_id and e.status in ('active', 'completed')
      );

    when 'course' then
      return exists (
        select 1 from public.enrollments e
        where e.user_id = p_user_id
          and e.course_id = m.course_id
          and e.status in ('active', 'completed')
      );

    else
      return false;
  end case;
end;
$$;

grant execute on function public.material_is_available(uuid, uuid) to authenticated;

-- ===========================================================================
-- COMUNIDADE
-- ===========================================================================

create table public.community_channels (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  -- Canal de curso: só quem tem matrícula participa.
  course_id     uuid references public.courses (id) on delete cascade,
  -- Canal de aviso: só a equipe publica, todas leem.
  somente_equipe boolean not null default false,
  position      integer not null default 0,
  status        public.publication_status not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger community_channels_set_updated_at
  before update on public.community_channels
  for each row execute function public.tg_set_updated_at();

create table public.community_posts (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.community_channels (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,

  -- Contexto opcional: publicação feita a partir de uma aula ou de um curso.
  course_id     uuid references public.courses (id) on delete set null,
  lesson_id     uuid references public.lessons (id) on delete set null,

  body          text not null check (length(trim(body)) between 1 and 5000),
  media         jsonb not null default '[]'::jsonb,

  status        public.moderation_status not null default 'published',
  pinned        boolean not null default false,

  comment_count integer not null default 0,
  reaction_count integer not null default 0,

  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  updated_at    timestamptz not null default now()
);

create index community_posts_feed_idx on public.community_posts (channel_id, pinned desc, created_at desc);
create index community_posts_autora_idx on public.community_posts (author_id);
create index community_posts_aula_idx on public.community_posts (lesson_id) where lesson_id is not null;
create index community_posts_busca_idx on public.community_posts
  using gin (to_tsvector('portuguese', body));

create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.tg_set_updated_at();

create table public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.community_comments (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 2000),
  status      public.moderation_status not null default 'published',
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index community_comments_post_idx on public.community_comments (post_id, created_at);

create table public.community_reactions (
  post_id     uuid references public.community_posts (id) on delete cascade,
  comment_id  uuid references public.community_comments (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'curtir' check (kind in ('curtir', 'parabens', 'util')),
  created_at  timestamptz not null default now(),

  constraint reacao_alvo_unico check (
    (post_id is not null)::int + (comment_id is not null)::int = 1
  )
);

create unique index community_reactions_post_uniq
  on public.community_reactions (post_id, user_id) where post_id is not null;
create unique index community_reactions_comment_uniq
  on public.community_reactions (comment_id, user_id) where comment_id is not null;

create table public.community_reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('post', 'comment')),
  post_id      uuid references public.community_posts (id) on delete cascade,
  comment_id   uuid references public.community_comments (id) on delete cascade,
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  reason       text not null check (reason in ('spam', 'ofensivo', 'fora_do_tema', 'dado_pessoal', 'outro')),
  detail       text,
  status       text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index community_reports_abertas_idx on public.community_reports (status, created_at);

-- --- Contadores mantidos por trigger ---------------------------------------

create or replace function public.tg_recontar_comentarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
  set comment_count = (
    select count(*) from public.community_comments c
    where c.post_id = v_post and c.status = 'published'
  )
  where p.id = v_post;
  return coalesce(new, old);
end;
$$;

create trigger community_comments_recontar
  after insert or update or delete on public.community_comments
  for each row execute function public.tg_recontar_comentarios();

create or replace function public.tg_recontar_reacoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  if v_post is not null then
    update public.community_posts p
    set reaction_count = (select count(*) from public.community_reactions r where r.post_id = v_post)
    where p.id = v_post;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger community_reactions_recontar
  after insert or delete on public.community_reactions
  for each row execute function public.tg_recontar_reacoes();

/** A pessoa participa deste canal? */
create or replace function public.channel_is_visible(p_channel_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_channels c
    where c.id = p_channel_id
      and c.status = 'published'
      and (
        c.course_id is null                       -- canal geral
        or exists (
          select 1 from public.enrollments e
          where e.user_id = p_user_id
            and e.course_id = c.course_id
            and e.status in ('active', 'completed')
        )
      )
  );
$$;

grant execute on function public.channel_is_visible(uuid, uuid) to authenticated;

-- ===========================================================================
-- MENSAGENS
-- ===========================================================================

create table public.conversations (
  id             uuid primary key default gen_random_uuid(),
  subject        text,
  kind           public.conversation_kind not null default 'support',
  course_id      uuid references public.courses (id) on delete set null,
  activity_id    uuid references public.activities (id) on delete set null,
  created_by     uuid not null references public.profiles (id) on delete cascade,
  status         public.conversation_status not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index conversations_recentes_idx on public.conversations (last_message_at desc);
create index conversations_status_idx on public.conversations (status, last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  papel           text not null default 'aluna' check (papel in ('aluna', 'instrutora', 'suporte')),
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (length(trim(body)) between 1 and 5000),
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index messages_conversa_idx on public.messages (conversation_id, created_at);

create or replace function public.tg_conversa_toca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      status = case when status = 'resolved' then 'open' else status end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_tocam_conversa
  after insert on public.messages
  for each row execute function public.tg_conversa_toca();

/** Quantas conversas com mensagem não lida esta pessoa tem. */
create or replace function public.unread_conversations(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where cp.user_id = p_user_id
    and exists (
      select 1 from public.messages m
      where m.conversation_id = c.id
        and m.author_id <> p_user_id
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
    );
$$;

grant execute on function public.unread_conversations(uuid) to authenticated;

-- ===========================================================================
-- NOTIFICAÇÕES
-- ===========================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in (
               'aula_liberada', 'atividade_corrigida', 'mensagem', 'comunidade',
               'certificado', 'material_novo', 'aviso'
             )),
  title      text not null,
  body       text,
  url        text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_nao_lidas_idx on public.notifications (user_id) where read_at is null;

-- ===========================================================================
-- RLS
-- ===========================================================================

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'material_categories','library_materials','material_favorites','material_progress',
      'community_channels','community_posts','community_comments','community_reactions',
      'community_reports','conversations','conversation_participants','messages','notifications'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end;
$$;

-- --- Biblioteca -------------------------------------------------------------

create policy material_categories_read on public.material_categories
  for select to authenticated using (status = 'published');

-- A aluna só enxerga o material a que tem direito. A regra é a função.
create policy library_materials_read on public.library_materials
  for select to authenticated using (
    status = 'published'
    and (public.material_is_available(id, auth.uid()) or public.is_staff())
  );

create policy material_favorites_own on public.material_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy material_progress_own on public.material_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- Comunidade -------------------------------------------------------------

create policy community_channels_read on public.community_channels
  for select to authenticated using (public.channel_is_visible(id, auth.uid()));

create policy community_posts_read on public.community_posts
  for select to authenticated using (
    status = 'published'
    and public.channel_is_visible(channel_id, auth.uid())
  );

-- Publicar: precisa enxergar o canal, e o canal não pode ser só da equipe.
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.channel_is_visible(channel_id, auth.uid())
    and (
      public.is_staff()
      or not exists (
        select 1 from public.community_channels c
        where c.id = channel_id and c.somente_equipe
      )
    )
  );

-- Editar e apagar: só a própria publicação. Moderação é do staff.
create policy community_posts_update_own on public.community_posts
  for update to authenticated
  using (author_id = auth.uid() and status = 'published')
  with check (author_id = auth.uid());

create policy community_posts_delete_own on public.community_posts
  for delete to authenticated
  using (author_id = auth.uid());

create policy community_posts_staff on public.community_posts
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy community_comments_read on public.community_comments
  for select to authenticated using (
    status = 'published'
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and public.channel_is_visible(p.channel_id, auth.uid())
    )
  );

create policy community_comments_insert on public.community_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.status = 'published'
        and public.channel_is_visible(p.channel_id, auth.uid())
    )
  );

create policy community_comments_own on public.community_comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy community_comments_delete_own on public.community_comments
  for delete to authenticated using (author_id = auth.uid());

create policy community_comments_staff on public.community_comments
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy community_reactions_read on public.community_reactions
  for select to authenticated using (true);

create policy community_reactions_own on public.community_reactions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Denúncia: qualquer pessoa cria a própria; só o staff lê e resolve.
create policy community_reports_insert on public.community_reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy community_reports_staff on public.community_reports
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- --- Mensagens --------------------------------------------------------------

create policy conversations_participante on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
    or public.is_staff()
  );

create policy conversations_criar on public.conversations
  for insert to authenticated with check (created_by = auth.uid());

create policy conversations_staff on public.conversations
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy participantes_proprios on public.conversation_participants
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy participantes_marcar_lido on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mensagens_ler on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
    or public.is_staff()
  );

create policy mensagens_enviar on public.messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
      )
      or public.is_staff()
    )
  );

-- --- Notificações ------------------------------------------------------------

create policy notifications_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_marcar_lida on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===========================================================================
-- Canais iniciais
--
-- São CANAIS, não conteúdo: nenhuma publicação é semeada. A comunidade nasce
-- vazia, com estado vazio próprio.
-- ===========================================================================

insert into public.community_channels (name, slug, description, position, somente_equipe) values
  ('Geral',                 'geral',        'Conversa aberta entre as alunas.',                    10, false),
  ('Dúvidas',               'duvidas',      'Perguntas sobre as aulas e a prática.',               20, false),
  ('Trabalhos das alunas',  'trabalhos',    'Mostre o que você fez e receba retorno.',             30, false),
  ('Materiais',             'materiais',    'Indicações de produtos, marcas e fornecedores.',      40, false),
  ('Inspirações',           'inspiracoes',  'Referências visuais e ideias.',                       50, false),
  ('Resultados',            'resultados',   'Evolução, antes e depois, conquistas.',               60, false),
  ('Avisos da instrutora',  'avisos',       'Comunicados oficiais. Só a equipe publica.',           5, true)
on conflict (slug) do nothing;

-- Categorias da biblioteca — estrutura, sem material cadastrado.
insert into public.material_categories (name, slug, position) values
  ('Começando',      'comecando',      10),
  ('Técnica',        'tecnica',        20),
  ('Atendimento',    'atendimento',    30),
  ('Negócio',        'negocio',        40),
  ('Inspiração',     'inspiracao',     50)
on conflict (slug) do nothing;
