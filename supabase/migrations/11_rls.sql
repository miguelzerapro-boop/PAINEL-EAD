-- ===========================================================================
-- 11 - ROW LEVEL SECURITY
--
-- Principio: negar por padrao.
--  - anon        -> so enxerga o que esta publicado
--  - student     -> so enxerga os proprios dados e os cursos em que tem matricula
--  - instructor  -> le conteudo e corrige atividades
--  - admin/owner -> acesso total pelo painel
--
-- Escritas do funil (leads, respostas do quiz, consentimentos, pedidos) NAO
-- tem policy para anon de proposito: passam por rotas de servidor usando a
-- service role, onde da para validar, aplicar rate limit e registrar consent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Habilita RLS em tudo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Atalho: policy de acesso total para admin em uma tabela.
create or replace function public.grant_admin_all(p_table text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
    p_table || '_admin_all', p_table
  );
end;
$$;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    perform public.grant_admin_all(t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Impede a propria aluna se promover a admin.
create or replace function public.tg_profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_role();

-- ---------------------------------------------------------------------------
-- Catalogo publico: so o que esta publicado
-- ---------------------------------------------------------------------------
create policy courses_public_read on public.courses
  for select to anon, authenticated using (status = 'published');

create policy course_categories_public_read on public.course_categories
  for select to anon, authenticated using (status = 'published');

create policy course_levels_public_read on public.course_levels
  for select to anon, authenticated using (true);

create policy course_instructors_public_read on public.course_instructors
  for select to anon, authenticated using (
    exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );

create policy instructors_public_read on public.instructors
  for select to anon, authenticated using (status = 'published');

create policy media_public_read on public.media_assets
  for select to anon, authenticated using (bucket = 'media');

-- O site publico precisa ler a vaga para desenhar o placeholder honesto
-- (nome da foto e dimensoes recomendadas). Nao ha dado sensivel aqui.
create policy image_slots_public_read on public.image_slots
  for select to anon, authenticated using (true);

-- Modulos: visiveis para quem pode ver o curso.
create policy modules_read on public.modules
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );

-- Aulas: metadado visivel para matriculadas e para aulas gratuitas.
-- O conteudo em si (video assinado, PDF) e servido por rota de servidor que
-- chama lesson_is_released(). RLS aqui protege a linha, nao o player.
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
      or public.is_staff()
    )
  );

create policy lesson_blocks_read on public.lesson_blocks
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.lessons l where l.id = lesson_id)
  );

create policy lesson_captions_read on public.lesson_captions
  for select to anon, authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id)
  );

create policy materials_read on public.materials
  for select to anon, authenticated using (
    status = 'published'
    and (
      lesson_id is not null and exists (select 1 from public.lessons l where l.id = lesson_id)
      or module_id is not null and exists (select 1 from public.modules m where m.id = module_id)
      or course_id is not null and exists (
        select 1 from public.enrollments e
        where e.course_id = materials.course_id and e.user_id = auth.uid()
      )
    )
  );

create policy checklist_read on public.lesson_checklist_items
  for select to authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id)
  );

create policy checklist_marks_own on public.lesson_checklist_marks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy cohorts_read on public.cohorts
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.enrollments e where e.cohort_id = cohorts.id and e.user_id = auth.uid())
  );

create policy manual_releases_own_read on public.manual_releases
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Matricula e progresso
-- ---------------------------------------------------------------------------
create policy enrollments_own_read on public.enrollments
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy lesson_progress_own on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy lesson_progress_staff_read on public.lesson_progress
  for select to authenticated using (public.is_staff());

create policy certificates_own_read on public.certificates
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Validacao publica de certificado e feita por rota de servidor pelo `code`.

create policy notices_read on public.notices
  for select to authenticated using (
    status = 'published'
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
    and (
      audience = 'all'
      or (audience = 'user' and user_id = auth.uid())
      or (audience = 'course' and exists (
            select 1 from public.enrollments e
            where e.course_id = notices.course_id and e.user_id = auth.uid()))
      or (audience = 'cohort' and exists (
            select 1 from public.enrollments e
            where e.cohort_id = notices.cohort_id and e.user_id = auth.uid()))
    )
  );

