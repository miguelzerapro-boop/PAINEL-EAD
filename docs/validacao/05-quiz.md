# Evidência — diagnóstico (quiz)

**Comando:** `node scripts/homolog/05-quiz.mjs`  
**Ambiente:** homologação local, PostgreSQL 18.4  
**Resultado:** 47/47 verificações conforme o esperado.

> As 7 perguntas vivem em `quiz_questions`/`quiz_options` — **nenhum texto está preso
> em componente React**. O front lê do banco e o painel edita.

| Grupo | Cenário | Esperado | Obtido |  | Nota |
| --- | --- | --- | --- | --- | --- |
| conteúdo | quiz publicado | `"published"` | `"published"` | ✅ | — |
| conteúdo | versão inicial gravada | `1` | `1` | ✅ | — |
| conteúdo | coleta cidade | `true` | `true` | ✅ | — |
| conteúdo | coleta estado | `true` | `true` | ✅ | — |
| conteúdo | coleta apenas o primeiro nome | `true` | `true` | ✅ | — |
| conteúdo | texto de consentimento cadastrado | `true` | `true` | ✅ | — |
| conteúdo | mensagem de encaminhamento exata do escopo | `"Seu diagnostico foi concluido. Nossa equipe vai conversar com voce pelo WhatsApp para entender melhor seu momento e apresentar as opcoes disponiveis."` | `"Seu diagnostico foi concluido. Nossa equipe vai conversar com voce pelo WhatsApp para entender melhor seu momento e apresentar as opcoes disponiveis."` | ✅ | — |
| conteúdo | quantidade de perguntas | `7` | `7` | ✅ | — |
| conteúdo | pergunta 1 — alternativas | `5` | `5` | ✅ | Qual dessas opções mais combina com o seu momento atual? |
| conteúdo | pergunta 2 — alternativas | `6` | `6` | ✅ | O que você mais deseja conquistar com essa profissão? |
| conteúdo | pergunta 3 — alternativas | `8` | `8` | ✅ | Qual é a sua maior dificuldade hoje? |
| conteúdo | pergunta 4 — alternativas | `8` | `8` | ✅ | O que você tem mais interesse em aprender? |
| conteúdo | pergunta 5 — alternativas | `5` | `5` | ✅ | Quanto tempo você conseguiria reservar para estudar e prat |
| conteúdo | pergunta 6 — alternativas | `4` | `4` | ✅ | Quando você gostaria de começar? |
| conteúdo | pergunta 7 — alternativas | `6` | `6` | ✅ | Qual estrutura você possui atualmente? |
| conteúdo | exatamente uma pergunta de múltipla escolha | `1` | `1` | ✅ | — |
| conteúdo | limite de seleção configurável (pergunta 4) | `3` | `3` | ✅ | — |
| conteúdo | alternativas neutras (peso vazio) são poucas e intencionais | `true` | `true` | ✅ | 3 alternativas sem peso |
| conteúdo | nenhuma pergunta promete grade ou curso | `0` | `0` | ✅ | — |
| segmentação | iniciante absoluta | `"comecar_do_zero"` | `"comecar_do_zero"` | ✅ | {"comecar_do_zero":12,"praticar_evoluir":1} |
| segmentação | faz para amigas, quer evoluir | `"praticar_evoluir"` | `"praticar_evoluir"` | ✅ | {"comecar_do_zero":2,"praticar_evoluir":13} |
| segmentação | manicure atuante | `"ja_trabalho"` | `"ja_trabalho"` | ✅ | {"ja_trabalho":8,"praticar_evoluir":7} |
| segmentação | quer organizar a carreira | `"organizar_carreira"` | `"organizar_carreira"` | ✅ | {"ja_trabalho":7,"praticar_evoluir":3,"organizar_carreira":9} |
| segmentação | só pesquisando | `"pesquisando"` | `"pesquisando"` | ✅ | {"ja_trabalho":2,"pesquisando":7,"comecar_do_zero":5,"praticar_evoluir":3} |
| segmentação | múltipla escolha soma os pesos das 3 marcadas | `"organizar_carreira"` | `"organizar_carreira"` | ✅ | {"ja_trabalho":1,"organizar_carreira":5} |
| destino | sem curso publicado → WhatsApp | `"whatsapp"` | `"whatsapp"` | ✅ | no_published_target |
| destino | mensagem do fallback é a oficial | `true` | `true` | ✅ | — |
| destino | com curso publicado → página do curso | `"course"` | `"course"` | ✅ | /cursos/curso-real |
| destino | curso despublicado → volta para WhatsApp | `"whatsapp"` | `"whatsapp"` | ✅ | no_published_target |
| destino | com oferta ativa → página da oferta | `"offer"` | `"offer"` | ✅ | /checkout/o-quiz |
| destino | oferta expirada → volta para WhatsApp | `"whatsapp"` | `"whatsapp"` | ✅ | no_published_target |
| destino | página personalizada configurada | `"page"` | `"page"` | ✅ | /inscricao |
| destino | resultado inexistente → WhatsApp (nunca quebra) | `"whatsapp"` | `"whatsapp"` | ✅ | outcome_not_found |
| lead | consentimento grava o texto exato aceito | `"Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade."` | `"Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade."` | ✅ | — |
| lead | cidade gravada | `"Campinas"` | `"Campinas"` | ✅ | — |
| lead | estado gravado | `"SP"` | `"SP"` | ✅ | — |
| lead | UTM preservada | `"instagram"` | `"instagram"` | ✅ | — |
| lead | resposta persistida | `true` | `true` | ✅ | — |
| lead | mesmo telefone pode refazer o diagnóstico | `false` | `false` | ✅ | de propósito: refazer o diagnóstico é comportamento legítimo; a deduplicação é trabalho do atendimento |
| lead | clique de WhatsApp registrado com origem | `"quiz_result"` | `"quiz_result"` | ✅ | — |
| versão | histórico da publicação inicial | `1` | `1` | ✅ | — |
| versão | snapshot guarda as 7 perguntas | `7` | `7` | ✅ | — |
| versão | snapshot guarda os 5 resultados | `5` | `5` | ✅ | — |
| versão | publicar de novo incrementa a versão | `2` | `2` | ✅ | — |
| versão | histórico ganha uma entrada | `2` | `2` | ✅ | — |
| versão | despublicar volta para rascunho | `"draft"` | `"draft"` | ✅ | — |
| versão | publicar sem nenhuma pergunta é recusado | `true` | `true` | ✅ | O diagnóstico não pode ser publicado sem nenhuma pergunta publicada. |

## Como a segmentação funciona

Cada alternativa carrega pesos por resultado em `quiz_options.weights`:

```json
{ "praticar_evoluir": 3, "comecar_do_zero": 1 }
```

O sistema soma os pesos de tudo que foi marcado e escolhe o maior. Os pesos são
editáveis pelo painel — recalibrar a segmentação não exige mudar código.

## O que a pergunta 4 NÃO faz

A pergunta sobre interesse ("Fundamentos", "Técnicas modernas", "Preços e organização"…)
descreve **temas da profissão**, não módulos de um curso. Nenhuma alternativa afirma que
existe formação sobre aquilo. O destino continua sendo resolvido contra o banco.
