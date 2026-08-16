-- ===========================================================================
-- 19 - SEGMENTAÇÃO COM PERGUNTA-ÂNCORA
--
-- Problema encontrado no E2E (docs/validacao/07-e2e.md): a soma simples de
-- pesos classificava como "já pratico e quero evoluir" alguém que respondeu
-- na pergunta 1 que **já trabalha como manicure**. Bastava marcar duas ou três
-- alternativas sobre técnica para o desejo sobrepujar o fato.
--
-- Aumentar o peso da pergunta 1 não resolve: com peso alto demais, quem já
-- trabalha nunca é classificada como "quero organizar minha carreira", que é
-- um momento legítimo e diferente.
--
-- Modelo correto: a pergunta 1 é a ÂNCORA — é a única em que a pessoa declara
-- o momento. As outras seis descrevem desejo e dificuldade, que variam dentro
-- do mesmo momento. Elas só derrubam a âncora se abrirem uma margem
-- configurável.
--
-- Também move a soma para o banco. Antes ela vivia em `scoreAnswers()` no
-- TypeScript, o que significava duas implementações da mesma regra.
-- ===========================================================================

alter table public.quiz_questions
  add column if not exists is_anchor boolean not null default false;

comment on column public.quiz_questions.is_anchor is
  'Pergunta que declara o momento da pessoa. O resultado dela só é derrubado se outro resultado abrir a margem definida em quizzes.override_margin.';

alter table public.quizzes
  add column if not exists override_margin integer not null default 2;

comment on column public.quizzes.override_margin is
  'Quantos pontos outro resultado precisa ter A MAIS que o da pergunta-âncora para vencer. 0 = soma simples.';

-- A primeira pergunta do diagnóstico é a âncora.
update public.quiz_questions
set is_anchor = true
where position = 10
  and quiz_id = (select id from public.quizzes where slug = 'diagnostico');

-- ---------------------------------------------------------------------------
-- Segmentação: fonte única da verdade
-- ---------------------------------------------------------------------------

create or replace function public.quiz_scores(p_quiz_id uuid, p_values text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(chave, total), '{}'::jsonb)
  from (
    select p.key as chave, sum((p.value)::numeric) as total
    from public.quiz_options o
    join public.quiz_questions qq on qq.id = o.question_id
    cross join lateral jsonb_each_text(o.weights) as p(key, value)
    where qq.quiz_id = p_quiz_id
      and o.value = any(p_values)
    group by p.key
  ) s;
$$;

create or replace function public.quiz_segment(p_quiz_id uuid, p_values text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scores jsonb;
  v_margem integer;
  v_ancora text;
  v_ancora_pontos numeric;
  v_lider text;
  v_lider_pontos numeric;
begin
  v_scores := public.quiz_scores(p_quiz_id, p_values);
  if v_scores = '{}'::jsonb then
    return null;
  end if;

  select override_margin into v_margem from public.quizzes where id = p_quiz_id;

  -- Resultado que a pergunta-âncora aponta (maior peso da alternativa marcada).
  select p.key into v_ancora
  from public.quiz_options o
  join public.quiz_questions qq on qq.id = o.question_id
  cross join lateral jsonb_each_text(o.weights) as p(key, value)
  where qq.quiz_id = p_quiz_id
    and qq.is_anchor
    and o.value = any(p_values)
  order by (p.value)::numeric desc
  limit 1;

  -- Líder da soma total.
  select p.key, (p.value)::numeric into v_lider, v_lider_pontos
  from jsonb_each_text(v_scores) as p(key, value)
  order by (p.value)::numeric desc
  limit 1;

  if v_ancora is null then
    return v_lider; -- diagnóstico sem âncora: soma simples
  end if;

  v_ancora_pontos := coalesce((v_scores ->> v_ancora)::numeric, 0);

  -- O líder só derruba a âncora se abrir a margem exigida.
  if v_lider is distinct from v_ancora and (v_lider_pontos - v_ancora_pontos) >= v_margem then
    return v_lider;
  end if;

  return v_ancora;
end;
$$;

comment on function public.quiz_segment(uuid, text[]) is
  'Fonte única da segmentação. A aplicação chama via RPC; os testes chamam direto. A regra não é reimplementada em JavaScript.';

grant execute on function public.quiz_scores(uuid, text[]) to anon, authenticated;
grant execute on function public.quiz_segment(uuid, text[]) to anon, authenticated;
