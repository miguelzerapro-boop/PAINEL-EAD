-- ===========================================================================
-- 28 - ACESSO POR PACOTE
--
-- Três ofertas dão acesso a conjuntos DIFERENTES de capítulos do MESMO curso.
-- Não existem três cursos: existe a Formação, e o que muda é o direito.
--
--   Iniciante    R$ 29,90  →  capítulos 1, 3, 4          (3 de 8)
--   Profissional R$ 39,90  →  capítulos 1, 2, 3, 4, 5, 6 (6 de 8)
--   Completo     R$ 54,90  →  capítulos 1 a 8            (8 de 8)
--
-- A matrícula continua sendo por CURSO (`enrollments.course_id`), uma só por
-- aluna. O que a oferta comprada muda é quais módulos ela pode abrir.
--
-- ---------------------------------------------------------------------------
-- A REGRA QUE PRESERVA OS TESTES ANTIGOS
--
-- `lesson_is_released` e `module_is_released` têm 44 verificações passando, e
-- nenhuma delas conhece pacote. Se a restrição valesse sempre, toda matrícula
-- existente — manual, presente, importada, e todas as dos testes — perderia
-- acesso de uma vez.
--
-- Por isso a regra é CONDICIONAL: o pacote só restringe quando existe pacote
-- configurado para aquele curso. Sem nenhuma linha em `offer_module_access`
-- apontando para os módulos do curso, o comportamento é exatamente o de
-- antes. É o que permite acrescentar a regra sem reescrever o passado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A matriz: oferta → módulos
--
-- Tabela própria, e não uma coluna em `offers`, porque a relação é n:n e
-- precisa ser editável sem migration: trocar um capítulo de pacote, criar um
-- quarto pacote ou montar uma promoção é inserir e apagar linha.
-- ---------------------------------------------------------------------------

create table if not exists public.offer_module_access (
  offer_id   uuid not null references public.offers (id) on delete cascade,
  module_id  uuid not null references public.modules (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, module_id)
);

create index if not exists offer_module_access_module_idx
  on public.offer_module_access (module_id);

comment on table public.offer_module_access is
  'Quais capítulos cada oferta libera. Fonte da verdade do acesso por pacote — nunca escrever a matriz no código.';

alter table public.offer_module_access enable row level security;

-- Leitura pública: a landing precisa montar a comparação dos planos, e a área
-- da aluna precisa dizer "disponível no plano Completo". Não há dado pessoal
-- aqui — é a tabela de preços, em outra forma.
drop policy if exists offer_module_access_leitura on public.offer_module_access;
create policy offer_module_access_leitura on public.offer_module_access
  for select to anon, authenticated using (true);

drop policy if exists offer_module_access_admin on public.offer_module_access;
create policy offer_module_access_admin on public.offer_module_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Quais ofertas esta pessoa comprou para este curso.
--
-- Considera TODOS os pedidos pagos, não apenas o que originou a matrícula.
-- É o que faz o upgrade funcionar: quem comprou Iniciante e depois Completo
-- soma os direitos, mantém a mesma matrícula e não perde progresso.
-- ---------------------------------------------------------------------------

