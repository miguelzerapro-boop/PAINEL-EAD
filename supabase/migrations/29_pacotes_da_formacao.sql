-- ===========================================================================
-- 29 - OS TRÊS PACOTES DA FORMAÇÃO
--
-- Preços e distribuição de capítulos aprovados pela responsável. Nada aqui é
-- estimado: os três valores e os três conjuntos vieram definidos.
--
--   Iniciante    R$  29,90   capítulos 1, 3, 4              3 de 8
--   Profissional R$  39,90   capítulos 1, 2, 3, 4, 5, 6     6 de 8
--   Completo     R$  54,90   capítulos 1 a 8                8 de 8
--
-- O que esta migration NÃO faz:
--   · não inventa bônus, garantia, carga horária ou prazo;
--   · não promete resultado;
--   · não publica a formação (ela continua em rascunho até a responsável
--     decidir).
--
-- As ofertas nascem PUBLICADAS porque a landing comercial precisa lê-las, e
-- porque `resolve_quiz_outcome` só considera oferta publicada com preço. O
-- curso continuar em rascunho é o que segura a venda até a hora certa.
--
-- IDEMPOTENTE: reexecutar não duplica nem sobrescreve preço ajustado no
-- painel. A matriz de capítulos é reconciliada, para que trocar um capítulo
-- de pacote no painel não seja desfeito — mas um capítulo removido à mão
-- volta, porque a matriz aprovada é esta.
-- ===========================================================================

do $$
declare
  v_course_id  uuid;
  v_product_id uuid;
  v_offer      record;
  v_offer_id   uuid;
  v_module_id  uuid;
  v_slug       text;
begin
  select id into v_course_id from public.courses where slug = 'formacao';
  if v_course_id is null then
    raise exception 'Curso "formacao" não encontrado. A migration 23 precisa rodar antes.';
  end if;

  -- -------------------------------------------------------------------------
  -- Produto único. As três ofertas são preços diferentes do MESMO produto —
  -- é o que mantém uma matrícula só e faz o upgrade somar direitos.
  -- -------------------------------------------------------------------------
  insert into public.products (name, slug, status)
  values ('Formação em manicure', 'formacao-manicure', 'published')
  on conflict (slug) do nothing;

  select id into v_product_id from public.products where slug = 'formacao-manicure';

  -- Liga o produto ao curso pelos dois caminhos que o schema aceita.
  update public.courses set product_id = v_product_id
   where id = v_course_id and product_id is distinct from v_product_id;

  insert into public.product_courses (product_id, course_id, position)
  values (v_product_id, v_course_id, 1)
  on conflict (product_id, course_id) do nothing;

  -- -------------------------------------------------------------------------
  -- As três ofertas
  -- -------------------------------------------------------------------------
  for v_offer in
    select * from (values
      ('iniciante',    'Iniciante',    2990,
       'Para quem quer construir uma base e começar pelos fundamentos.',
       'Começar pelo Iniciante', 1),
      ('profissional', 'Profissional', 3990,
       'Para quem quer ir além da base e começar a ampliar suas técnicas.',
       'Quero o Profissional', 2),
      ('completo',     'Completo',     5490,
       'A formação completa, com acesso a todos os capítulos disponíveis.',
       'Quero acesso completo', 3)
    ) as t(slug, nome, preco, chamada, cta, ordem)
  loop
    insert into public.offers
      (name, slug, product_id, price_cents, headline, cta_label, status)
    values
      (v_offer.nome, v_offer.slug, v_product_id, v_offer.preco,
       v_offer.chamada, v_offer.cta, 'published')
    on conflict (slug) do nothing;
  end loop;

  -- -------------------------------------------------------------------------
  -- A matriz de acesso.
  --
  -- Escrita por SLUG de capítulo, não por posição: renomear ou reordenar um
  -- capítulo no painel não pode mudar quem tem direito a quê.
  -- -------------------------------------------------------------------------
  for v_offer in
    select * from (values
      -- Iniciante: fundamentos
      ('iniciante',    'manicure-e-pedicure-iniciante'),
      ('iniciante',    'cuticula-fundinha'),
      ('iniciante',    'acabamento-impecavel'),

      -- Profissional: tudo do Iniciante + três técnicas
      ('profissional', 'manicure-e-pedicure-iniciante'),
      ('profissional', 'curso-de-aperfeicoamento-manicure'),
      ('profissional', 'cuticula-fundinha'),
      ('profissional', 'acabamento-impecavel'),
      ('profissional', 'curso-de-esmaltacao-em-gel'),
      ('profissional', 'curso-de-blindagem'),

      -- Completo: os oito
      ('completo',     'manicure-e-pedicure-iniciante'),
      ('completo',     'curso-de-aperfeicoamento-manicure'),
      ('completo',     'cuticula-fundinha'),
      ('completo',     'acabamento-impecavel'),
      ('completo',     'curso-de-esmaltacao-em-gel'),
      ('completo',     'curso-de-blindagem'),
      ('completo',     'curso-de-banho-de-gel'),
      ('completo',     'curso-de-unhas-de-fibra')
    ) as t(oferta, capitulo)
  loop
    select id into v_offer_id from public.offers where slug = v_offer.oferta;
    select id into v_module_id
      from public.modules
     where course_id = v_course_id and slug = v_offer.capitulo;

    if v_offer_id is null then
      raise exception 'Oferta "%" não encontrada.', v_offer.oferta;
    end if;
    if v_module_id is null then
      raise exception 'Capítulo "%" não encontrado na formação.', v_offer.capitulo;
    end if;

    insert into public.offer_module_access (offer_id, module_id)
    values (v_offer_id, v_module_id)
    on conflict (offer_id, module_id) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conferência: a matriz ficou exatamente como aprovada?
--
-- Falhar aqui é melhor do que descobrir em produção que alguém compra o
-- Completo e recebe seis capítulos.
-- ---------------------------------------------------------------------------

do $$
declare
  n_iniciante integer;
  n_profissional integer;
  n_completo integer;
begin
  select count(*) into n_iniciante
    from public.offer_module_access oma
    join public.offers o on o.id = oma.offer_id
   where o.slug = 'iniciante';

  select count(*) into n_profissional
    from public.offer_module_access oma
    join public.offers o on o.id = oma.offer_id
   where o.slug = 'profissional';

  select count(*) into n_completo
    from public.offer_module_access oma
    join public.offers o on o.id = oma.offer_id
   where o.slug = 'completo';

  if n_iniciante <> 3 or n_profissional <> 6 or n_completo <> 8 then
    raise exception
      'Matriz de acesso incorreta: Iniciante=% (esperado 3), Profissional=% (esperado 6), Completo=% (esperado 8)',
      n_iniciante, n_profissional, n_completo;
  end if;
end;
$$;
