-- ===========================================================================
-- 24 - UPLOAD DE VÍDEO DE AULA PELO PAINEL
--
-- O bucket `lesson-videos` já existe desde a migration 20 (privado, 5 GB,
-- MIME fechado) e as policies dele já estão corretas:
--
--   leitura  → storage_lesson_released(name) OU admin OU instrutora do curso
--   escrita  → admin OU instrutora do curso
--   caminho  → {course_id}/{lesson_id}/{arquivo}
--
-- Esta migration NÃO mexe nessas policies. Ela resolve o que faltava: o
-- RASTRO do upload.
--
-- POR QUE UM REGISTRO DE UPLOAD (§19 — não perder vídeo)
--
-- O envio vai do NAVEGADOR direto para o Storage, por URL assinada. O Next.js
-- não vê os bytes — é o que impede um vídeo de centenas de MB de atravessar
-- uma Server Action. O efeito colateral é que, entre "arquivo gravado no
-- bucket" e "aula apontando para ele", existe uma janela. Se a aba fechar ali
-- dentro, o arquivo fica no bucket sem dono: um órfão invisível.
--
-- A tabela abaixo fecha essa janela. A linha nasce ANTES do upload, com
-- status 'pendente'. Vira 'concluido' quando a aula passa a apontar para o
-- arquivo. Todo arquivo do bucket tem, portanto, uma linha correspondente —
-- e o que ficou para trás é consultável, retomável e limpável, em vez de
-- desaparecer.
--
-- O caminho não contém nome, e-mail nem telefone de ninguém: só UUIDs de
-- curso, aula e arquivo.
-- ===========================================================================

create table if not exists public.lesson_video_uploads (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,

  bucket       text not null default 'lesson-videos',
  -- {course_id}/{lesson_id}/{uuid}.{ext} — mesma convenção da policy 0020.
  path         text not null,

  file_name    text,                -- nome original, só para a tela do painel
  byte_size    bigint check (byte_size is null or byte_size > 0),
  mime_type    text,

  status       text not null default 'pendente'
               check (status in ('pendente', 'concluido', 'cancelado', 'falhou', 'substituido')),

  -- Preenchido quando o arquivo é promovido a media_asset e ligado à aula.
  media_id     uuid references public.media_assets (id) on delete set null,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),

  unique (bucket, path)
);

create index if not exists lesson_video_uploads_lesson_idx
  on public.lesson_video_uploads (lesson_id, created_at desc);

-- O índice que a rotina de limpeza usa: o que ficou para trás.
create index if not exists lesson_video_uploads_pendentes_idx
  on public.lesson_video_uploads (created_at)
  where status = 'pendente';

drop trigger if exists lesson_video_uploads_set_updated_at on public.lesson_video_uploads;
create trigger lesson_video_uploads_set_updated_at
  before update on public.lesson_video_uploads
  for each row execute function public.tg_set_updated_at();

comment on table public.lesson_video_uploads is
  'Rastro de cada envio de vídeo de aula. Nasce antes do upload para que nenhum arquivo fique órfão no bucket. Ver docs/22-upload-de-video.md.';

-- ---------------------------------------------------------------------------
-- RLS: conteúdo pago. Só quem pode enviar vídeo pode ver este rastro.
-- Aluna, comercial e financeiro não têm nada a ver com isso.
-- ---------------------------------------------------------------------------
alter table public.lesson_video_uploads enable row level security;

drop policy if exists lesson_video_uploads_equipe on public.lesson_video_uploads;
create policy lesson_video_uploads_equipe on public.lesson_video_uploads
  for all to authenticated
  using (public.is_admin() or public.instructor_teaches(course_id))
  with check (public.is_admin() or public.instructor_teaches(course_id));

-- ---------------------------------------------------------------------------
-- Uploads abandonados.
--
-- Não apaga nada: apenas RELATA. A remoção do objeto no bucket é um ato
-- administrativo explícito, feito no painel — apagar arquivo automaticamente
-- é exatamente o que "não perder vídeo" proíbe.
-- ---------------------------------------------------------------------------
create or replace function public.orphan_lesson_videos(p_older_than_hours integer default 24)
returns table (
  upload_id  uuid,
  lesson_id  uuid,
  course_id  uuid,
  bucket     text,
  path       text,
  file_name  text,
  byte_size  bigint,
  created_at timestamptz,
  motivo     text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id, u.lesson_id, u.course_id, u.bucket, u.path, u.file_name, u.byte_size, u.created_at,
    case
      when u.status = 'pendente' then 'Envio começou e nunca foi confirmado.'
      when u.status = 'substituido' then 'Vídeo trocado por outro; o arquivo antigo continua no bucket.'
      else 'Envio interrompido.'
    end
  from public.lesson_video_uploads u
  where u.status in ('pendente', 'substituido', 'falhou')
    and u.created_at < now() - make_interval(hours => p_older_than_hours)
  order by u.created_at;
$$;

comment on function public.orphan_lesson_videos(integer) is
  'Lista arquivos de vídeo sem aula apontando para eles. Só relata — nunca apaga.';

revoke all on function public.orphan_lesson_videos(integer) from public, anon, authenticated;
grant execute on function public.orphan_lesson_videos(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Arquivar aula em vez de excluir, quando há histórico de aluna.
--
-- Excluir uma aula publicada apaga o lesson_progress junto (on delete
-- cascade), ou seja: apaga o histórico de quem já assistiu. Esta função
-- decide pelo dado, não pela vontade de quem clicou.
-- ---------------------------------------------------------------------------
create or replace function public.lesson_has_student_history(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lesson_progress lp where lp.lesson_id = p_lesson_id
  );
$$;

comment on function public.lesson_has_student_history(uuid) is
  'True se alguma aluna já tem progresso nesta aula. O painel usa isto para exigir arquivamento em vez de exclusão.';

grant execute on function public.lesson_has_student_history(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Documentação do bucket, para o painel e a auditoria.
-- A linha de lesson-videos já existe desde a 0020; aqui só se acrescenta o
-- que mudou: quem envia agora é o painel, por URL assinada.
-- ---------------------------------------------------------------------------
update public.storage_buckets_doc
   set quem_envia = 'admin ou instrutora do curso, pelo painel (URL de upload assinada)',
       observacao = 'URL assinada de 15 min para leitura. O envio vai do navegador direto ao Storage; o servidor só assina. Rastro em lesson_video_uploads.'
 where bucket = 'lesson-videos';