create or replace function public.user_paid_offers(p_user_id uuid, p_course_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  /*
   * Produto e curso se ligam por DOIS caminhos, e ambos valem:
   *
   *   courses.product_id   — o produto principal do curso
   *   product_courses      — um produto que libera vários cursos (combo)
   *
   * Cobrir só o primeiro deixaria de fora qualquer pacote montado como
   * combo, e a aluna perderia acesso ao que pagou.
   */
  select distinct o.offer_id
  from public.orders o
  join public.offers of on of.id = o.offer_id
  where o.user_id = p_user_id
    and o.status = 'paid'
    and o.offer_id is not null
    and (
      exists (
        select 1 from public.courses c
        where c.id = p_course_id and c.product_id = of.product_id
      )
      or exists (
        select 1 from public.product_courses pc
        where pc.course_id = p_course_id and pc.product_id = of.product_id
      )
    );
$$;

comment on function public.user_paid_offers(uuid, uuid) is
  'Ofertas pagas por esta pessoa para este curso. Soma de todas — é o que permite upgrade sem perder o que já tinha.';

-- ---------------------------------------------------------------------------
-- O direito ao módulo.
--
-- Devolve TRUE quando:
--   · o curso não tem pacote nenhum configurado (comportamento antigo); ou
--   · a matrícula não veio de pedido (manual, presente, importada, demo); ou
--   · alguma oferta paga da pessoa inclui este módulo.
-- ---------------------------------------------------------------------------

create or replace function public.user_has_module_access(p_user_id uuid, p_module_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_curso_tem_pacote boolean;
  v_origem text;
begin
  if p_user_id is null or p_module_id is null then
    return false;
  end if;

  select course_id into v_course_id from public.modules where id = p_module_id;
  if v_course_id is null then
    return false;
  end if;

  -- Este curso trabalha com pacotes? Se nenhum módulo dele aparece em
  -- offer_module_access, não há o que restringir.
  select exists (
    select 1
    from public.offer_module_access oma
    join public.modules m on m.id = oma.module_id
    where m.course_id = v_course_id
  ) into v_curso_tem_pacote;

  if not v_curso_tem_pacote then
    return true;
  end if;

  -- Matrícula que não nasceu de compra não é limitada por pacote: quem
  -- concedeu manualmente sabia o que estava concedendo.
  select source into v_origem
  from public.enrollments
  where user_id = p_user_id and course_id = v_course_id;

  if v_origem is not null and v_origem <> 'order' then
    return true;
  end if;

  -- O módulo está em alguma oferta paga desta pessoa?
  return exists (
    select 1
    from public.offer_module_access oma
    where oma.module_id = p_module_id
      and oma.offer_id in (select public.user_paid_offers(p_user_id, v_course_id))
  );
end;
$$;

comment on function public.user_has_module_access(uuid, uuid) is
  'Direito ao capítulo pelo pacote comprado. Permissiva quando o curso não tem pacote configurado, para não quebrar matrícula manual nem o comportamento anterior.';

grant execute on function public.user_paid_offers(uuid, uuid) to authenticated;
grant execute on function public.user_has_module_access(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A regra entra na autorização.
--
-- `module_is_released` ganha UMA condição a mais, logo depois de confirmar a
-- matrícula. Todo o resto — pré-requisito, data, turma, liberação manual —
-- fica exatamente como estava.
--
-- Como a função é reescrita por inteiro, o corpo abaixo é o da migration 14
-- com o bloco novo marcado. Nada mais mudou.
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
  c_status public.publication_status;
  prev_done boolean;
begin
  select * into m from public.modules where id = p_module_id;
  if not found or m.status <> 'published' then
    return false;
  end if;

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

  -- >>> NOVO: o capítulo pertence ao pacote comprado? <<<
  if not public.user_has_module_access(p_user_id, p_module_id) then
    return false;
  end if;

  if m.prerequisite_module_id is not null then
    select coalesce(
             bool_and(coalesce(lp.status, 'not_started') = 'completed'),
             true
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
               true
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
      return true;

    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- `lesson_is_released` ganha a mesma barreira.
--
-- Ela já chama `module_is_released` no caminho normal, o que sozinho quase
-- bastaria. Mas há dois desvios que passariam por cima:
--
--   · `is_free` devolve true ANTES de olhar matrícula — uma aula gratuita
--     dentro de um capítulo que a pessoa não comprou continuaria abrindo;
--   · `release_mode = 'immediate'`, `'on_date'`, `'manual'` e `'by_cohort'`
--     retornam sem consultar o módulo.
--
-- A checagem explícita fecha os dois. Aula gratuita segue livre para quem
-- ainda não comprou nada (é degustação), mas quem já comprou um pacote passa
-- a ver a aula gratuita apenas dos capítulos que adquiriu.
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
  c_status public.publication_status;
  prev_done boolean;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if not found or l.status <> 'published' then
    return false;
  end if;

  select status into c_status from public.courses where id = l.course_id;
  if c_status is distinct from 'published' then
    return false;
  end if;

  if l.is_free then
    -- Degustação continua aberta para quem não tem matrícula. Para quem tem,
    -- o pacote vale: não faz sentido "provar" um capítulo já comprado por
    -- outra pessoa e não por ela.
    if p_user_id is null then
      return true;
    end if;
    if not exists (
      select 1 from public.enrollments
      where user_id = p_user_id and course_id = l.course_id
    ) then
      return true;
    end if;
    return public.user_has_module_access(p_user_id, l.module_id);
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

  -- >>> NOVO: o capítulo desta aula pertence ao pacote comprado? <<<
  if not public.user_has_module_access(p_user_id, l.module_id) then
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
      return coalesce(prev_done, true);

    else
      return false;
  end case;
end;
$$;

comment on function public.lesson_is_released(uuid, uuid) is
  'Única fonte da verdade sobre acesso a aula: publicação, matrícula, PACOTE COMPRADO, liberação e pré-requisito. A interface consulta esta função e nunca reimplementa a regra.';

-- ---------------------------------------------------------------------------
-- Para a interface: o que a aluna vê sobre um capítulo bloqueado.
--
-- Devolve o nome dos planos que incluem aquele capítulo, para a área da aluna
-- poder dizer "Disponível no plano Completo" sem escrever nome de plano no
-- código.
-- ---------------------------------------------------------------------------

create or replace function public.module_offers(p_module_id uuid)
returns table (offer_id uuid, offer_name text, offer_slug text, price_cents integer)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.slug, o.price_cents
  from public.offer_module_access oma
  join public.offers o on o.id = oma.offer_id
  where oma.module_id = p_module_id
    and o.status = 'published'
  order by o.price_cents;
$$;

comment on function public.module_offers(uuid) is
  'Planos que incluem este capítulo. A interface usa para dizer onde ele está disponível, sem nome de plano escrito no código.';

grant execute on function public.module_offers(uuid) to anon, authenticated;
