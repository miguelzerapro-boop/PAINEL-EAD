-- ===========================================================================
-- 16 - CORREÇÃO DA GUARDA DE PAPEL
--
-- Defeito encontrado na validação de RLS (docs/validacao/04-rls.md):
--
-- `tg_profiles_guard_role` revertia a troca de papel sempre que `is_admin()`
-- fosse falso. Só que `is_admin()` depende de `auth.uid()`, que é NULO em
-- contexto de servidor — service role, rotina de migração e o SQL Editor do
-- Supabase. Consequência prática: o comando do README
--
--     update public.profiles set role = 'owner' where email = '...';
--
-- era aceito sem erro e **silenciosamente descartado**. Não havia como criar
-- o primeiro administrador do sistema.
--
-- Correção: a guarda passa a valer apenas quando existe um usuário
-- autenticado. Sem `auth.uid()`, a operação é de servidor e é permitida.
-- Com `auth.uid()` e sem ser admin, continua sendo revertida — que é o caso
-- que a guarda existe para impedir (aluna se promovendo).
-- ===========================================================================

create or replace function public.tg_profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null      -- há sessão: é alguém usando o produto
     and not public.is_admin()       -- …e essa pessoa não é administradora
  then
    new.role := old.role;
  end if;
  return new;
end;
$$;

comment on function public.tg_profiles_guard_role() is
  'Impede que uma pessoa autenticada altere o próprio papel. Não bloqueia operações de servidor (service role / SQL Editor), onde auth.uid() é nulo — é assim que o primeiro administrador é criado.';
