-- ===========================================================================
-- 10 - LOGICA DE NEGOCIO
-- Liberacao de conteudo, progresso, elegibilidade a certificado e publicacao
-- agendada. Tudo no banco para que painel, site e webhooks concordem.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A matricula esta valida agora?
-- ---------------------------------------------------------------------------
create or replace function public.enrollment_is_active(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.id = p_enrollment_id
      and e.status in ('active', 'completed')
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Um MODULO esta liberado para esta aluna?
-- ---------------------------------------------------------------------------
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
  prev_done boolean;
begin
  select * into m from public.modules where id = p_module_id;
  if not found or m.status <> 'published' then
    return false;
  end if;

  select * into e
  from public.enrollments
  where user_id = p_user_id and course_id = m.course_id;
  if not found then
    return false;
  end if;

  -- Pre-requisito explicito sempre vale, qualquer que seja o modo.
  if m.prerequisite_module_id is not null then
    select coalesce(bool_and(lp.status = 'completed'), false) into prev_done
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
      -- Modulo anterior na ordem do curso precisa estar concluido.
      select coalesce(bool_and(lp.status = 'completed'), true) into prev_done
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
      -- Nao faz sentido em modulo; trata como imediato.
      return true;

    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uma AULA esta liberada para esta aluna?
-- Aula gratuita e liberada sem matricula (degustacao na pagina de vendas).
-- ---------------------------------------------------------------------------
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
  prev_done boolean;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if not found or l.status <> 'published' then
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

  -- O modulo precisa estar liberado antes da aula.
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
      -- Primeira aula do modulo nao tem anterior: libera.
      return coalesce(prev_done, true);

    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recalcula o progresso da matricula.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_enrollment_progress(p_enrollment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_done  integer;
  v_pct   numeric(5, 2);
  v_course uuid;
begin
  select course_id into v_course from public.enrollments where id = p_enrollment_id;
  if v_course is null then
    return 0;
  end if;

  select count(*) into v_total
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.course_id = v_course and l.status = 'published' and m.status = 'published';

  select count(*) into v_done
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.enrollment_id = p_enrollment_id
    and lp.status = 'completed'
    and l.status = 'published'
    and m.status = 'published';

  v_pct := case when v_total = 0 then 0 else round((v_done::numeric * 100) / v_total, 2) end;

  update public.enrollments
  set progress_pct = v_pct,
      last_activity_at = now(),
      completed_at = case
        when v_total > 0 and v_done = v_total and completed_at is null then now()
        else completed_at
      end,
      status = case
        when v_total > 0 and v_done = v_total and status = 'active' then 'completed'
        else status
      end
  where id = p_enrollment_id;

  return v_pct;
end;
$$;

create or replace function public.tg_lesson_progress_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_enrollment_progress(coalesce(new.enrollment_id, old.enrollment_id));
  return coalesce(new, old);
end;
$$;

create trigger lesson_progress_recalc
  after insert or update or delete on public.lesson_progress
  for each row execute function public.tg_lesson_progress_recalc();

-- ---------------------------------------------------------------------------
-- A aluna cumpriu os criterios de conclusao definidos no curso?
-- Os criterios sao editaveis; enquanto nao forem definidos, vale o default
-- conservador de 100% de progresso.
-- ---------------------------------------------------------------------------
create or replace function public.is_eligible_for_certificate(p_enrollment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e record;
  c record;
  crit jsonb;
  min_pct numeric;
  need_assess boolean;
  need_acts boolean;
  min_score numeric;
  ok boolean;
begin
  select * into e from public.enrollments where id = p_enrollment_id;
  if not found then return false; end if;

  select * into c from public.courses where id = e.course_id;
  if not found or not c.certificate_enabled then return false; end if;

  crit := c.completion_criteria;
  min_pct     := coalesce((crit ->> 'min_progress_pct')::numeric, 100);
  need_assess := coalesce((crit ->> 'require_all_assessments')::boolean, false);
  need_acts   := coalesce((crit ->> 'require_all_activities')::boolean, false);
  min_score   := (crit ->> 'min_score')::numeric;

  if e.progress_pct < min_pct then
    return false;
  end if;

  if need_assess then
    select coalesce(bool_and(passed_any), false) into ok
    from (
      select exists (
        select 1 from public.assessment_attempts at
        where at.assessment_id = a.id
          and at.user_id = e.user_id
          and at.passed
          and (min_score is null or at.score >= min_score)
      ) as passed_any
      from public.assessments a
      where a.status = 'published'
        and a.is_required_for_completion
        and (a.course_id = e.course_id
             or a.module_id in (select id from public.modules where course_id = e.course_id)
             or a.lesson_id in (select id from public.lessons where course_id = e.course_id))
    ) s;
    if not ok then return false; end if;
  end if;

  if need_acts then
    select coalesce(bool_and(approved), false) into ok
    from (
      select exists (
        select 1 from public.activity_submissions sub
        where sub.activity_id = act.id
          and sub.user_id = e.user_id
          and sub.status = 'approved'
      ) as approved
      from public.activities act
      where act.status = 'published'
        and act.is_required_for_completion
        and (act.course_id = e.course_id
             or act.module_id in (select id from public.modules where course_id = e.course_id)
             or act.lesson_id in (select id from public.lessons where course_id = e.course_id))
    ) s;
    if not ok then return false; end if;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Emite o certificado (idempotente).
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(p_enrollment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  c record;
  p record;
  v_id uuid;
  v_code text;
begin
  select id into v_id from public.certificates where enrollment_id = p_enrollment_id;
  if v_id is not null then
    return v_id;
  end if;

  if not public.is_eligible_for_certificate(p_enrollment_id) then
    raise exception 'Matricula % ainda nao cumpre os criterios de conclusao.', p_enrollment_id
      using errcode = 'check_violation';
  end if;

  select * into e from public.enrollments where id = p_enrollment_id;
  select * into c from public.courses where id = e.course_id;
  select * into p from public.profiles where id = e.user_id;

  v_code := upper(encode(gen_random_bytes(6), 'hex'));

  insert into public.certificates (
    enrollment_id, user_id, course_id, code, student_name, course_name,
    workload_minutes, validation_hash
  )
  values (
    p_enrollment_id, e.user_id, e.course_id, v_code,
    coalesce(p.full_name, p.display_name, 'Aluna'),
    c.name, c.workload_minutes,
    encode(digest(v_code || p_enrollment_id::text, 'sha256'), 'hex')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publicacao agendada. Chamada por cron (Vercel Cron ou pg_cron).
-- ---------------------------------------------------------------------------
create or replace function public.publish_scheduled_content()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_courses int; n_modules int; n_lessons int; n_pages int; n_sections int; n_offers int;
begin
  with u as (
    update public.courses set status = 'published'
    where status = 'scheduled' and published_at <= now() returning 1
  ) select count(*) into n_courses from u;

  with u as (
    update public.modules set status = 'published'
    where status = 'scheduled' and published_at <= now() returning 1
  ) select count(*) into n_modules from u;

  with u as (
    update public.lessons set status = 'published'
    where status = 'scheduled' and published_at <= now() returning 1
  ) select count(*) into n_lessons from u;

  with u as (
    update public.cms_pages set status = 'published', published_at = now()
    where status = 'scheduled' and scheduled_for <= now() returning 1
  ) select count(*) into n_pages from u;

  with u as (
    update public.cms_sections set status = 'published', content = draft_content, published_at = now()
    where status = 'scheduled' and scheduled_for <= now() returning 1
  ) select count(*) into n_sections from u;

  with u as (
    update public.offers set status = 'published'
    where status = 'scheduled' and starts_at <= now() and price_cents is not null returning 1
  ) select count(*) into n_offers from u;

  return jsonb_build_object(
    'courses', n_courses, 'modules', n_modules, 'lessons', n_lessons,
    'pages', n_pages, 'sections', n_sections, 'offers', n_offers, 'at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Expira matriculas vencidas.
-- ---------------------------------------------------------------------------
create or replace function public.expire_enrollments()
returns integer
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.enrollments
    set status = 'expired'
    where status = 'active' and expires_at is not null and expires_at < now()
    returning 1
  ) select count(*)::int from u;
$$;

-- ---------------------------------------------------------------------------
-- Visao que o front usa para montar a arvore do curso ja com o gate aplicado.
-- ---------------------------------------------------------------------------
create or replace function public.course_outline(p_course_id uuid, p_user_id uuid default null)
returns table (
  module_id uuid,
  module_name text,
  module_position integer,
  module_released boolean,
  lesson_id uuid,
  lesson_title text,
  lesson_position integer,
  lesson_type public.content_type,
  lesson_duration integer,
  lesson_is_free boolean,
  lesson_released boolean,
  lesson_status public.lesson_progress_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.name, m.position,
    case when p_user_id is null then false else public.module_is_released(m.id, p_user_id) end,
    l.id, l.title, l.position, l.content_type, l.duration_seconds, l.is_free,
    case when p_user_id is null then l.is_free else public.lesson_is_released(l.id, p_user_id) end,
    coalesce(lp.status, 'not_started'::public.lesson_progress_status)
  from public.modules m
  left join public.lessons l
    on l.module_id = m.id and l.status = 'published'
  left join public.enrollments e
    on e.course_id = m.course_id and e.user_id = p_user_id
  left join public.lesson_progress lp
    on lp.lesson_id = l.id and lp.enrollment_id = e.id
  where m.course_id = p_course_id and m.status = 'published'
  order by m.position, l.position;
$$;
