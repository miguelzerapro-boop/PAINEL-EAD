-- ===========================================================================
-- 23 - FORMAÇÃO E OS 8 CAPÍTULOS APROVADOS
--
-- Primeira estrutura de conteúdo REAL do projeto. Até aqui o catálogo estava
-- vazio de propósito.
--
-- Modelagem: a arquitetura já é course -> module -> lesson. Não se cria uma
-- quarta camada. O "capítulo" É o module. A "formação" É o course.
--
--   Formação (courses)
--     └── Capítulo 1..8 (modules)
--           └── Aulas (lessons)  ← cadastradas pelo painel, nenhuma aqui
--
-- O QUE ESTA MIGRATION NÃO FAZ, por decisão explícita da responsável:
--   · não cria aula nenhuma;
--   · não inventa carga horária, duração nem quantidade de aulas;
--   · não escreve descrição pedagógica;
--   · não promete certificado, bônus ou resultado;
--   · não publica nada.
--
-- Curso e capítulos entram como 'draft'. Não há texto aprovado para a
-- descrição curta, e a constraint courses_publish_requires_description
-- (migration 03) impede publicar sem ela — corretamente. Publicar é um ato
-- da responsável, no painel, depois de escrever o texto dela.
--
-- IDEMPOTENTE: roda de novo sem duplicar e — importante — sem desfazer
-- renomeação ou reordenação feita no painel. Os `on conflict do nothing`
-- existem para isso.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Qual curso o painel trata como "a formação".
--
-- Guardado em settings, não no código: o frontend não pode ter os oito nomes
-- nem o slug da formação escritos dentro dele. Apontar o painel para outra
-- formação no futuro é trocar este valor.
-- ---------------------------------------------------------------------------
insert into public.settings (key, group_key, label, description, value, is_required, is_secret)
values (
  'content.main_course',
  'content',
  'Formação principal',
  'Slug do curso que o painel abre em "Formação". Trocar aqui aponta o painel para outra formação.',
  to_jsonb('formacao'::text),
  false,
  false
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- A formação
-- ---------------------------------------------------------------------------
insert into public.courses (name, slug, status, position, access_mode, is_demo)
values ('Formação', 'formacao', 'draft', 0, 'lifetime', false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Os 8 capítulos, na ordem aprovada.
--
-- O slug é a chave estável de idempotência. O nome pode ser renomeado no
-- painel sem que uma reexecução desta migration recrie ou sobrescreva.
-- ---------------------------------------------------------------------------
do $$
declare
  v_course_id uuid;
  v_capitulo  record;
begin
  select id into v_course_id from public.courses where slug = 'formacao';

  if v_course_id is null then
    raise exception 'Curso "formacao" não encontrado — a inserção acima falhou.';
  end if;

  for v_capitulo in
    select * from (values
      (1, 'Manicure e Pedicure Iniciante',     'manicure-e-pedicure-iniciante'),
      (2, 'Curso de Aperfeiçoamento Manicure', 'curso-de-aperfeicoamento-manicure'),
      (3, 'Cutícula Fundinha',                 'cuticula-fundinha'),
      (4, 'Acabamento Impecável',              'acabamento-impecavel'),
      (5, 'Curso de Esmaltação em Gel',        'curso-de-esmaltacao-em-gel'),
      (6, 'Curso de Blindagem',                'curso-de-blindagem'),
      (7, 'Curso de Banho de Gel',             'curso-de-banho-de-gel'),
      (8, 'Curso de Unhas de Fibra',           'curso-de-unhas-de-fibra')
    ) as t(posicao, nome, slug)
  loop
    insert into public.modules
      (course_id, name, slug, position, release_mode, status, is_demo)
    values
      (v_course_id, v_capitulo.nome, v_capitulo.slug, v_capitulo.posicao,
       'immediate', 'draft', false)
    on conflict (course_id, slug) do nothing;
  end loop;
end;
$$;
