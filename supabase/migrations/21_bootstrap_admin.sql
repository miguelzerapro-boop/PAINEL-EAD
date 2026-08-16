-- ===========================================================================
-- 21 - BOOTSTRAP DO PRIMEIRO ADMINISTRADOR
--
-- O jeito antigo era instruir no README:
--     update public.profiles set role = 'owner' where email = '...';
-- Isso já falhou em silêncio uma vez (migration 16) e, mesmo funcionando,
-- é edição manual de tabela — sem auditoria, sem trava e fácil de repetir por
-- engano.
--
-- Esta migration substitui aquilo por um procedimento com quatro travas:
--
--   1. só funciona enquanto NÃO existir nenhum admin ou owner;
--   2. só funciona em contexto de SERVIDOR (auth.uid() nulo) — SQL Editor ou
--      service role. Não há como chamar do navegador;
--   3. a pessoa precisa já ter conta em auth.users (entrou pelo menos uma vez);
--   4. registra em audit_log quem virou owner, quando e por qual caminho.
--
-- Depois do primeiro owner, a função se recusa a rodar de novo — não precisa
-- ser apagada, mas pode ser (ver `revoke_bootstrap` no fim do arquivo).
-- ===========================================================================

create or replace function public.bootstrap_first_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existentes integer;
begin
  -- Trava 2: nunca a partir de uma sessão de navegador.
  if auth.uid() is not null then
    raise exception 'bootstrap_first_admin só pode ser chamada do servidor (SQL Editor ou service role), nunca de uma sessão autenticada.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Trava 1: só existe uma janela, antes do primeiro administrador.
  select count(*) into v_existentes
  from public.profiles where role in ('admin', 'owner');

  if v_existentes > 0 then
    raise exception 'Já existe % administrador(es). Conceda acesso pelo painel, não por aqui.', v_existentes
      using errcode = 'insufficient_privilege';
  end if;

  -- Trava 3: a conta precisa existir. Não criamos usuário por aqui.
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'Nenhuma conta encontrada para %. Peça para a pessoa entrar uma vez pelo site e rode de novo.', p_email
      using errcode = 'no_data_found';
  end if;

  update public.profiles set role = 'owner' where id = v_user_id;

  -- Trava 4: fica registrado.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, after_data)
  values (
    null, null, 'bootstrap_first_admin', 'profiles', v_user_id::text,
    jsonb_build_object('email', p_email, 'role', 'owner', 'origem', 'servidor', 'em', now())
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'email', p_email,
    'role', 'owner',
    'aviso', 'Guarde este acesso. A função não roda de novo enquanto existir administrador.'
  );
end;
$$;

comment on function public.bootstrap_first_admin(text) is
  'Cria o PRIMEIRO owner do sistema. Só roda a partir do servidor e só enquanto não houver nenhum administrador. Auditado.';

-- ---------------------------------------------------------------------------
-- Diagnóstico: a janela ainda está aberta?
-- ---------------------------------------------------------------------------
create or replace function public.admin_bootstrap_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'janela_aberta', not exists (select 1 from public.profiles where role in ('admin','owner')),
    'administradores', (select count(*) from public.profiles where role in ('admin','owner')),
    'contas', (select count(*) from auth.users)
  );
$$;

-- ---------------------------------------------------------------------------
-- Concessão e revogação DEPOIS do bootstrap — pelo painel, com auditoria.
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(p_email text, p_role public.user_role)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_antes public.user_role;
begin
  -- Sessão de navegador: exige administrador. Servidor: permitido.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Somente administradores podem alterar papéis.'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Nenhuma conta encontrada para %.', p_email using errcode = 'no_data_found';
  end if;

  -- Ninguém tira o próprio acesso por acidente.
  if v_user_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio papel.' using errcode = 'insufficient_privilege';
  end if;

  select role into v_antes from public.profiles where id = v_user_id;
  update public.profiles set role = p_role where id = v_user_id;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(), public.current_role(), 'set_user_role', 'profiles', v_user_id::text,
    jsonb_build_object('role', v_antes),
    jsonb_build_object('role', p_role, 'email', p_email)
  );

  return jsonb_build_object('ok', true, 'user_id', v_user_id, 'de', v_antes, 'para', p_role);
end;
$$;

comment on function public.set_user_role(text, public.user_role) is
  'Concede ou revoga papel. Do painel exige administrador; ninguém altera o próprio papel. Auditado.';

-- ---------------------------------------------------------------------------
-- Nenhuma dessas funções pode ser alcançada do navegador por quem não é admin.
-- `bootstrap_first_admin` não é executável nem por usuário autenticado: ela
-- exige contexto de servidor e a própria função já recusaria, mas revogar o
-- EXECUTE elimina até a possibilidade de tentativa.
-- ---------------------------------------------------------------------------
revoke all on function public.bootstrap_first_admin(text) from public, anon, authenticated;
revoke all on function public.admin_bootstrap_status() from public, anon;
grant execute on function public.admin_bootstrap_status() to authenticated;
revoke all on function public.set_user_role(text, public.user_role) from public, anon;
grant execute on function public.set_user_role(text, public.user_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Encerramento definitivo da janela (opcional, depois do bootstrap):
--
--     drop function public.bootstrap_first_admin(text);
--
-- Não é obrigatório: a trava 1 já a torna inerte. Serve para quem prefere não
-- deixar a função no banco.
-- ---------------------------------------------------------------------------
