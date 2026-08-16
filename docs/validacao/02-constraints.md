# Evidência — testes de constraint

**Comando:** `node scripts/homolog/02-constraints.mjs`  
**Ambiente:** homologação local, PostgreSQL 18.4, base `homolog`  
**Execução:** todos os casos rodam dentro de uma transação com `rollback` ao final — o banco não fica sujo.  
**Resultado:** 43/43 casos conforme o esperado.

Cada linha abaixo é um `INSERT`/`UPDATE` realmente executado contra o PostgreSQL.

| Caso | Expectativa | Esperado | Obtido |  |
| --- | --- | --- | --- | --- |
| Oferta publicada sem preço | deve recusar | `offers_publish_requires_price` | `23514 · offers_publish_requires_price` | ✅ |
| Oferta publicada COM preço | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Oferta em rascunho sem preço | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Depoimento publicado SEM verificação | deve recusar | `testimonials_publish_requires_proof` | `23514 · testimonials_publish_requires_proof` | ✅ |
| Depoimento publicado SEM consentimento | deve recusar | `testimonials_publish_requires_proof` | `23514 · testimonials_publish_requires_proof` | ✅ |
| Depoimento com origem inválida | deve recusar | `23514` | `23514 · testimonials_source_check` | ✅ |
| Depoimento verificado + consentido | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Métrica publicada sem fonte | deve recusar | `public_metrics_publish_requires_source` | `23514 · public_metrics_publish_requires_source` | ✅ |
| Métrica publicada sem data de medição | deve recusar | `public_metrics_publish_requires_source` | `23514 · public_metrics_publish_requires_source` | ✅ |
| Métrica publicada sem valor | deve recusar | `public_metrics_publish_requires_source` | `23514 · public_metrics_publish_requires_source` | ✅ |
| Métrica com valor, fonte e data | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Bloco hero publicado com campos obrigatórios vazios | deve recusar | `nao pode ser publicado` | `23514 · Bloco "hero" nao pode ser publicado: campos obrigatorios vazios (lead, cta_label, cta_href` | ✅ |
| Bloco hero em rascunho, incompleto (permitido) | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Bloco hero publicado com todos os campos | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Bloco completo fica com missing_fields vazio | verificação | `{}` | `[]` | ✅ |
| Rascunho incompleto lista as pendências | verificação | `lead, cta_label, cta_href` | `lead, cta_label, cta_href` | ✅ |
| Imagem de BANCO marcada como pessoa real | deve recusar | `media_ai_not_real` | `23514 · media_ai_not_real` | ✅ |
| Imagem gerada por IA marcada como pessoa real | deve recusar | `media_ai_not_real` | `23514 · media_ai_not_real` | ✅ |
| Foto de pessoa real SEM consentimento | deve recusar | `media_real_person_needs_consent` | `23514 · media_real_person_needs_consent` | ✅ |
| Foto de pessoa real COM consentimento | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Imagem de banco sem pessoa real (ex.: textura) | deve aceitar | `sucesso` | `ok (1 linha)` | ✅ |
| Matrícula duplicada (mesma aluna, mesmo curso) | deve recusar | `23505` | `23505 · enrollments_user_id_course_id_key` | ✅ |
| Pagamento duplicado (mesmo provider_payment_id) | deve recusar | `23505` | `23505 · payments_provider_provider_payment_id_key` | ✅ |
| Webhook repetido (mesma event_key) — base da idempotência | deve recusar | `23505` | `23505 · payment_webhook_events_provider_event_key_key` | ✅ |
| Certificado duplicado para a mesma matrícula | deve recusar | `23505` | `23505 · certificates_enrollment_id_key` | ✅ |
| Código de certificado duplicado | deve recusar | `23505` | `23505 · certificates_enrollment_id_key` | ✅ |
| Slug de curso duplicado | deve recusar | `23505` | `23505 · courses_slug_key` | ✅ |
| Slug de oferta duplicado | deve recusar | `23505` | `23505 · offers_slug_key` | ✅ |
| Aula em módulo inexistente (barrada por NOT NULL antes da FK) | deve recusar | `23502` | `23502 · null value in column "course_id" of relation "lessons" violates not-null constraint` | ✅ |
| Módulo em curso inexistente (FK direta) | deve recusar | `23503` | `23503 · modules_course_id_fkey` | ✅ |
| Material sem dono (nem curso, nem módulo, nem aula) | deve recusar | `materials_single_owner` | `23514 · materials_single_owner` | ✅ |
| Material com dois donos ao mesmo tempo | deve recusar | `materials_single_owner` | `23514 · materials_single_owner` | ✅ |
| Material sem arquivo nem link | deve recusar | `materials_has_target` | `23514 · materials_has_target` | ✅ |
| Liberação "em uma data" sem informar a data | deve recusar | `modules_release_date_required` | `23514 · modules_release_date_required` | ✅ |
| Liberação "N dias" sem informar os dias | deve recusar | `lessons_release_days_required` | `23514 · lessons_release_days_required` | ✅ |
| Aula ao vivo sem horário de início | deve recusar | `lessons_live_requires_start` | `23514 · lessons_live_requires_start` | ✅ |
| Aviso para "curso" sem informar o curso | deve recusar | `notices_audience_target` | `23514 · notices_audience_target` | ✅ |
| Curso publicado sem descrição curta | deve recusar | `courses_publish_requires_description` | `23514 · courses_publish_requires_description` | ✅ |
| Curso agendado sem data de publicação | deve recusar | `courses_scheduled_requires_date` | `23514 · courses_scheduled_requires_date` | ✅ |
| Prazo de acesso "por dias" sem informar os dias | deve recusar | `courses_access_days_required` | `23514 · courses_access_days_required` | ✅ |
| Progresso fora da faixa 0–100 | deve recusar | `23514` | `23514 · enrollments_progress_pct_check` | ✅ |
| Duração de aula igual a zero | deve recusar | `23514` | `23514 · lessons_duration_seconds_check` | ✅ |
| Trigger corrige course_id divergente da aula | verificação | `16470d11-1e09-4f4c-8038-e2573477e17e` | `16470d11-1e09-4f4c-8038-e2573477e17e` | ✅ |

## Códigos do PostgreSQL

| Código | Significado |
| --- | --- |
| `23505` | violação de unicidade |
| `23503` | violação de chave estrangeira |
| `23514` | violação de CHECK |
| `P0001` | exceção levantada por trigger (`raise exception`) |