create policy notice_reads_own on public.notice_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Atividades e avaliacoes
-- ---------------------------------------------------------------------------
create policy activities_read on public.activities
  for select to authenticated using (status = 'published');

create policy activity_submissions_own on public.activity_submissions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy activity_submissions_staff on public.activity_submissions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy assessments_read on public.assessments
  for select to authenticated using (status = 'published');

create policy assessment_questions_read on public.assessment_questions
  for select to authenticated using (
    exists (select 1 from public.assessments a where a.id = assessment_id and a.status = 'published')
  );

-- Alternativas: a coluna is_correct nunca deve ir para o cliente antes do
-- envio. A leitura direta fica restrita ao staff; a aluna recebe as opcoes
-- por uma rota de servidor que remove is_correct.
create policy assessment_options_staff_read on public.assessment_options
  for select to authenticated using (public.is_staff());

create policy assessment_attempts_own on public.assessment_attempts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy assessment_attempts_staff on public.assessment_attempts
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Comercio
-- ---------------------------------------------------------------------------
create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'published');

create policy offers_public_read on public.offers
  for select to anon, authenticated using (
    status = 'published'
    and price_cents is not null
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy product_courses_public_read on public.product_courses
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
  );

create policy orders_own_read on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy payments_own_read on public.payments
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Cupons nunca sao lidos pelo cliente: validacao acontece no servidor.

-- ---------------------------------------------------------------------------
-- Funil
-- ---------------------------------------------------------------------------
create policy quizzes_public_read on public.quizzes
  for select to anon, authenticated using (status = 'published');

create policy quiz_questions_public_read on public.quiz_questions
  for select to anon, authenticated using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.status = 'published')
  );

create policy quiz_options_public_read on public.quiz_options
  for select to anon, authenticated using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and q.status = 'published'
    )
  );

-- Resultados e pesos ficam no servidor: nao ha policy de leitura publica em
-- quiz_outcomes nem em quiz_responses.

create policy analytics_insert_anon on public.analytics_events
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- CMS
-- ---------------------------------------------------------------------------
create policy cms_pages_public_read on public.cms_pages
  for select to anon, authenticated using (status = 'published');

create policy cms_sections_public_read on public.cms_sections
  for select to anon, authenticated using (
    status = 'published'
    and array_length(missing_fields, 1) is null
    and exists (select 1 from public.cms_pages p where p.id = page_id and p.status = 'published')
  );

create policy cms_block_types_read on public.cms_block_types
  for select to anon, authenticated using (true);

create policy faqs_public_read on public.faqs
  for select to anon, authenticated using (status = 'published');

create policy testimonials_public_read on public.testimonials
  for select to anon, authenticated using (
    status = 'published' and is_verified and consent_id is not null
  );

create policy public_metrics_public_read on public.public_metrics
  for select to anon, authenticated using (status = 'published');

create policy settings_public_read on public.settings
  for select to anon, authenticated using (not is_secret and group_key in ('site', 'contact', 'legal', 'seo'));

-- ---------------------------------------------------------------------------
-- LGPD
-- ---------------------------------------------------------------------------
create policy consents_own_read on public.consents
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy data_requests_own_read on public.data_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- audit_log e cms_revisions: somente admin (ja coberto por grant_admin_all).

-- ---------------------------------------------------------------------------
-- Permissoes de execucao das funcoes de negocio
-- ---------------------------------------------------------------------------
revoke all on function public.grant_admin_all(text) from public, anon, authenticated;

grant execute on function public.lesson_is_released(uuid, uuid) to authenticated;
grant execute on function public.module_is_released(uuid, uuid) to authenticated;
grant execute on function public.course_outline(uuid, uuid) to anon, authenticated;
grant execute on function public.is_eligible_for_certificate(uuid) to authenticated;
grant execute on function public.resolve_quiz_outcome(uuid) to anon, authenticated;

revoke execute on function public.issue_certificate(uuid) from anon, authenticated;
revoke execute on function public.publish_scheduled_content() from anon, authenticated;
revoke execute on function public.expire_enrollments() from anon, authenticated;
