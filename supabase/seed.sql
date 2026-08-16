-- ===========================================================================
-- SEED - CONTEUDO DE DEMONSTRACAO
--
-- ATENCAO
-- Nada aqui e conteudo real. Nenhum nome de curso, modulo, aula ou tecnica
-- desta base foi aprovado pela responsavel pelo curso.
-- Este pacote existe apenas para que a plataforma possa ser testada de ponta
-- a ponta antes de o conteudo verdadeiro ser cadastrado.
--
-- Tudo carrega is_demo = true. Para apagar:
--   select public.remove_demo_content();
-- ou o botao "Remover conteudo de teste" no painel administrativo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Taxonomias de teste
-- ---------------------------------------------------------------------------
insert into public.course_categories (id, name, slug, position, status, is_demo)
values ('11111111-1111-4111-8111-111111111101',
        'Categoria de demonstracao - substituir no painel', 'demo-categoria', 0, 'draft', true);

insert into public.course_levels (id, name, slug, position, is_demo)
values ('11111111-1111-4111-8111-111111111102',
        'Nivel de demonstracao - substituir no painel', 'demo-nivel', 0, true);

-- ---------------------------------------------------------------------------
-- Instrutora de teste. Biografia e credenciais ficam VAZIAS de proposito.
-- ---------------------------------------------------------------------------
insert into public.instructors (id, name, slug, headline, bio_short, bio_full, status, is_demo)
values ('11111111-1111-4111-8111-111111111103',
        'Instrutora de demonstracao - substituir no painel',
        'demo-instrutora',
        null, null, null,
        'draft', true);

-- ---------------------------------------------------------------------------
-- Produto e oferta de teste. Sem preco: a oferta nao pode ser publicada.
-- ---------------------------------------------------------------------------
insert into public.products (id, name, slug, description, kind, status, is_demo)
values ('11111111-1111-4111-8111-111111111104',
        'Produto de demonstracao - substituir no painel', 'demo-produto',
        'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
        'course', 'draft', true);

insert into public.offers (id, product_id, name, slug, price_cents, status, is_demo)
values ('11111111-1111-4111-8111-111111111105',
        '11111111-1111-4111-8111-111111111104',
        'Oferta de demonstracao - substituir no painel', 'demo-oferta',
        null, 'draft', true);

-- ---------------------------------------------------------------------------
-- Curso de demonstracao
-- ---------------------------------------------------------------------------
insert into public.courses (
  id, name, slug, short_description, full_description,
  category_id, level_id, product_id,
  workload_minutes, access_mode, status, position,
  certificate_enabled, audience, prerequisites, required_materials, welcome_message,
  is_demo
)
values (
  '11111111-1111-4111-8111-111111111110',
  'Curso de demonstracao - substituir no painel',
  'curso-de-demonstracao',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao. '
    || 'Nenhuma informacao pedagogica desta base foi definida ou aprovada. '
    || 'Cadastre o curso real pelo painel administrativo e apague este registro.',
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111104',
  null,              -- carga horaria: nao definida
  'lifetime',
  'draft',           -- nunca publicado
  0,
  false,             -- certificado desligado ate os criterios existirem
  null, null, null, null,
  true
);

insert into public.course_instructors (course_id, instructor_id, position)
values ('11111111-1111-4111-8111-111111111110', '11111111-1111-4111-8111-111111111103', 0);

-- ---------------------------------------------------------------------------
-- Um modulo de demonstracao
-- ---------------------------------------------------------------------------
insert into public.modules (id, course_id, name, slug, description, position, release_mode, status, is_demo)
values (
  '11111111-1111-4111-8111-111111111120',
  '11111111-1111-4111-8111-111111111110',
  'Modulo de demonstracao - substituir no painel',
  'demo-modulo',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  0, 'immediate', 'draft', true
);

-- ---------------------------------------------------------------------------
-- Uma aula de demonstracao, com placeholder de video
-- ---------------------------------------------------------------------------
insert into public.lessons (
  id, module_id, course_id, title, slug, description,
  content_type, video_provider, video_url, body, duration_seconds,
  position, is_free, release_mode, status, is_demo
)
values (
  '11111111-1111-4111-8111-111111111130',
  '11111111-1111-4111-8111-111111111120',
  '11111111-1111-4111-8111-111111111110',
  'Aula de demonstracao - substituir no painel',
  'demo-aula',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  'video',
  'upload',
  null,              -- sem video: o player mostra o estado "video ainda nao enviado"
  'Conteudo de teste. Nenhum texto pedagogico foi definido ou aprovado.',
  null,              -- duracao: nao definida
  0, false, 'immediate', 'draft', true
);

-- ---------------------------------------------------------------------------
-- Um material de demonstracao
-- ---------------------------------------------------------------------------
insert into public.materials (id, lesson_id, title, description, kind, external_url, position, status, is_demo)
values (
  '11111111-1111-4111-8111-111111111140',
  '11111111-1111-4111-8111-111111111130',
  'Material de demonstracao - substituir no painel',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  'link',
  'https://example.invalid/demo',
  0, 'draft', true
);

-- ---------------------------------------------------------------------------
-- Uma atividade de demonstracao
-- ---------------------------------------------------------------------------
insert into public.activities (id, lesson_id, title, instructions, submission_type, position, status, is_demo)
values (
  '11111111-1111-4111-8111-111111111150',
  '11111111-1111-4111-8111-111111111130',
  'Atividade de demonstracao - substituir no painel',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  'photo', 0, 'draft', true
);

-- ---------------------------------------------------------------------------
-- Uma avaliacao de demonstracao
-- ---------------------------------------------------------------------------
insert into public.assessments (id, lesson_id, title, description, passing_score, status, is_demo)
values (
  '11111111-1111-4111-8111-111111111160',
  '11111111-1111-4111-8111-111111111130',
  'Avaliacao de demonstracao - substituir no painel',
  'Este conteudo existe apenas para testar a plataforma e deve ser removido antes da publicacao.',
  70, 'draft', true
);

insert into public.assessment_questions (id, assessment_id, prompt, type, position)
values (
  '11111111-1111-4111-8111-111111111161',
  '11111111-1111-4111-8111-111111111160',
  'Pergunta de demonstracao - substituir no painel.',
  'single', 0
);

insert into public.assessment_options (question_id, label, is_correct, position) values
  ('11111111-1111-4111-8111-111111111161', 'Alternativa de demonstracao A', true,  0),
  ('11111111-1111-4111-8111-111111111161', 'Alternativa de demonstracao B', false, 1);

-- ---------------------------------------------------------------------------
-- Verificacao final: nada demonstrativo pode estar publicado.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.courses      where is_demo and status = 'published'
    union all select 1 from public.modules  where is_demo and status = 'published'
    union all select 1 from public.lessons  where is_demo and status = 'published'
    union all select 1 from public.offers   where is_demo and status = 'published'
    union all select 1 from public.instructors where is_demo and status = 'published'
  ) s;
  if n > 0 then
    raise exception 'Seed invalido: existe conteudo de demonstracao publicado.';
  end if;
  raise notice 'Seed de demonstracao aplicado. Rode select public.remove_demo_content() antes de publicar.';
end;
$$;
