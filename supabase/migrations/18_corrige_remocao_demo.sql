-- ===========================================================================
-- 18 - REMOÇÃO DO CONTEÚDO DEMO A PARTIR DO SERVIDOR
--
-- Mesmo defeito já corrigido em `tg_profiles_guard_role` (migration 16):
-- a checagem `not public.is_admin()` também recusa chamadas de SERVIDOR, onde
-- `auth.uid()` é nulo — service role, SQL Editor do Supabase e rotinas de
-- manutenção. O README e a documentação instruem
--
--     select public.remove_demo_content();
--
-- e isso falhava com "Somente administradores podem remover o conteudo de
-- demonstracao" (detectado em docs/validacao/07-e2e.md).
--
-- Passa a valer a mesma regra do resto do projeto: sem sessão, é operação de
-- servidor e é permitida; com sessão, exige papel administrativo.
-- ===========================================================================

create or replace function public.remove_demo_content()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_courses int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Somente administradores podem remover o conteúdo de demonstração.'
      using errcode = 'insufficient_privilege';
  end if;

  -- As FKs em cascata cuidam de módulos, aulas, blocos, materiais,
  -- atividades e avaliações ligados ao curso.
  with d as (delete from public.courses where is_demo returning 1)
  select count(*) into n_courses from d;

  delete from public.enrollments where is_demo;
  delete from public.offers where is_demo;
  delete from public.products where is_demo;
  delete from public.instructors where is_demo;
  delete from public.course_categories where is_demo;
  delete from public.course_levels where is_demo;
  delete from public.faqs where is_demo;
  delete from public.cohorts where is_demo;

  return jsonb_build_object('courses_removed', n_courses, 'at', now());
end;
$$;
