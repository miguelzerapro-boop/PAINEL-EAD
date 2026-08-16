-- ===========================================================================
-- 17 - PERGUNTAS DO DIAGNÓSTICO
--
-- As perguntas NÃO são conteúdo pedagógico do curso: são o roteiro de
-- qualificação do lead, e foram aprovadas no escopo. Entram aqui como dados,
-- 100% editáveis pelo painel — nenhum texto fica preso em componente.
--
-- Nenhuma pergunta cita técnica, módulo, carga horária ou nome de curso.
-- A pergunta 4 fala de INTERESSE, não de grade: as opções descrevem temas
-- genéricos da profissão e não prometem que exista formação sobre eles.
--
-- Também adiciona: limite configurável de múltipla escolha, captura de
-- cidade/estado e versionamento (rascunho → publicação → histórico).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.quiz_questions
  add column if not exists min_selections integer not null default 1,
  add column if not exists max_selections integer,
  add column if not exists status public.publication_status not null default 'published';

comment on column public.quiz_questions.max_selections is
  'Limite de alternativas em perguntas de múltipla escolha. NULL = sem limite. Editável pelo painel.';

-- `version` passa a significar "número de publicações": 0 = nunca publicado,
-- 1 = primeira versão no ar. Antes começava em 1 sem nunca ter sido publicado.
alter table public.quizzes alter column version set default 0;
update public.quizzes set version = 0 where published_at is null;

alter table public.quizzes
  add column if not exists collect_city boolean not null default true,
  add column if not exists collect_state boolean not null default true,
  add column if not exists collect_first_name_only boolean not null default true,
  add column if not exists result_headline text;

alter table public.leads
  add column if not exists city text,
  add column if not exists state text;

create index if not exists leads_city_idx on public.leads (state, city);

-- ---------------------------------------------------------------------------
-- Versionamento: snapshot, publicação e histórico
-- ---------------------------------------------------------------------------

create or replace function public.quiz_snapshot(p_quiz_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'quiz', (select to_jsonb(q) from public.quizzes q where q.id = p_quiz_id),
    'perguntas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pergunta', to_jsonb(qq),
               'opcoes', coalesce((
                 select jsonb_agg(to_jsonb(qo) order by qo.position)
                 from public.quiz_options qo where qo.question_id = qq.id
               ), '[]'::jsonb)
             ) order by qq.position)
      from public.quiz_questions qq where qq.quiz_id = p_quiz_id
    ), '[]'::jsonb),
    'resultados', coalesce((
      select jsonb_agg(to_jsonb(qc) order by qc.position)
      from public.quiz_outcomes qc where qc.quiz_id = p_quiz_id
    ), '[]'::jsonb)
  );
$$;

comment on function public.quiz_snapshot(uuid) is
  'Fotografia completa do quiz (perguntas, opções e resultados) usada no histórico de versões.';

create or replace function public.publish_quiz(p_quiz_id uuid, p_nota text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_versao integer;
  v_perguntas integer;
  v_ator uuid := auth.uid();
  v_nome text;
begin
  if v_ator is not null and not public.is_admin() then
    raise exception 'Somente administradores podem publicar o diagnóstico.'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_perguntas
  from public.quiz_questions
  where quiz_id = p_quiz_id and status = 'published';

  if v_perguntas = 0 then
    raise exception 'O diagnóstico não pode ser publicado sem nenhuma pergunta publicada.'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.quiz_outcomes where quiz_id = p_quiz_id) then
    raise exception 'O diagnóstico não pode ser publicado sem resultados cadastrados.'
      using errcode = 'check_violation';
  end if;

  update public.quizzes
  set status = 'published',
      published_at = now(),
      version = version + 1
  where id = p_quiz_id
  returning version into v_versao;

  select coalesce(display_name, full_name, 'servidor') into v_nome
  from public.profiles where id = v_ator;

  insert into public.cms_revisions (entity_type, entity_id, version, action, snapshot, actor_id, actor_name, note)
  values ('quizzes', p_quiz_id, v_versao, 'publish', public.quiz_snapshot(p_quiz_id), v_ator,
          coalesce(v_nome, 'servidor'), p_nota);

  return v_versao;
end;
$$;

