-- ===========================================================================
-- 20 - STORAGE: BUCKETS E POLICIES
--
-- Até aqui o projeto não tinha bucket nenhum e nenhuma regra de arquivo.
-- Qualquer vídeo ou PDF enviado ficaria sem proteção. Esta migration fecha
-- isso.
--
-- Princípios:
--   1. Bucket público SÓ para material institucional já publicado, e mesmo
--      assim apenas administradores enviam.
--   2. Tudo que envolve pessoa, pagamento ou conteúdo pago é PRIVADO e sai
--      por URL assinada de vida curta, gerada no servidor.
--   3. A policy valida o CAMINHO contra os relacionamentos do banco. Não
--      basta o nome do arquivo: `{user_id}/...` é conferido contra auth.uid(),
--      e `{course_id}/{lesson_id}/...` é conferido contra lesson_is_released().
--   4. Ninguém lista bucket privado.
--
-- Esta migration roda no Supabase, onde o schema `storage` já existe. No
-- ambiente local de teste ele é recriado por um shim
-- (scripts/homolog/00-auth-shim.sql), que NÃO faz parte do projeto.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helpers de caminho
-- ---------------------------------------------------------------------------

create or replace function public.path_segment(p_name text, p_index integer)
returns text
language sql
immutable
as $$
  select nullif((string_to_array(coalesce(p_name, ''), '/'))[p_index], '');
$$;

comment on function public.path_segment(text, integer) is
  'Segmento do caminho do arquivo, 1-indexado. Base das policies de Storage.';

-- Cast defensivo: um caminho malformado não pode derrubar a policy.
create or replace function public.try_uuid(p_texto text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_texto::uuid;
exception when others then
  return null;
end;
$$;

-- A pessoa é dona deste caminho? (`{user_id}/...`)
create or replace function public.storage_is_owner(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and public.try_uuid(public.path_segment(p_name, 1)) = auth.uid();
$$;

-- A aula referida pelo caminho `{course_id}/{lesson_id}/...` está liberada?
create or replace function public.storage_lesson_released(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lesson_is_released(
    public.try_uuid(public.path_segment(p_name, 2)),
    auth.uid()
  );
$$;

-- A instrutora leciona o curso dono deste caminho de entrega de atividade?
-- Caminho: student-submissions/{user_id}/{activity_id}/{arquivo}
create or replace function public.storage_instructor_of_submission(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.instructor_teaches(
    public.activity_course(public.try_uuid(public.path_segment(p_name, 2)))
  );
$$;

grant execute on function public.path_segment(text, integer) to anon, authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated;
grant execute on function public.storage_is_owner(text) to authenticated;
grant execute on function public.storage_lesson_released(text) to authenticated;
grant execute on function public.storage_instructor_of_submission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Buckets
--
-- file_size_limit em bytes. allowed_mime_types é uma lista fechada — o que
-- não estiver nela é recusado pelo próprio Storage, antes de qualquer policy.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- ---- PÚBLICOS: material institucional já publicado, só admin envia ------
  ('cms-media',           'cms-media',           true,   10485760,
   array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),

  ('course-covers',       'course-covers',       true,    5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),

  ('instructor-media',    'instructor-media',    true,    5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),

  -- ---- PRIVADOS ----------------------------------------------------------
  -- Conteúdo pago. Nunca sai por URL pública.
  ('lesson-videos',       'lesson-videos',       false, 5368709120,
   array['video/mp4','video/webm','video/quicktime']),

  ('lesson-assets',       'lesson-assets',       false,  104857600,
   array['application/pdf','image/jpeg','image/png','image/webp','application/zip']),

  -- Trabalho da aluna. Dado pessoal.
  ('student-submissions', 'student-submissions', false,  104857600,
   array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),

  -- Devolutiva da instrutora para uma aluna específica.
  ('submission-feedback', 'submission-feedback', false,   52428800,
   array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','application/pdf']),

  -- Certificado contém nome completo. Privado.
  ('certificates',        'certificates',        false,    5242880,
   array['application/pdf']),

  ('profile-avatars',     'profile-avatars',     false,    2097152,
   array['image/jpeg','image/png','image/webp']),

  -- Foto de aluna real: só sai por URL assinada e só se o depoimento estiver
  -- publicado, verificado e com consentimento.
  ('testimonials',        'testimonials',        false,    5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
--
-- `storage.objects` já vem com RLS ligada no Supabase — e a tabela pertence a
-- `supabase_storage_admin`, não ao `postgres`. Um `alter table` direto falha
-- com "must be owner of table objects" e derruba a migration inteira.
--
-- No PostgreSQL local usado nos testes (shim de scripts/homolog/) a tabela é
-- criada pelo `postgres`, então lá o alter funciona e é necessário. Daí o
-- bloco abaixo: liga a RLS onde é possível, e segue em frente onde ela já
-- está ligada por quem manda.
--
-- O que importa de verdade — CRIAR AS POLICIES — funciona nos dois ambientes:
-- o `postgres` do Supabase tem permissão para isso, mesmo sem ser dono.
-- ---------------------------------------------------------------------------

do $$
begin
  alter table storage.objects enable row level security;
exception
  when insufficient_privilege then
    raise notice 'storage.objects pertence a outro papel; RLS já está ligada pelo Supabase.';
end;
$$;

-- ===========================================================================
-- BUCKETS PÚBLICOS — leitura livre, escrita só de administrador
-- ===========================================================================

drop policy if exists "publico: leitura" on storage.objects;
create policy "publico: leitura"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('cms-media', 'course-covers', 'instructor-media'));

drop policy if exists "publico: admin escreve" on storage.objects;
create policy "publico: admin escreve"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('cms-media', 'course-covers', 'instructor-media')
    and public.is_admin()
  );

drop policy if exists "publico: admin substitui" on storage.objects;
create policy "publico: admin substitui"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('cms-media', 'course-covers', 'instructor-media') and public.is_admin())
  with check (bucket_id in ('cms-media', 'course-covers', 'instructor-media') and public.is_admin());

drop policy if exists "publico: admin apaga" on storage.objects;
create policy "publico: admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('cms-media', 'course-covers', 'instructor-media') and public.is_admin());

-- ===========================================================================
-- lesson-videos e lesson-assets — conteúdo pago
-- Caminho: {course_id}/{lesson_id}/{arquivo}
-- ===========================================================================

drop policy if exists "aula: leitura exige liberacao" on storage.objects;
create policy "aula: leitura exige liberacao"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('lesson-videos', 'lesson-assets')
    and (
      public.storage_lesson_released(name)
      or public.is_admin()
      or public.instructor_teaches(public.try_uuid(public.path_segment(name, 1)))
    )
  );

drop policy if exists "aula: apenas equipe envia" on storage.objects;
create policy "aula: apenas equipe envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('lesson-videos', 'lesson-assets')
    and (
      public.is_admin()
      or public.instructor_teaches(public.try_uuid(public.path_segment(name, 1)))
    )
  );

drop policy if exists "aula: apenas equipe altera" on storage.objects;
create policy "aula: apenas equipe altera"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('lesson-videos', 'lesson-assets')
    and (public.is_admin() or public.instructor_teaches(public.try_uuid(public.path_segment(name, 1))))
  )
  with check (
    bucket_id in ('lesson-videos', 'lesson-assets')
    and (public.is_admin() or public.instructor_teaches(public.try_uuid(public.path_segment(name, 1))))
  );

