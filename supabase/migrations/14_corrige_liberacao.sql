-- ===========================================================================
-- 14 - CORREÇÃO DAS REGRAS DE LIBERAÇÃO
--
-- Três defeitos encontrados na validação em PostgreSQL real
-- (docs/validacao/03-liberacao.md):
--
-- 1. `after_previous_module` LIBERAVA o módulo seguinte mesmo com o anterior
--    intocado. Causa: `bool_and(lp.status = 'completed')` sobre um LEFT JOIN
--    sem progresso produz NULL (não false), e o `coalesce(..., true)` então
--    tratava "nenhum progresso" como "tudo concluído".
--
-- 2. Um pré-requisito de módulo SEM aulas publicadas bloqueava para sempre,
--    porque `bool_and` sobre conjunto vazio também é NULL e caía no
--    `coalesce(..., false)`.
--
-- 3. Nem `lesson_is_released` nem `module_is_released` verificavam o status do
--    CURSO. Uma aula publicada dentro de um curso em rascunho continuava
--    liberada para quem tivesse matrícula, e uma aula gratuita de um curso
--    não publicado ficava acessível publicamente.
--
-- A distinção que resolve 1 e 2: `coalesce(lp.status, 'not_started')` DENTRO
-- do bool_and separa "não concluído" (false) de "não existe aula" (conjunto
-- vazio → NULL → default explícito).
-- ===========================================================================

create or replace function public.module_is_released(p_module_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  e record;
  c_status public.publication_status;
  prev_done boolean;
begin
  select * into m from public.modules where id = p_module_id;
  if not found or m.status <> 'published' then
    return false;
  end if;

  -- O curso precisa estar publicado. Rascunho e arquivado não liberam nada.
  select status into c_status from public.courses where id = m.course_id;
  if c_status is distinct from 'published' then
    return false;
  end if;

  select * into e
  from public.enrollments
  where user_id = p_user_id and course_id = m.course_id;
  if not found then
    return false;
  end if;

  -- Pré-requisito explícito vale para qualquer modo.
  if m.prerequisite_module_id is not null then
    select coalesce(
             bool_and(coalesce(lp.status, 'not_started') = 'completed'),
             true  -- módulo de pré-requisito sem aulas publicadas: nada a cumprir
           ) into prev_done
    from public.lessons l
    left join public.lesson_progress lp
      on lp.lesson_id = l.id and lp.enrollment_id = e.id
    where l.module_id = m.prerequisite_module_id and l.status = 'published';

    if not prev_done then
      return false;
    end if;
  end if;

  case m.release_mode
    when 'immediate' then
      return true;

    when 'on_date' then
      return m.release_at <= now();

    when 'days_after_enrollment' then
      return e.starts_at + make_interval(days => m.release_days) <= now();

    when 'manual' then
      return exists (
        select 1 from public.manual_releases mr
        where mr.user_id = p_user_id and mr.module_id = m.id
      );

    when 'by_cohort' then
      return e.cohort_id is not null
        and e.cohort_id = m.release_cohort_id
        and exists (
          select 1 from public.cohorts c
          where c.id = e.cohort_id
            and (c.starts_at is null or c.starts_at <= now())
        );

    when 'after_previous_module' then
      select coalesce(
               bool_and(coalesce(lp.status, 'not_started') = 'completed'),
               true  -- não há módulo anterior, ou ele não tem aulas publicadas
             ) into prev_done
      from public.lessons l
      left join public.lesson_progress lp
        on lp.lesson_id = l.id and lp.enrollment_id = e.id
      where l.status = 'published'
        and l.module_id = (
          select p.id from public.modules p
          where p.course_id = m.course_id
            and p.status = 'published'
            and p.position < m.position
          order by p.position desc
          limit 1
        );
      return prev_done;

    when 'after_previous_lesson' then
      -- Não faz sentido em módulo; trata como imediato.
      return true;

    else
      return false;
  end case;
end;
$$;

create or replace function public.lesson_is_released(p_lesson_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  e record;
  c_status public.publication_status;
  prev_done boolean;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if not found or l.status <> 'published' then
    return false;
  end if;

  -- O curso precisa estar publicado, inclusive para a aula gratuita: uma
  -- degustação de curso em rascunho não pode circular.
  select status into c_status from public.courses where id = l.course_id;
  if c_status is distinct from 'published' then
    return false;
  end if;

  if l.is_free then
    return true;
  end if;

  if p_user_id is null then
    return false;
  end if;

  select * into e
  from public.enrollments
  where user_id = p_user_id and course_id = l.course_id;
  if not found or not public.enrollment_is_active(e.id) then
    return false;
  end if;

  if not public.module_is_released(l.module_id, p_user_id) then
    return false;
  end if;

  if l.prerequisite_lesson_id is not null then
    select (lp.status = 'completed') into prev_done
    from public.lesson_progress lp
    where lp.lesson_id = l.prerequisite_lesson_id and lp.enrollment_id = e.id;
    if not coalesce(prev_done, false) then
      return false;
    end if;
  end if;

  case l.release_mode
    when 'immediate' then
      return true;

    when 'on_date' then
      return l.release_at <= now();

    when 'days_after_enrollment' then
      return e.starts_at + make_interval(days => l.release_days) <= now();

    when 'manual' then
      return exists (
        select 1 from public.manual_releases mr
        where mr.user_id = p_user_id and mr.lesson_id = l.id
      );

    when 'by_cohort' then
      return e.cohort_id is not null and e.cohort_id = l.release_cohort_id;

    when 'after_previous_module' then
      return public.module_is_released(l.module_id, p_user_id);

    when 'after_previous_lesson' then
      select coalesce((lp.status = 'completed'), false) into prev_done
      from public.lessons prev
      left join public.lesson_progress lp
        on lp.lesson_id = prev.id and lp.enrollment_id = e.id
      where prev.module_id = l.module_id
        and prev.status = 'published'
        and prev.position < l.position
      order by prev.position desc
      limit 1;
      -- Primeira aula do módulo não tem anterior: libera.
      return coalesce(prev_done, true);

    else
      return false;
  end case;
end;
$$;

comment on function public.lesson_is_released(uuid, uuid) is
  'Única fonte da verdade sobre acesso a aula. A interface consulta esta função (via course_outline) e nunca reimplementa a regra.';