create or replace function public.unpublish_quiz(p_quiz_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Somente administradores podem despublicar o diagnóstico.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.quizzes set status = 'draft' where id = p_quiz_id;

  insert into public.cms_revisions (entity_type, entity_id, version, action, snapshot, actor_id, actor_name)
  select 'quizzes', p_quiz_id, version, 'unpublish', public.quiz_snapshot(p_quiz_id), auth.uid(), 'painel'
  from public.quizzes where id = p_quiz_id;
end;
$$;

revoke execute on function public.publish_quiz(uuid, text) from anon;
revoke execute on function public.unpublish_quiz(uuid) from anon;
grant execute on function public.publish_quiz(uuid, text) to authenticated;
grant execute on function public.unpublish_quiz(uuid) to authenticated;
grant execute on function public.quiz_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Conteúdo das perguntas
--
-- Os pesos (`quiz_options.weights`) ligam cada alternativa aos cinco
-- resultados já cadastrados. A soma decide o resultado. Tudo editável.
-- ---------------------------------------------------------------------------

do $$
declare
  v_quiz uuid;
  v_q uuid;
begin
  select id into v_quiz from public.quizzes where slug = 'diagnostico';
  if v_quiz is null then
    raise notice 'Quiz "diagnostico" não encontrado — perguntas não inseridas.';
    return;
  end if;

  -- Idempotência: se já houver pergunta, não duplica.
  if exists (select 1 from public.quiz_questions where quiz_id = v_quiz) then
    raise notice 'Perguntas do diagnóstico já cadastradas — nada a fazer.';
    return;
  end if;

  update public.quizzes
  set intro_title = 'Vamos entender o seu momento',
      intro_body  = 'São 7 perguntas rápidas. Não existe resposta certa — só a sua situação de hoje.',
      consent_text = 'Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade.',
      result_headline = 'Seu momento na profissão'
  where id = v_quiz;

  -- ---- 1 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'Qual dessas opções mais combina com o seu momento atual?', 'single', true, 10)
  returning id into v_q;

  -- Peso 5 nesta pergunta, contra 1–3 nas demais: ela é a ÂNCORA. É a única
  -- em que a pessoa declara o momento diretamente; as outras seis descrevem
  -- desejo e dificuldade, que variam dentro do mesmo momento. Sem essa
  -- diferença, alguém que já trabalha e respondeu tudo sobre técnica era
  -- classificada como "quero evoluir" (verificado em docs/validacao/05-quiz.md).
  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Nunca trabalhei com unhas e quero começar do zero', 'nunca-trabalhei',
     '{"comecar_do_zero": 5}'::jsonb, 10),
    (v_q, 'Faço minhas unhas ou as de pessoas próximas', 'faco-para-proximos',
     '{"praticar_evoluir": 5, "comecar_do_zero": 1}'::jsonb, 20),
    (v_q, 'Já trabalho como manicure tradicional', 'manicure-tradicional',
     '{"ja_trabalho": 5, "praticar_evoluir": 1}'::jsonb, 30),
    (v_q, 'Já trabalho como nail designer e quero me aperfeiçoar', 'nail-designer',
     '{"ja_trabalho": 5, "praticar_evoluir": 2}'::jsonb, 40),
    (v_q, 'Já trabalhei na área e quero voltar', 'quero-voltar',
     '{"praticar_evoluir": 3, "ja_trabalho": 2, "comecar_do_zero": 2}'::jsonb, 50);

  -- ---- 2 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'O que você mais deseja conquistar com essa profissão?', 'single', true, 20)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Ter uma renda extra', 'renda-extra',
     '{"comecar_do_zero": 1, "praticar_evoluir": 1}'::jsonb, 10),
    (v_q, 'Transformar a manicure na minha principal profissão', 'profissao-principal',
     '{"organizar_carreira": 2, "ja_trabalho": 1}'::jsonb, 20),
    (v_q, 'Melhorar minha técnica e atender com mais confiança', 'tecnica-confianca',
     '{"praticar_evoluir": 2}'::jsonb, 30),
    (v_q, 'Aumentar meu preço e atrair mais clientes', 'preco-clientes',
     '{"organizar_carreira": 2, "ja_trabalho": 1}'::jsonb, 40),
    (v_q, 'Abrir ou organizar meu próprio espaço', 'proprio-espaco',
     '{"organizar_carreira": 3}'::jsonb, 50),
    (v_q, 'Aprender por realização pessoal', 'realizacao-pessoal',
     '{"comecar_do_zero": 1, "pesquisando": 1}'::jsonb, 60);

  -- ---- 3 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'Qual é a sua maior dificuldade hoje?', 'single', true, 30)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Não sei por onde começar', 'por-onde-comecar', '{"comecar_do_zero": 2}'::jsonb, 10),
    (v_q, 'Tenho medo de não conseguir aprender', 'medo-de-nao-aprender', '{"comecar_do_zero": 2}'::jsonb, 20),
    (v_q, 'Não sei quais materiais comprar', 'quais-materiais', '{"comecar_do_zero": 2}'::jsonb, 30),
    (v_q, 'Tenho dificuldade com técnica e acabamento', 'tecnica-acabamento', '{"praticar_evoluir": 2}'::jsonb, 40),
    (v_q, 'Quero aprender técnicas mais atuais', 'tecnicas-atuais',
     '{"praticar_evoluir": 2, "ja_trabalho": 1}'::jsonb, 50),
    (v_q, 'Não sei quanto cobrar', 'quanto-cobrar', '{"organizar_carreira": 2}'::jsonb, 60),
    (v_q, 'Tenho dificuldade para conseguir clientes', 'conseguir-clientes', '{"organizar_carreira": 2}'::jsonb, 70),
    (v_q, 'Não consigo organizar agenda, materiais e finanças', 'organizacao',
     '{"organizar_carreira": 2}'::jsonb, 80);

  -- ---- 4 (múltipla escolha, limite configurável) ---------------------------
  insert into public.quiz_questions (quiz_id, prompt, help_text, type, is_required, min_selections, max_selections, position)
  values (v_quiz, 'O que você tem mais interesse em aprender?',
          'Pode marcar mais de uma.', 'multiple', true, 1, 3, 40)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Fundamentos para começar', 'fundamentos', '{"comecar_do_zero": 2}'::jsonb, 10),
    (v_q, 'Melhorar técnica e acabamento', 'melhorar-tecnica', '{"praticar_evoluir": 2}'::jsonb, 20),
    (v_q, 'Técnicas modernas', 'tecnicas-modernas', '{"praticar_evoluir": 2}'::jsonb, 30),
    (v_q, 'Decorações', 'decoracoes', '{"praticar_evoluir": 1}'::jsonb, 40),
    (v_q, 'Atendimento e experiência da cliente', 'atendimento',
     '{"organizar_carreira": 1, "ja_trabalho": 1}'::jsonb, 50),
    (v_q, 'Preços e organização', 'precos-organizacao', '{"organizar_carreira": 2}'::jsonb, 60),
    (v_q, 'Divulgação e captação de clientes', 'divulgacao', '{"organizar_carreira": 2}'::jsonb, 70),
    (v_q, 'Quero conhecer uma formação completa', 'formacao-completa', '{"pesquisando": 1}'::jsonb, 80);

  -- ---- 5 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'Quanto tempo você conseguiria reservar para estudar e praticar por semana?', 'single', true, 50)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Menos de 1 hora', 'menos-1h', '{"pesquisando": 1}'::jsonb, 10),
    (v_q, 'De 1 a 2 horas', '1-2h', '{}'::jsonb, 20),
    (v_q, 'De 3 a 5 horas', '3-5h', '{"praticar_evoluir": 1}'::jsonb, 30),
    (v_q, 'Mais de 5 horas', 'mais-5h', '{"praticar_evoluir": 1, "organizar_carreira": 1}'::jsonb, 40),
    (v_q, 'Minha rotina varia muito', 'varia', '{"pesquisando": 1}'::jsonb, 50);

  -- ---- 6 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'Quando você gostaria de começar?', 'single', true, 60)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Quero começar agora', 'agora', '{}'::jsonb, 10),
    (v_q, 'Nos próximos 30 dias', '30-dias', '{}'::jsonb, 20),
    (v_q, 'Nos próximos 3 meses', '3-meses', '{"pesquisando": 1}'::jsonb, 30),
    (v_q, 'Ainda estou pesquisando', 'pesquisando', '{"pesquisando": 3}'::jsonb, 40);

  -- ---- 7 ------------------------------------------------------------------
  insert into public.quiz_questions (quiz_id, prompt, type, is_required, position)
  values (v_quiz, 'Qual estrutura você possui atualmente?', 'single', true, 70)
  returning id into v_q;

  insert into public.quiz_options (question_id, label, value, weights, position) values
    (v_q, 'Ainda não tenho materiais', 'sem-materiais', '{"comecar_do_zero": 2}'::jsonb, 10),
    (v_q, 'Tenho apenas alguns materiais básicos', 'materiais-basicos',
     '{"comecar_do_zero": 1, "praticar_evoluir": 1}'::jsonb, 20),
    (v_q, 'Já possuo materiais para trabalhar', 'materiais-completos',
     '{"praticar_evoluir": 1, "ja_trabalho": 1}'::jsonb, 30),
    (v_q, 'Já tenho um espaço de atendimento', 'espaco-proprio',
     '{"ja_trabalho": 2, "organizar_carreira": 1}'::jsonb, 40),
    (v_q, 'Atendo em salão ou espaço de outra pessoa', 'espaco-terceiro',
     '{"ja_trabalho": 2}'::jsonb, 50),
    (v_q, 'Prefiro explicar minha situação pelo WhatsApp', 'explicar-whatsapp',
     '{"pesquisando": 1}'::jsonb, 60);

  -- Publica a primeira versão e grava no histórico.
  perform public.publish_quiz(v_quiz, 'Versão inicial das perguntas, conforme o escopo aprovado.');
end;
$$;