drop policy if exists "aula: apenas admin apaga" on storage.objects;
create policy "aula: apenas admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('lesson-videos', 'lesson-assets') and public.is_admin());

-- ===========================================================================
-- student-submissions — trabalho da aluna
-- Caminho: {user_id}/{activity_id}/{arquivo}
-- ===========================================================================

drop policy if exists "entrega: aluna le a propria" on storage.objects;
create policy "entrega: aluna le a propria"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'student-submissions'
    and (
      public.storage_is_owner(name)
      or public.is_admin()
      or public.storage_instructor_of_submission(name)
    )
  );

-- O `with check` prende o caminho ao auth.uid(): trocar o {user_id} no
-- caminho para gravar na pasta de outra aluna é recusado.
drop policy if exists "entrega: aluna envia na propria pasta" on storage.objects;
create policy "entrega: aluna envia na propria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'student-submissions'
    and public.storage_is_owner(name)
    and public.path_segment(name, 2) is not null
    and public.path_segment(name, 3) is not null
  );

drop policy if exists "entrega: aluna substitui a propria" on storage.objects;
create policy "entrega: aluna substitui a propria"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'student-submissions' and public.storage_is_owner(name))
  with check (bucket_id = 'student-submissions' and public.storage_is_owner(name));

drop policy if exists "entrega: aluna apaga a propria" on storage.objects;
create policy "entrega: aluna apaga a propria"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'student-submissions'
    and (public.storage_is_owner(name) or public.is_admin())
  );

-- ===========================================================================
-- submission-feedback — devolutiva da instrutora
-- Caminho: {user_id}/{submission_id}/{arquivo}
-- ===========================================================================

drop policy if exists "feedback: aluna le o proprio" on storage.objects;
create policy "feedback: aluna le o proprio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-feedback'
    and (public.storage_is_owner(name) or public.is_staff())
  );

drop policy if exists "feedback: equipe envia" on storage.objects;
create policy "feedback: equipe envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'submission-feedback' and public.is_staff());

drop policy if exists "feedback: equipe altera" on storage.objects;
create policy "feedback: equipe altera"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'submission-feedback' and public.is_staff())
  with check (bucket_id = 'submission-feedback' and public.is_staff());

drop policy if exists "feedback: admin apaga" on storage.objects;
create policy "feedback: admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'submission-feedback' and public.is_admin());

