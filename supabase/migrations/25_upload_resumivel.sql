-- ===========================================================================
-- 25 - UPLOAD RESUMÍVEL (TUS) E DESCRIÇÃO DA FORMAÇÃO
--
-- Três mudanças, todas aditivas. Nada do que já foi verificado é alterado:
-- o caminho continua {course_id}/{lesson_id}/{arquivo}, as policies de
-- storage.objects continuam como estão, e lesson_is_released segue intacta.
--
--   1. ESTADOS DO UPLOAD — o conjunto anterior descrevia só o começo e o fim.
--      Um envio que pode ser pausado e retomado tem estados no meio, e eles
--      precisam existir no banco, não só na memória do navegador.
--
--   2. RASTRO DO TUS — para retomar um envio depois de a aba fechar, é
--      preciso guardar a URL que o servidor de upload devolveu. Sem ela, "80%
--      enviados" vira "recomece do zero".
--
--   3. DESCRIÇÃO CURTA DA FORMAÇÃO — texto aprovado pela responsável. Entra
--      pelo banco, não pelo frontend. O curso CONTINUA em rascunho.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Estados
--
-- Os nomes seguem em português, como o resto do schema. O conjunto anterior
-- (pendente, concluido, cancelado, falhou, substituido) é preservado inteiro:
-- as verificações de docs/validacao/10-formacao.md dependem dele.
--
--   pendente    registro criado; os bytes ainda não começaram
--   enviando    transferência em andamento
--   pausado     interrompida por escolha ou por queda; retomável
--   validando   bytes no bucket; servidor conferindo a assinatura
--   concluido   arquivo validado e ligado à aula
--   falhou      recusado na validação ou erro definitivo
--   cancelado   abandonado por escolha explícita
--   substituido a aula trocou de vídeo; este arquivo ficou para trás
--   orfao       marcado pela limpeza administrativa
--   arquivado   fora de uso, guardado por histórico
-- ---------------------------------------------------------------------------

alter table public.lesson_video_uploads
  drop constraint if exists lesson_video_uploads_status_check;

alter table public.lesson_video_uploads
  add constraint lesson_video_uploads_status_check
  check (status in (
    'pendente', 'enviando', 'pausado', 'validando',
    'concluido', 'falhou', 'cancelado',
    'substituido', 'orfao', 'arquivado'
  ));

comment on column public.lesson_video_uploads.status is
  'Estado do envio. Fonte única em src/lib/video/estados.ts — não escrever a string solta pela aplicação.';

-- ---------------------------------------------------------------------------
-- 2. Rastro do TUS
--
-- `tus_url` é o endereço que o servidor de upload devolve na criação e que o
-- cliente reapresenta para retomar de onde parou. Não é segredo: sem sessão
-- válida ela não serve para nada, e vive poucas horas.
-- ---------------------------------------------------------------------------

alter table public.lesson_video_uploads
  add column if not exists tus_url text,
  add column if not exists bytes_enviados bigint
    check (bytes_enviados is null or bytes_enviados >= 0),
  add column if not exists expires_at timestamptz,
  add column if not exists tentativas integer not null default 0;

comment on column public.lesson_video_uploads.tus_url is
  'URL de retomada devolvida pelo servidor TUS. Guardada para que uma queda aos 80% não recomece do zero.';
comment on column public.lesson_video_uploads.expires_at is
  'Quando a sessão de upload deixa de aceitar retomada. Passado esse ponto, o envio recomeça.';

-- ---------------------------------------------------------------------------
-- Um envio ativo por aula.
--
-- Sem isto, dois cliques em "enviar" ou duas abas abertas criariam duas
-- transferências para a mesma aula, e a última a confirmar apagaria o rastro
-- da outra — deixando um arquivo órfão que ninguém procuraria.
-- ---------------------------------------------------------------------------

create unique index if not exists lesson_video_uploads_um_ativo_por_aula
  on public.lesson_video_uploads (lesson_id)
  where status in ('pendente', 'enviando', 'pausado', 'validando');

-- A limpeza também olha para os estados novos.
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
      when u.status = 'pendente'    then 'Envio registrado e nunca iniciado.'
      when u.status = 'enviando'    then 'Transferência interrompida e não retomada.'
      when u.status = 'pausado'     then 'Envio pausado e nunca retomado.'
      when u.status = 'validando'   then 'Arquivo chegou, mas a validação não terminou.'
      when u.status = 'substituido' then 'Vídeo trocado por outro; o arquivo antigo continua no bucket.'
      when u.status = 'falhou'      then 'Envio recusado na validação; o arquivo pode ter ficado no bucket.'
      else 'Envio interrompido.'
    end
  from public.lesson_video_uploads u
  where u.status in ('pendente', 'enviando', 'pausado', 'validando', 'substituido', 'falhou')
    and u.created_at < now() - make_interval(hours => p_older_than_hours)
  order by u.created_at;
$$;

comment on function public.orphan_lesson_videos(integer) is
  'Lista arquivos de vídeo sem aula apontando para eles. Só relata — nunca apaga.';

revoke all on function public.orphan_lesson_videos(integer) from public, anon, authenticated;
grant execute on function public.orphan_lesson_videos(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Uma aula com envio em aberto não pode ser publicada.
--
-- Publicar enquanto o vídeo ainda sobe entrega uma tela vazia para quem pagou.
-- A pergunta é feita ao banco para que painel e qualquer outro caminho de
-- escrita respondam igual.
-- ---------------------------------------------------------------------------

create or replace function public.lesson_video_is_ready(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- tem vídeo ligado…
    exists (
      select 1 from public.lessons l
      join public.media_assets m on m.id = l.video_asset_id
      where l.id = p_lesson_id and m.bucket = 'lesson-videos'
    )
    -- …e nenhum envio ainda em aberto para esta aula.
    and not exists (
      select 1 from public.lesson_video_uploads u
      where u.lesson_id = p_lesson_id
        and u.status in ('pendente', 'enviando', 'pausado', 'validando')
    );
$$;

comment on function public.lesson_video_is_ready(uuid) is
  'True quando a aula tem vídeo validado E nenhum envio em aberto. Pré-condição para publicar aula de vídeo.';

grant execute on function public.lesson_video_is_ready(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Descrição curta da formação
--
-- Texto aprovado pela responsável. Identifica a formação e destrava o cadastro
-- da estrutura — não promete resultado nem descreve conteúdo além dos
-- capítulos que existem.
--
-- O `where short_description is null` garante que uma reescrita feita no
-- painel nunca é sobrescrita por uma reexecução desta migration.
--
-- O STATUS NÃO É TOCADO. A formação continua em rascunho; publicar é decisão
-- da responsável, no painel.
-- ---------------------------------------------------------------------------

update public.courses
   set short_description =
       'Formação online organizada em oito capítulos para acompanhar diferentes etapas do desenvolvimento profissional em manicure e cuidados com unhas.'
 where slug = 'formacao'
   and short_description is null;
