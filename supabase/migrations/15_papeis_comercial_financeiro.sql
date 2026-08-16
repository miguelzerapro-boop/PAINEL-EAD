-- ===========================================================================
-- 15 - PAPÉIS COMERCIAL E FINANCEIRO + ESCOPO REAL DA INSTRUTORA
--
-- A validação de RLS exigiu perfis que o modelo ainda não tinha:
--   · atendimento comercial  -> trabalha o funil, não toca em pagamento
--   · financeiro             -> trabalha pedido e pagamento, não toca em aula
--                               e não lê resposta de diagnóstico
--
-- E corrigiu um excesso: `is_staff()` dava a QUALQUER instrutora leitura de
-- todas as aulas, de todo progresso e de todas as entregas do sistema. Agora
-- a instrutora só enxerga os cursos em que está vinculada.
--
-- Observação: as comparações usam `::text` de propósito. Um valor novo de enum
-- não pode ser referenciado como literal na mesma transação em que é criado.
-- ===========================================================================

alter type public.user_role add value if not exists 'sales';
alter type public.user_role add value if not exists 'finance';

-- ---------------------------------------------------------------------------
-- Helpers de papel
-- ---------------------------------------------------------------------------

create or replace function public.is_sales()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role()::text in ('sales', 'admin', 'owner');
$$;

create or replace function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role()::text in ('finance', 'admin', 'owner');
$$;

-- A instrutora leciona este curso?
create or replace function public.instructor_teaches(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_instructors ci
    join public.instructors i on i.id = ci.instructor_id
    where ci.course_id = p_course_id
      and i.profile_id = auth.uid()
  );
$$;

-- Curso ao qual uma atividade pertence (a atividade pode estar presa a
-- curso, módulo ou aula).
create or replace function public.activity_course(p_activity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    a.course_id,
    (select m.course_id from public.modules m where m.id = a.module_id),
    (select l.course_id from public.lessons l where l.id = a.lesson_id)
  )
  from public.activities a
  where a.id = p_activity_id;
$$;

grant execute on function public.is_sales() to authenticated;
grant execute on function public.is_finance() to authenticated;
grant execute on function public.instructor_teaches(uuid) to authenticated;
grant execute on function public.activity_course(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- `is_staff` deixa de incluir comercial e financeiro
-- (já não os incluía; o comentário fica explícito para quem ler depois)
-- ---------------------------------------------------------------------------
comment on function public.is_staff() is
  'Instrutora, admin ou owner. NÃO inclui comercial nem financeiro — esses dois não têm acesso a conteúdo.';

-- ---------------------------------------------------------------------------
-- Instrutora: acesso restrito aos próprios cursos
-- ---------------------------------------------------------------------------

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons
  for select to anon, authenticated using (
    status = 'published'
    and (
      is_free
      or exists (
        select 1 from public.enrollments e
        where e.course_id = lessons.course_id
          and e.user_id = auth.uid()
          and e.status in ('active', 'completed')
      )
      or public.is_admin()
      or public.instructor_teaches(lessons.course_id)
    )
  );

drop policy if exists lesson_progress_staff_read on public.lesson_progress;
create policy lesson_progress_staff_read on public.lesson_progress
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_progress.lesson_id
        and public.instructor_teaches(l.course_id)
    )
  );

drop policy if exists activity_submissions_staff on public.activity_submissions;
create policy activity_submissions_staff on public.activity_submissions
  for all to authenticated
  using (
    public.is_admin()
    or public.instructor_teaches(public.activity_course(activity_submissions.activity_id))
  )
  with check (
    public.is_admin()
    or public.instructor_teaches(public.activity_course(activity_submissions.activity_id))
  );

-- ---------------------------------------------------------------------------
-- Comercial: enxerga o funil, não toca em dinheiro nem em conteúdo
-- ---------------------------------------------------------------------------

create policy leads_sales_read on public.leads
  for select to authenticated using (public.is_sales());

create policy leads_sales_update on public.leads
  for update to authenticated
  using (public.is_sales())
  with check (public.is_sales());

create policy quiz_responses_sales_read on public.quiz_responses
  for select to authenticated using (public.is_sales());

create policy quiz_outcomes_sales_read on public.quiz_outcomes
  for select to authenticated using (public.is_sales());

create policy whatsapp_clicks_sales_read on public.whatsapp_clicks
  for select to authenticated using (public.is_sales());

create policy orders_sales_read on public.orders
  for select to authenticated using (public.is_sales());

-- ---------------------------------------------------------------------------
-- Financeiro: pedido e pagamento; nada de conteúdo, nada de diagnóstico
-- ---------------------------------------------------------------------------

create policy orders_finance_read on public.orders
  for select to authenticated using (public.is_finance());

create policy orders_finance_update on public.orders
  for update to authenticated
  using (public.is_finance())
  with check (public.is_finance());

create policy payments_finance_read on public.payments
  for select to authenticated using (public.is_finance());

create policy coupons_finance_read on public.coupons
  for select to authenticated using (public.is_finance());

create policy products_finance_read on public.products
  for select to authenticated using (public.is_finance());

create policy offers_finance_read on public.offers
  for select to authenticated using (public.is_finance());

-- ---------------------------------------------------------------------------
-- Retirada dos privilégios amplos que `grant_admin_all` concedeu a comercial
-- e financeiro? Não é necessário: aquela policy exige `is_admin()`, que
-- continua restrita a admin e owner. Comercial e financeiro só têm o que foi
-- concedido acima.
-- ---------------------------------------------------------------------------
