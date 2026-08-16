-- ===========================================================================
-- 13 - REMOCAO DO CONTEUDO DEMONSTRATIVO
--
-- Tudo que o seed cria carrega is_demo = true. Esta funcao apaga o pacote
-- inteiro de uma vez. O painel expoe um botao "Remover conteudo de teste" e
-- um aviso permanente enquanto restar qualquer registro demonstrativo.
-- ===========================================================================

create or replace function public.demo_content_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.courses where is_demo)
      or exists (select 1 from public.instructors where is_demo)
      or exists (select 1 from public.products where is_demo);
$$;

create or replace function public.remove_demo_content()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_courses int;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem remover o conteudo de demonstracao.'
      using errcode = 'insufficient_privilege';
  end if;

  -- As FKs em cascata cuidam de modulos, aulas, blocos, materiais,
  -- atividades e avaliacoes ligados ao curso.
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

grant execute on function public.demo_content_exists() to authenticated;
grant execute on function public.remove_demo_content() to authenticated;
