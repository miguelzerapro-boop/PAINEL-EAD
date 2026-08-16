# Evidência — primeiro administrador e controle de papéis

**Comando:** `node scripts/homolog/09-admin.mjs`  
**Ambiente:** local PostgreSQL @ localhost:55432/homolog  
**Resultado:** 16/16 verificações conforme o esperado.

## Procedimento oficial

1. A pessoa entra no site uma vez pelo link mágico — isso cria a conta em `auth.users`.
2. No **SQL Editor do Supabase** (ou por service role), rodar:

```sql
select public.bootstrap_first_admin('email@dominio.com');
```

3. Conferir:

```sql
select public.admin_bootstrap_status();
-- {"janela_aberta": false, "administradores": 1, ...}
```

4. Daí em diante, conceder e revogar pelo painel:

```sql
select public.set_user_role('outra@dominio.com', 'admin');   -- concede
select public.set_user_role('outra@dominio.com', 'student'); -- revoga
```

5. Opcional, para fechar de vez: `drop function public.bootstrap_first_admin(text);`
   Não é necessário — a função já se recusa a rodar enquanto existir administrador.

## Travas

| Trava | O que impede |
| --- | --- |
| Janela única | Só roda enquanto não houver nenhum admin ou owner |
| Só do servidor | Recusa se `auth.uid()` não for nulo |
| Sem `EXECUTE` para `anon` e `authenticated` | Não há como sequer tentar pelo navegador |
| Conta obrigatória | Não cria usuário; a pessoa precisa ter entrado antes |
| Auditoria | Grava em `audit_log` quem virou owner e quando |
| Sem auto-alteração | Ninguém muda o próprio papel, nem o owner |

## Verificações

| Cenário | Esperado | Obtido |  | Nota |
| --- | --- | --- | --- | --- |
| Janela de bootstrap aberta quando não há administrador | `true` | `true` | ✅ | — |
| Recusa e-mail sem conta | `true` | `true` | ✅ | Nenhuma conta encontrada para ninguem@homolog.local. Peça para a pessoa entrar uma vez pelo site e rode de novo. |
| Bootstrap promove a primeira pessoa a owner | `"owner"` | `"owner"` | ✅ | "fdc3b89f-d1ee-4d17-b8ef-825b671b7427" |
| O papel realmente persistiu no banco | `"owner"` | `"owner"` | ✅ | era exatamente aqui que a versão anterior falhava em silêncio |
| Bootstrap ficou registrado na auditoria | `"bootstrap_first_admin"` | `"bootstrap_first_admin"` | ✅ | entity_id fdc3b89f-d1ee-4d17-b8ef-825b671b7427 |
| Segunda chamada é recusada | `true` | `true` | ✅ | Já existe 1 administrador(es). Conceda acesso pelo painel, não por aqui. |
| Janela fechada depois do bootstrap | `false` | `false` | ✅ | — |
| Recusa quando chamada de uma sessão de navegador | `true` | `true` | ✅ | permission denied for function bootstrap_first_admin |
| authenticated NÃO tem EXECUTE na função de bootstrap | `false` | `false` | ✅ | — |
| anon NÃO tem EXECUTE na função de bootstrap | `false` | `false` | ✅ | — |
| Aluna tentando se promover: papel continua "student" | `"student"` | `"student"` | ✅ | o UPDATE é aceito, mas o trigger descarta a mudança |
| Aluna não pode usar set_user_role | `true` | `true` | ✅ | Somente administradores podem alterar papéis. |
| Owner concede papel de admin | `"admin"` | `"admin"` | ✅ | — |
| Owner revoga o acesso | `"student"` | `"student"` | ✅ | — |
| Owner não altera o próprio papel | `true` | `true` | ✅ | Você não pode alterar o próprio papel. |
| Concessão e revogação ficaram auditadas | `true` | `true` | ✅ | 2 registros |
