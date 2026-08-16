# Evidência — execução das migrations

## Ambiente

| Item | Valor |
| --- | --- |
| Tipo | **HOMOLOGAÇÃO LOCAL** — não é produção, não é o Supabase |
| Motor | PostgreSQL 18.4 embarcado (`@embedded-postgres/windows-x64`) |
| Host | `localhost:55432` (só loopback) |
| Base | `homolog` |
| Autenticação | `trust` em loopback — sem credencial a ocultar |
| Schema `auth` | **shim** de `scripts/homolog/00-auth-shim.sql` |
| Backup | dispensável: base criada do zero por este script |
| Comando | `node scripts/homolog/01-migrations.mjs` |

> **Divergência conhecida:** o Supabase roda PostgreSQL 15 e aqui a validação
> foi feita em 18.4, porque não há Docker nesta máquina. O DDL usado é padrão
> e não depende de recurso exclusivo de nenhuma das duas versões, mas isto
> **não substitui** rodar `supabase db reset` antes de ir para produção.

## Reset 1 — SUCESSO (1878 ms)

| # | Arquivo | Tipo | Resultado | Tempo | Avisos |
| --- | --- | --- | --- | --- | --- |
| 1 | `00-auth-shim.sql` | shim | ok | 35 ms | — |
| 2 | `01_foundation.sql` | migration | ok | 46 ms | — |
| 3 | `02_identity_media.sql` | migration | ok | 38 ms | — |
| 4 | `03_catalog.sql` | migration | ok | 102 ms | — |
| 5 | `04_learning.sql` | migration | ok | 80 ms | — |
| 6 | `05_enrollment.sql` | migration | ok | 34 ms | — |
| 7 | `06_commerce.sql` | migration | ok | 56 ms | — |
| 8 | `07_funnel.sql` | migration | ok | 61 ms | — |
| 9 | `08_cms.sql` | migration | ok | 46 ms | — |
| 10 | `09_compliance_analytics.sql` | migration | ok | 37 ms | — |
| 11 | `10_business_logic.sql` | migration | ok | 4 ms | — |
| 12 | `11_rls.sql` | migration | ok | 21 ms | — |
| 13 | `12_bootstrap.sql` | migration | ok | 9 ms | — |
| 14 | `13_demo_cleanup.sql` | migration | ok | 2 ms | — |
| 15 | `14_corrige_liberacao.sql` | migration | ok | 2 ms | — |
| 16 | `15_papeis_comercial_financeiro.sql` | migration | ok | 4 ms | — |
| 17 | `16_corrige_guarda_de_papel.sql` | migration | ok | 1 ms | — |
| 18 | `17_quiz_perguntas.sql` | migration | ok | 14 ms | — |
| 19 | `18_corrige_remocao_demo.sql` | migration | ok | 1 ms | — |
| 20 | `19_segmentacao_ancora.sql` | migration | ok | 3 ms | — |
| 21 | `20_storage.sql` | migration | ok | 15 ms | — |
| 22 | `21_bootstrap_admin.sql` | migration | ok | 2 ms | — |
| 23 | `22_biblioteca_comunidade.sql` | migration | ok | 93 ms | — |
| 24 | `23_formacao_capitulos.sql` | migration | ok | 5 ms | — |
| 25 | `24_upload_video_aula.sql` | migration | ok | 14 ms | — |
| 26 | `25_upload_resumivel.sql` | migration | ok | 4 ms | — |
| 27 | `26_vagas_de_imagem_landing.sql` | migration | ok | 1 ms | — |
| 28 | `27_corrige_destino_da_oferta.sql` | migration | ok | 4 ms | — |
| 29 | `seed.sql` | seed | ok | 10 ms | NOTICE: Seed de demonstracao aplicado. Rode select public.remove_demo_content() antes de publicar. |

## Reset 2 — SUCESSO (1530 ms)

