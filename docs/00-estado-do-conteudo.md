# Estado do conteúdo — o que existe e o que ainda não foi definido

Documento de referência. **Nada nesta lista foi inventado pelo projeto.**

---

## 1. O que já estava definido no escopo

Estas são as únicas informações de conteúdo autorizadas, e todas vieram do briefing:

| Item | Status |
|---|---|
| Funil: landing → diagnóstico → WhatsApp / vendas → checkout → EAD | definido |
| Meio de pagamento: **Mercado Pago** | definido |
| Os cinco resultados do diagnóstico (momentos da pessoa) | definidos — ver abaixo |
| Mensagem de encaminhamento quando não há curso publicado | definida — texto exato no banco |
| Área da aluna com progresso, materiais, atividades, certificado | definida como *funcionalidade* |
| Painel administrativo com CMS, rascunho, preview, agendamento, histórico | definido como *funcionalidade* |
| Conformidade: LGPD, acessibilidade, responsividade, performance | definido |

**Os cinco resultados do diagnóstico** (autorizados no escopo, cadastrados em `quiz_outcomes`):

1. Quero começar do zero
2. Já pratico e quero evoluir
3. Já trabalho na área
4. Quero organizar minha carreira
5. Ainda estou pesquisando

Eles descrevem **o momento da pessoa**, não um produto. Nenhum aponta para um curso.

**As sete perguntas do diagnóstico** também foram aprovadas no escopo e estão cadastradas
em `quiz_questions`/`quiz_options` (migration `0017`). Elas não são conteúdo pedagógico:
são o roteiro de qualificação do lead. Nenhuma cita técnica, módulo, carga horária ou nome
de curso. A pergunta 4 fala de **interesse**, com temas genéricos da profissão, e não
promete que exista formação sobre eles.

Tudo é editável pelo painel em `/admin/quiz`, com rascunho, publicação, versão e histórico.

---

## 2. O que NÃO foi definido — e por isso não existe no projeto

Nenhum destes itens foi inventado. Cada um tem campo próprio no banco, vazio, esperando cadastro.

| Item | Onde será cadastrado | O que acontece enquanto estiver vazio |
|---|---|---|
| Nome definitivo dos cursos | `courses.name` | Catálogo e vitrine não renderizam |
| Quantidade de cursos | — | O site funciona com zero cursos |
| Grade curricular | `modules` + `lessons` | Seção "o que você vai encontrar" some |
| Quantidade e nomes dos módulos | `modules` | idem |
| Quantidade e títulos das aulas | `lessons` | idem |
| Duração das aulas | `lessons.duration_seconds` (NULL) | Duração não aparece; nunca vira "0 min" |
| Ordem pedagógica | `modules.position`, `lessons.position` | — |
| Materiais complementares | `materials` | Seção "Materiais" não renderiza |
| Atividades | `activities` | Seção "Atividade" não renderiza |
| Avaliações | `assessments` | — |
| Carga horária | `courses.workload_minutes` (NULL) | Não aparece na página do curso |
| Critérios para certificado | `courses.completion_criteria` | Padrão conservador: 100% de progresso |
| Instrutoras | `instructors` | Bloco "quem ensina" não renderiza sem biografia |
| Preço final | `offers.price_cents` (NULL) | **Constraint impede publicar oferta sem preço**; bloco de investimento e botão de compra somem |
| Prazo de acesso | `courses.access_mode` | Padrão: sem prazo |

### Também não definidos (e igualmente não inventados)

- Bônus, garantia comercial, número de alunas, depoimentos, resultados
- Formação e experiência da instrutora
- Datas, vagas, turmas
- Nome do site, logotipo, razão social, CNPJ, endereço
- Número de WhatsApp
- Textos de termos de uso, privacidade e reembolso
- Perguntas do quiz (só os **resultados** foram definidos)
- Todas as fotos (ver `image_slots` — 20 vagas, todas pendentes)

---

## 3. Travas técnicas que impedem conteúdo inventado de ir ao ar

Não são convenções: são regras no banco de dados.

| Trava | Onde | O que impede |
|---|---|---|
| `courses_publish_requires_description` | `courses` | Publicar curso sem descrição curta |
| `offers_publish_requires_price` | `offers` | Publicar oferta sem preço |
| `testimonials_publish_requires_proof` | `testimonials` | Publicar depoimento não verificado ou sem consentimento |
| `public_metrics_publish_requires_source` | `public_metrics` | Publicar número sem fonte e sem data de medição |
| `media_ai_not_real` | `media_assets` | Marcar imagem de banco ou de IA como retrato de pessoa real |
| `media_real_person_needs_consent` | `media_assets` | Foto de pessoa real sem consentimento registrado |
| `tg_cms_section_validate` | `cms_sections` | Publicar bloco com campo obrigatório vazio |
| RLS em `cms_sections` | leitura pública | Bloco com pendência nunca chega ao site público |
| Verificação final do `seed.sql` | seed | Conteúdo de demonstração publicado |

---

## 4. Conteúdo de demonstração

O `seed.sql` cria **um** pacote, todo marcado `is_demo = true` e todo em rascunho:

- 1 curso — *"Curso de demonstração — substituir no painel"*
- 1 módulo, 1 aula (sem vídeo, para exercitar o estado "vídeo ainda não enviado")
- 1 material, 1 atividade, 1 avaliação com 1 pergunta
- 1 instrutora, 1 produto, 1 oferta (sem preço), 1 categoria, 1 nível

Descrição de todos: *"Este conteúdo existe apenas para testar a plataforma e deve ser removido antes da publicação."*

**Remoção:** botão "Remover conteúdo de teste" no painel, ou `select public.remove_demo_content();`
O painel mostra um alerta permanente enquanto restar qualquer registro demonstrativo.
