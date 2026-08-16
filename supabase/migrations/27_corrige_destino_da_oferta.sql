-- ===========================================================================
-- 27 - CORRIGE O DESTINO DA OFERTA NO DIAGNÓSTICO
--
-- DEFEITO ENCONTRADO NA VALIDAÇÃO DO FUNIL
--
-- `resolve_quiz_outcome()` devolvia:
--
--     '/oferta/' || slug
--
-- e essa rota NUNCA EXISTIU. As rotas do app são /cursos/[slug],
-- /checkout/[oferta], /preview/[key] — não há /oferta/[slug].
--
-- Consequência: sempre que o diagnóstico resolvia para uma OFERTA, o botão da
-- tela de resultado levava a um 404. O funil morria exatamente no ponto de
-- venda, e só nesse caminho — por isso passou despercebido: com curso
-- publicado o destino é /cursos/{slug}, que funciona, e sem oferta ativa o
-- destino é o WhatsApp, que também funciona.
--
-- A página de checkout É a página da oferta nesta arquitetura: recebe o slug,
-- carrega nome, preço, parcelas e garantia, e tem o formulário de compra.
--
-- O resto da função não muda: a ordem de prioridade (curso publicado → oferta
-- ativa → página → WhatsApp) e todas as condições de elegibilidade seguem
-- exatamente como estavam.
-- ===========================================================================

create or replace function public.resolve_quiz_outcome(p_outcome_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  v_slug text;
  v_offer_slug text;
  v_fallback text;
begin
  select * into o from public.quiz_outcomes where id = p_outcome_id;

  if not found then
    return jsonb_build_object('action', 'whatsapp', 'reason', 'outcome_not_found');
  end if;

  -- Mensagem oficial do quiz, usada quando o resultado não tem a sua própria.
  select fallback_message into v_fallback from public.quizzes where id = o.quiz_id;

  -- 1. curso publicado
  if o.preferred_target in ('auto', 'course') and o.course_id is not null then
    select slug into v_slug
    from public.courses
    where id = o.course_id and status = 'published';
    if v_slug is not null then
      return jsonb_build_object('action', 'course', 'url', '/cursos/' || v_slug, 'reason', 'published_course');
    end if;
  end if;

  -- 2. oferta ativa
  if o.preferred_target in ('auto', 'offer') and o.offer_id is not null then
    select slug into v_offer_slug
    from public.offers
    where id = o.offer_id
      and status = 'published'
      and price_cents is not null
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now());
    if v_offer_slug is not null then
      -- CORRIGIDO: era '/oferta/', rota que não existe.
      return jsonb_build_object('action', 'offer', 'url', '/checkout/' || v_offer_slug, 'reason', 'active_offer');
    end if;
  end if;

  -- 3. pagina especifica
  if o.preferred_target in ('auto', 'page') and o.target_path is not null then
    return jsonb_build_object('action', 'page', 'url', o.target_path, 'reason', 'configured_page');
  end if;

  -- 4. WhatsApp
  return jsonb_build_object(
    'action', 'whatsapp',
    'message', coalesce(o.whatsapp_message, v_fallback),
    'reason', 'no_published_target'
  );
end;
$$;

comment on function public.resolve_quiz_outcome(uuid) is
  'Destino do diagnóstico: curso publicado > oferta ativa > pagina > WhatsApp. A oferta aponta para /checkout/{slug} — nao existe rota /oferta.';

-- ---------------------------------------------------------------------------
-- Respostas já gravadas com o destino errado.
--
-- `resolved_action` é congelado no momento da resposta. Quem respondeu antes
-- desta correção tem '/oferta/...' salvo e continuaria caindo no 404 ao
-- reabrir o link do resultado.
-- ---------------------------------------------------------------------------

update public.quiz_responses
   set resolved_action = jsonb_set(
         resolved_action,
         '{url}',
         to_jsonb('/checkout/' || substring(resolved_action->>'url' from '^/oferta/(.*)$'))
       )
 where resolved_action->>'action' = 'offer'
   and resolved_action->>'url' like '/oferta/%';
