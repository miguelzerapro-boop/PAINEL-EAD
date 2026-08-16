# Evidência — as sete regras de liberação

**Comando:** `node scripts/homolog/03-liberacao.mjs`  
**Ambiente:** homologação local, PostgreSQL 18.4  
**Sob teste:** `public.lesson_is_released(lesson_id, user_id)` e `public.module_is_released(module_id, user_id)`  
**Resultado:** 44/44 casos conforme o esperado.

> A interface **consulta essas funções** — `getCourseOutline()` chama o RPC `course_outline`,
> que por sua vez chama `lesson_is_released()`. A regra não está duplicada em JavaScript.
> O único código JS relacionado é `src/lib/content/gating.ts`, que apenas **traduz o modo em
> texto** para explicar o motivo do bloqueio à aluna.

| Regra | Cenário | Esperado | Obtido |  | Observação |
| --- | --- | --- | --- | --- | --- |
| 1 · imediata | aluna matriculada | `true` | `true` | ✅ | — |
| 1 · imediata | usuário SEM matrícula | `false` | `false` | ✅ | — |
| 1 · imediata | usuário anônimo (null) | `false` | `false` | ✅ | — |
| 2 · após aula anterior | primeira aula do módulo (sem anterior) | `true` | `true` | ✅ | — |
| 2 · após aula anterior | A2 antes de concluir A1 | `false` | `false` | ✅ | — |
| 2 · após aula anterior | A2 depois de concluir A1 (transição) | `true` | `true` | ✅ | — |
| 3 · após módulo anterior | M2 com M1 incompleto | `false` | `false` | ✅ | — |
| 3 · após módulo anterior | aula de M2 bloqueada junto | `false` | `false` | ✅ | — |
| 3 · após módulo anterior | M2 com M1 parcialmente concluído | `false` | `false` | ✅ | — |
| 3 · após módulo anterior | M2 com M1 100% concluído (transição) | `true` | `true` | ✅ | — |
| 3 · após módulo anterior | aula de M2 liberada junto | `true` | `true` | ✅ | — |
| 4 · em uma data | data no futuro | `false` | `false` | ✅ | — |
| 4 · em uma data | data no passado | `true` | `true` | ✅ | — |
| 4 · em uma data | fuso UTC — futura continua bloqueada | `false` | `false` | ✅ | — |
| 4 · em uma data | fuso UTC — passada continua liberada | `true` | `true` | ✅ | — |
| 4 · em uma data | fuso America/Sao_Paulo — futura continua bloqueada | `false` | `false` | ✅ | — |
| 4 · em uma data | fuso America/Sao_Paulo — passada continua liberada | `true` | `true` | ✅ | — |
| 4 · em uma data | fuso Pacific/Kiritimati — futura continua bloqueada | `false` | `false` | ✅ | — |
| 4 · em uma data | fuso Pacific/Kiritimati — passada continua liberada | `true` | `true` | ✅ | — |
| 5 · N dias após matrícula | matriculada hoje, regra de 7 dias | `false` | `false` | ✅ | — |
| 5 · N dias após matrícula | matriculada há 8 dias | `true` | `true` | ✅ | — |
| 5 · N dias após matrícula | exatamente no limite de 7 dias | `true` | `true` | ✅ | — |
| 5 · N dias após matrícula | faltando 1 hora para os 7 dias | `false` | `false` | ✅ | — |
| 6 · manual | sem liberação registrada | `false` | `false` | ✅ | — |
| 6 · manual | após a instrutora liberar (transição) | `true` | `true` | ✅ | — |
| 6 · manual | liberação NÃO vaza para outra aluna | `false` | `false` | ✅ | — |
| 7 · por turma | aluna da turma correta | `true` | `true` | ✅ | — |
| 7 · por turma | aluna de outra turma | `false` | `false` | ✅ | — |
| 7 · por turma | aluna sem turma | `false` | `false` | ✅ | — |
| transversal | matrícula CANCELADA | `false` | `false` | ✅ | — |
| transversal | matrícula EXPIRADA | `false` | `false` | ✅ | — |
| transversal | matrícula SUSPENSA | `false` | `false` | ✅ | — |
| transversal | aula em RASCUNHO | `false` | `false` | ✅ | — |
| transversal | aula GRATUITA sem matrícula | `true` | `true` | ✅ | — |
| transversal | aula gratuita continua liberada para matriculada | `true` | `true` | ✅ | — |
| transversal | módulo em RASCUNHO bloqueia a aula | `false` | `false` | ✅ | — |
| transversal | curso em RASCUNHO (aula publicada, com matrícula) | `false` | `false` | ✅ | corrigido na migration 14 — antes a função não olhava o status do curso |
| transversal | aula GRATUITA de curso em rascunho | `false` | `false` | ✅ | corrigido na migration 14 |
| transversal | pré-requisito explícito não cumprido | `false` | `false` | ✅ | — |
| transversal | pré-requisito explícito cumprido | `true` | `true` | ✅ | — |
| progresso | 1 de 2 aulas concluídas | `50.00` | `50.00` | ✅ | — |
| progresso | 2 de 2 aulas concluídas | `100.00` | `100.00` | ✅ | — |
| progresso | status vira "completed" | `completed` | `completed` | ✅ | — |
| progresso | completed_at preenchido | `true` | `true` | ✅ | — |

## Motivo textual do bloqueio

Definido em `src/lib/content/gating.ts` e exibido na palheta/linha bloqueada:

| Modo | Texto mostrado à aluna |
| --- | --- |
| `on_date` | "Esta aula abre em {data}." |
| `days_after_enrollment` | "Esta aula abre {N} dias após a sua matrícula." |
| `after_previous_lesson` | "Esta aula abre quando você concluir a aula anterior." |
| `after_previous_module` | "Este módulo abre quando você concluir o módulo anterior." |
| `manual` | "Esta aula é liberada pela instrutora." |
| `by_cohort` | "Esta aula abre junto com a sua turma." |
| sem modo conhecido | "Esta aula ainda não está liberada para você." |