-- ===========================================================================
-- certificates — {user_id}/{certificate_id}.pdf
-- Escrita apenas pelo servidor (service role ignora RLS). Ninguém escreve
-- pelo cliente, nem a própria aluna.
-- ===========================================================================

drop policy if exists "certificado: aluna le o proprio" on storage.objects;
create policy "certificado: aluna le o proprio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (public.storage_is_owner(name) or public.is_admin())
  );

-- ===========================================================================
-- profile-avatars — {user_id}/{arquivo}
-- ===========================================================================

drop policy if exists "avatar: dono le" on storage.objects;
create policy "avatar: dono le"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-avatars' and (public.storage_is_owner(name) or public.is_staff()));

drop policy if exists "avatar: dono envia" on storage.objects;
create policy "avatar: dono envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars' and public.storage_is_owner(name));

drop policy if exists "avatar: dono substitui" on storage.objects;
create policy "avatar: dono substitui"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-avatars' and public.storage_is_owner(name))
  with check (bucket_id = 'profile-avatars' and public.storage_is_owner(name));

drop policy if exists "avatar: dono apaga" on storage.objects;
create policy "avatar: dono apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and (public.storage_is_owner(name) or public.is_admin()));

-- ===========================================================================
-- testimonials — foto de aluna real
-- Só administrador escreve. Leitura pelo cliente é negada por completo: o
-- site público recebe URL assinada gerada no servidor, e só quando o
-- depoimento estiver publicado, verificado e com consentimento registrado.
-- ===========================================================================

drop policy if exists "depoimento: admin gerencia" on storage.objects;
create policy "depoimento: admin gerencia"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'testimonials' and public.is_admin())
  with check (bucket_id = 'testimonials' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Registro das finalidades, para o painel e para auditoria
-- ---------------------------------------------------------------------------

create table if not exists public.storage_buckets_doc (
  bucket            text primary key,
  finalidade        text not null,
  publico           boolean not null,
  limite_bytes      bigint not null,
  estrutura_caminho text not null,
  quem_envia        text not null,
  quem_le           text not null,
  url_assinada_seg  integer,
  observacao        text
);

alter table public.storage_buckets_doc enable row level security;

drop policy if exists storage_doc_admin on public.storage_buckets_doc;
create policy storage_doc_admin on public.storage_buckets_doc
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.storage_buckets_doc
  (bucket, finalidade, publico, limite_bytes, estrutura_caminho, quem_envia, quem_le, url_assinada_seg, observacao)
values
  ('cms-media','Imagens da landing e institucionais já publicadas', true, 10485760,
   '{page_key}/{arquivo}','admin','qualquer pessoa', null,'Só material autorizado'),
  ('course-covers','Capa pública de curso', true, 5242880,
   '{course_id}/{arquivo}','admin','qualquer pessoa', null,'O site só exibe se o curso estiver publicado'),
  ('instructor-media','Retrato e capa da instrutora', true, 5242880,
   '{instructor_id}/{arquivo}','admin','qualquer pessoa', null,'O site só exibe se a instrutora estiver publicada'),
  ('lesson-videos','Vídeo de aula — conteúdo pago', false, 5368709120,
   '{course_id}/{lesson_id}/{arquivo}','admin ou instrutora do curso','quem tem a aula liberada', 900,
   'URL assinada de 15 min, gerada no servidor após checar matrícula e liberação'),
  ('lesson-assets','PDF e material de apoio da aula', false, 104857600,
   '{course_id}/{lesson_id}/{arquivo}','admin ou instrutora do curso','quem tem a aula liberada', 900, null),
  ('student-submissions','Fotos e vídeos da prática da aluna', false, 104857600,
   '{user_id}/{activity_id}/{arquivo}','a própria aluna','a aluna, a instrutora do curso e o admin', 600,
   'Dado pessoal. O caminho é preso ao auth.uid() pela policy'),
  ('submission-feedback','Devolutiva da instrutora', false, 52428800,
   '{user_id}/{submission_id}/{arquivo}','instrutora ou admin','a aluna dona e a equipe', 600, null),
  ('certificates','PDF do certificado', false, 5242880,
   '{user_id}/{certificate_id}.pdf','somente o servidor','a aluna dona e o admin', 300,
   'Contém nome completo'),
  ('profile-avatars','Foto de perfil', false, 2097152,
   '{user_id}/{arquivo}','a própria pessoa','a própria pessoa e a equipe', 600, null),
  ('testimonials','Foto de aluna em depoimento', false, 5242880,
   '{testimonial_id}/{arquivo}','admin','ninguém pelo cliente', 3600,
   'Só sai por URL assinada e só se o depoimento estiver publicado, verificado e consentido')
on conflict (bucket) do update set
  finalidade = excluded.finalidade,
  publico = excluded.publico,
  limite_bytes = excluded.limite_bytes,
  estrutura_caminho = excluded.estrutura_caminho,
  quem_envia = excluded.quem_envia,
  quem_le = excluded.quem_le,
  url_assinada_seg = excluded.url_assinada_seg,
  observacao = excluded.observacao;
