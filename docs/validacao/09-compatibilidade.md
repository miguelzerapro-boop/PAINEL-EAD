# Evidência — compatibilidade entre versões do PostgreSQL

**Comando:** `node scripts/homolog/07-compat.mjs --comparar pg15 pg18`  
**pg15:** PostgreSQL 15.18 — local PostgreSQL @ localhost:55433/homolog  
**pg18:** PostgreSQL 18.4 — local PostgreSQL @ localhost:55432/homolog  
**Resultado:** 47/47 sondas idênticas · nenhuma divergência

> O escopo pede explicitamente para **não presumir compatibilidade só porque as
> migrations foram aceitas**. Cada linha abaixo executa a construção de verdade e
> compara o resultado entre as duas versões.

| Comportamento sondado | pg15 | pg18 |  |
| --- | --- | --- | --- |
| bool_and sobre conjunto vazio | `null` | `null` | ✅ |
| bool_and com um NULL no meio | `true` | `true` | ✅ |
| bool_and com coalesce por dentro (a correção do bug) | `false` | `false` | ✅ |
| NULL = valor devolve NULL | `true` | `true` | ✅ |
| coalesce sobre agregado vazio | `true` | `true` | ✅ |
| enum comparado com texto | `true` | `true` | ✅ |
| enum em IN com literais | `true` | `true` | ✅ |
| enum ordenado pela declaração | `draft,scheduled,published,archived` | `draft,scheduled,published,archived` | ✅ |
| cast enum -> text | `draft` | `draft` | ✅ |
| jsonb_object_agg de numérico | `{"a": 1, "b": 2}` | `{"a": 1, "b": 2}` | ✅ |
| jsonb_each_text | `a=1,b=2` | `a=1,b=2` | ✅ |
| operador ->> em chave ausente | `true` | `true` | ✅ |
| jsonb vazio comparado | `true` | `true` | ✅ |
| jsonb_build_object com null | `{"a": null}` | `{"a": null}` | ✅ |
| soma numérica vinda de jsonb | `7` | `7` | ✅ |
| timestamptz é absoluto entre fusos | `true` | `true` | ✅ |
| make_interval(days) | `2026-01-07 21:00:00-03` | `2026-01-07 21:00:00-03` | ✅ |
| now() é o início da transação | `true` | `true` | ✅ |
| comparação de timestamptz cruzando fuso | `true` | `true` | ✅ |
| função SQL stable devolve boolean | `false` | `false` | ✅ |
| current_role() do projeto (não o built-in) | `student` | `student` | ✅ |
| security definer enxerga tabela do dono | `true` | `true` | ✅ |
| função com search_path fixo resolve tipo | `p_lesson_id uuid, p_user_id uuid` | `p_lesson_id uuid, p_user_id uuid` | ✅ |
| plpgsql CASE sobre enum | `true` | `true` | ✅ |
| função retornando TABLE | `0` | `0` | ✅ |
| função retornando jsonb | `object` | `object` | ✅ |
| CHECK com subexpressão booleana | `3` | `3` | ✅ |
| índice parcial preservado | `7` | `7` | ✅ |
| unique parcial (manual_releases) | `2` | `2` | ✅ |
| generated default com gen_random_bytes | `18` | `18` | ✅ |
| digest do pgcrypto | `64` | `64` | ✅ |
| unaccent disponível | `1` | `1` | ✅ |
| slugify sem depender de unaccent | `acao-coracao-n-1` | `acao-coracao-n-1` | ✅ |
| RLS habilitada em todas as tabelas | `0` | `0` | ✅ |
| total de policies | `119` | `119` | ✅ |
| policies com WITH CHECK | `67` | `67` | ✅ |
| papéis do Supabase existem | `anon,authenticated,service_role` | `anon,authenticated,service_role` | ✅ |
| grant de execute em função de negócio | `true` | `true` | ✅ |
| anon NÃO executa issue_certificate | `true` | `true` | ✅ |
| triggers no schema public | `58` | `58` | ✅ |
| view funnel_daily existe | `1` | `1` | ✅ |
| trigger BEFORE em auth.users | `1` | `1` | ✅ |
| tabelas | `57` | `57` | ✅ |
| enums | `8` | `8` | ✅ |
| funções do projeto | `42` | `42` | ✅ |
| foreign keys | `118` | `118` | ✅ |
| constraints CHECK | `71` | `71` | ✅ |