| # | Arquivo | Tipo | Resultado | Tempo | Avisos |
| --- | --- | --- | --- | --- | --- |
| 1 | `00-auth-shim.sql` | shim | ok | 23 ms | — |
| 2 | `01_foundation.sql` | migration | ok | 30 ms | — |
| 3 | `02_identity_media.sql` | migration | ok | 29 ms | — |
| 4 | `03_catalog.sql` | migration | ok | 69 ms | — |
| 5 | `04_learning.sql` | migration | ok | 50 ms | — |
| 6 | `05_enrollment.sql` | migration | ok | 28 ms | — |
| 7 | `06_commerce.sql` | migration | ok | 42 ms | — |
| 8 | `07_funnel.sql` | migration | ok | 43 ms | — |
| 9 | `08_cms.sql` | migration | ok | 46 ms | — |
| 10 | `09_compliance_analytics.sql` | migration | ok | 35 ms | — |
| 11 | `10_business_logic.sql` | migration | ok | 5 ms | — |
| 12 | `11_rls.sql` | migration | ok | 23 ms | — |
| 13 | `12_bootstrap.sql` | migration | ok | 7 ms | — |
| 14 | `13_demo_cleanup.sql` | migration | ok | 2 ms | — |
| 15 | `14_corrige_liberacao.sql` | migration | ok | 4 ms | — |
| 16 | `15_papeis_comercial_financeiro.sql` | migration | ok | 3 ms | — |
| 17 | `16_corrige_guarda_de_papel.sql` | migration | ok | 1 ms | — |
| 18 | `17_quiz_perguntas.sql` | migration | ok | 13 ms | — |
| 19 | `18_corrige_remocao_demo.sql` | migration | ok | 1 ms | — |
| 20 | `19_segmentacao_ancora.sql` | migration | ok | 2 ms | — |
| 21 | `20_storage.sql` | migration | ok | 17 ms | — |
| 22 | `21_bootstrap_admin.sql` | migration | ok | 3 ms | — |
| 23 | `22_biblioteca_comunidade.sql` | migration | ok | 123 ms | — |
| 24 | `23_formacao_capitulos.sql` | migration | ok | 6 ms | — |
| 25 | `24_upload_video_aula.sql` | migration | ok | 10 ms | — |
| 26 | `25_upload_resumivel.sql` | migration | ok | 4 ms | — |
| 27 | `26_vagas_de_imagem_landing.sql` | migration | ok | 1 ms | — |
| 28 | `27_corrige_destino_da_oferta.sql` | migration | ok | 1 ms | — |
| 29 | `seed.sql` | seed | ok | 10 ms | NOTICE: Seed de demonstracao aplicado. Rode select public.remove_demo_content() antes de publicar. |

## Inventário do banco após o reset

| Objeto | Quantidade | Nomes |
| --- | --- | --- |
| Extensões | 3 | pg_trgm, pgcrypto, unaccent |
| Enums | 13 | access_mode, content_type, conversation_kind, conversation_status, enrollment_status, lesson_progress_status, material_access, material_kind, moderation_status, order_status, publication_status, release_mode, user_role |
| Tabelas | 71 | activities, activity_submissions, analytics_events, assessment_attempts, assessment_options, assessment_questions, assessments, audit_log, certificates, cms_block_types, cms_pages, cms_preview_tokens, cms_revisions, cms_sections, cohorts, community_channels, community_comments, community_posts, community_reactions, community_reports, consents, conversation_participants, conversations, coupons, course_categories, course_instructors, course_levels, courses, data_requests, enrollments, faqs, image_slots, instructors, leads, lesson_blocks, lesson_captions, lesson_checklist_items, lesson_checklist_marks, lesson_progress, lesson_video_uploads, lessons, library_materials, manual_releases, material_categories, material_favorites, material_progress, materials, media_assets, messages, modules, notice_reads, notices, notifications, offers, orders, payment_webhook_events, payments, product_courses, products, profiles, public_metrics, quiz_options, quiz_outcomes, quiz_questions, quiz_responses, quizzes, retention_policies, settings, storage_buckets_doc, testimonials, whatsapp_clicks |
| Views | 1 | funnel_daily |
| Funções | 123 | activity_course, admin_bootstrap_status, armor, armor, bootstrap_first_admin, channel_is_visible, course_outline, crypt, current_role, dearmor, decrypt, decrypt_iv, demo_content_exists, digest, digest, encrypt, encrypt_iv, enrollment_is_active, expire_enrollments, fips_mode, gen_random_bytes, gen_random_uuid, gen_salt, gen_salt, gin_extract_query_trgm, gin_extract_value_trgm, gin_trgm_consistent, gin_trgm_triconsistent, grant_admin_all, gtrgm_compress, gtrgm_consistent, gtrgm_decompress, gtrgm_distance, gtrgm_in, gtrgm_options, gtrgm_out, gtrgm_penalty, gtrgm_picksplit, gtrgm_same, gtrgm_union, hmac, hmac, instructor_teaches, is_admin, is_eligible_for_certificate, is_finance, is_sales, is_staff, issue_certificate, lesson_has_student_history, lesson_is_released, lesson_video_is_ready, material_is_available, module_is_released, orphan_lesson_videos, path_segment, pgp_armor_headers, pgp_key_id, pgp_pub_decrypt, pgp_pub_decrypt, pgp_pub_decrypt, pgp_pub_decrypt_bytea, pgp_pub_decrypt_bytea, pgp_pub_decrypt_bytea, pgp_pub_encrypt, pgp_pub_encrypt, pgp_pub_encrypt_bytea, pgp_pub_encrypt_bytea, pgp_sym_decrypt, pgp_sym_decrypt, pgp_sym_decrypt_bytea, pgp_sym_decrypt_bytea, pgp_sym_encrypt, pgp_sym_encrypt, pgp_sym_encrypt_bytea, pgp_sym_encrypt_bytea, publish_quiz, publish_scheduled_content, quiz_scores, quiz_segment, quiz_snapshot, recalc_enrollment_progress, remove_demo_content, resolve_quiz_outcome, set_limit, set_user_role, show_limit, show_trgm, similarity, similarity_dist, similarity_op, slugify, storage_instructor_of_submission, storage_is_owner, storage_lesson_released, strict_word_similarity, strict_word_similarity_commutator_op, strict_word_similarity_dist_commutator_op, strict_word_similarity_dist_op, strict_word_similarity_op, tg_audit_row, tg_cms_section_validate, tg_conversa_toca, tg_enrollment_set_expiry, tg_handle_new_user, tg_lesson_progress_recalc, tg_lesson_sync_course, tg_profiles_guard_role, tg_recontar_comentarios, tg_recontar_reacoes, tg_set_updated_at, try_uuid, unaccent, unaccent, unaccent_init, unaccent_lexize, unpublish_quiz, unread_conversations, word_similarity, word_similarity_commutator_op, word_similarity_dist_commutator_op, word_similarity_dist_op, word_similarity_op |
| Triggers | 52 | activities_set_updated_at, activity_submissions_set_updated_at, assessments_set_updated_at, cms_pages_set_updated_at, cms_sections_audit, cms_sections_set_updated_at, cms_sections_validate, cohorts_set_updated_at, community_channels_set_updated_at, community_comments_recontar, community_posts_set_updated_at, community_reactions_recontar, coupons_set_updated_at, course_categories_set_updated_at, course_levels_set_updated_at, courses_audit, courses_set_updated_at, enrollments_audit, enrollments_set_expiry, enrollments_set_updated_at, faqs_set_updated_at, image_slots_set_updated_at, instructors_set_updated_at, leads_set_updated_at, lesson_blocks_set_updated_at, lesson_progress_recalc, lesson_progress_set_updated_at, lesson_video_uploads_set_updated_at, lessons_set_updated_at, lessons_sync_course, library_materials_set_updated_at, material_categories_set_updated_at, materials_set_updated_at, media_assets_set_updated_at, messages_tocam_conversa, modules_set_updated_at, notices_set_updated_at, offers_audit, offers_set_updated_at, on_auth_user_created, orders_audit, orders_set_updated_at, payments_set_updated_at, products_set_updated_at, profiles_audit, profiles_guard_role, profiles_set_updated_at, public_metrics_set_updated_at, quiz_outcomes_set_updated_at, quizzes_set_updated_at, settings_set_updated_at, testimonials_set_updated_at |
| Índices | 184 | — |
| Policies RLS | 161 | — |
| Constraints CHECK | 88 | — |
| Foreign keys | 153 | — |

**Tabelas sem RLS habilitada:** nenhuma ✅

## Conteúdo de demonstração (seed)

| Tabela | Registros demo | Publicados |
| --- | --- | --- |
| courses | 1 | 0 ✅ |
| instructors | 1 | 0 ✅ |
| lessons | 1 | 0 ✅ |
| modules | 1 | 0 ✅ |
| offers | 1 | 0 ✅ |

## Bootstrap estrutural

| Item | Quantidade |
| --- | --- |
| Chaves de configuração | 19 |
| …delas obrigatórias e ainda vazias | 14 |
| Tipos de bloco do CMS | 15 |
| Páginas do CMS | 8 |
| Vagas de foto | 23 |
| Resultados do quiz | 5 |
| Perguntas do quiz | 7 |
| Depoimentos | 0 |
| Políticas de retenção | 5 |
