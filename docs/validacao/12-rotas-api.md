# Inventário das rotas `/api/*` e de servidor

**Estado desta etapa:** as rotas estão **implementadas e compilando**, e a lógica que
elas chamam está validada contra PostgreSQL real. O que **não** foi feito é executá-las
por HTTP contra um Supabase de verdade — isso depende de um projeto de homologação que
ainda não existe. Ver "Bloqueio" no fim.

---

## Rotas HTTP

### `POST /api/diagnostico`

| Item | Valor |
|---|---|
| Autenticação | nenhuma (público) |
| Papel exigido | — |
| Entrada | `quizSubmissionSchema` (zod): `quizSlug`, `sessionId`, `answers`, `lead{name,email?,phone,city?,state?}`, `consent: true`, `utm?` |
| Saída | `{ token }` — token HMAC de 24 h contendo só o id da resposta |
| Tabelas / RPC | `quizzes`, `quiz_questions`, `quiz_options`, `consents`, `leads`, `quiz_responses`, RPC `resolve_quiz_outcome` |
| Efeitos colaterais | cria consentimento, lead e resposta |
| Idempotência | **não** — refazer o diagnóstico é comportamento legítimo; a deduplicação é trabalho do atendimento |
| Rate limit | 10 por IP a cada 10 min |
| Service role | **sim, justificado**: o funil público não tem policy de `insert` para `anon`, de propósito |
| Testado | lógica: `05-quiz.mjs` 47/47 · transporte HTTP: **bloqueado** |

Decisões que valem registro:
- o segmento é calculado **no banco** (`quiz_segment`), não no navegador;
- o limite de múltipla escolha é **reaplicado no servidor** (`limitarSelecoes`) — o bloqueio da interface é conforto, não segurança;
- o consentimento grava o **texto exato** aceito, não um booleano;
- a mensagem de erro devolvida é neutra; a do banco fica no log.

### `POST /api/checkout`

| Item | Valor |
|---|---|
| Autenticação | opcional — compra sem conta é permitida |
| Papel exigido | — |
| Entrada | `offerSlug`, `buyer{name,email,phone,document}`, `couponCode?`, `idempotencyKey?` |
| Saída | `{ initPoint, reference, reaproveitado }` |
| Tabelas / RPC | `offers`, `coupons`, `orders` |
| Efeitos colaterais | cria pedido `pending` e preferência no Mercado Pago |
| Idempotência | **sim** — chave por visita à tela, reaproveita pedido pendente; a mesma chave vai para o Mercado Pago |
| Rate limit | 12 por IP a cada 10 min |
| Service role | sim — escreve pedido para visitante sem conta |
| Testado | **bloqueado** (exige credencial do Mercado Pago) |

O preço **nunca** vem do cliente: é lido da oferta publicada. `user_id` vem da sessão, nunca do corpo.

### `POST /api/webhooks/mercadopago`

| Item | Valor |
|---|---|
| Autenticação | assinatura HMAC `x-signature` |
| Entrada | payload do Mercado Pago |
| Saída | `{ status }` |
| Tabelas | `payment_webhook_events`, `payments`, `orders`, `enrollments`, `product_courses` |
| Idempotência | **sim** — `unique(provider, event_key)`; evento repetido devolve `duplicate` sem reprocessar |
| Service role | sim — não há sessão em webhook |
| Testado | idempotência do banco: `02-constraints.mjs` ✅ · chamada real: **bloqueado** |

Não confia no payload: consulta o pagamento na API pelo id. Assinatura inválida → `401`. Falha nossa → `500`, para o Mercado Pago reenviar.

### `GET /api/cron/publicar`

| Item | Valor |
|---|---|
| Autenticação | `Authorization: Bearer ${CRON_SECRET}` |
| RPC | `publish_scheduled_content`, `expire_enrollments` |
| Idempotência | natural — só age sobre o que está vencido |
| Testado | funções validadas em banco real; agendamento: **bloqueado** |

### `GET /auth/callback`

Troca o código do link mágico por sessão e **liga pedidos pagos** do mesmo e-mail à conta recém-criada, criando as matrículas. Idempotente via `upsert ... ignoreDuplicates`.

---

## Server Actions do painel (`src/app/admin/acoes.ts`)

Todas passam por `exigirAdmin()` antes de qualquer escrita e gravam revisão com autor.

| Ação | Escreve em | Validação | Testado |
|---|---|---|---|
| `salvarCurso` | `courses` | zod + constraints do banco | constraints ✅ |
| `salvarRegistro` | whitelist de 9 entidades em `specs.ts` | tabela **definida no servidor**, nunca vinda do formulário | — |
| `salvarRascunhoBloco` | `cms_sections.draft_content` | — | — |
| `publicarBloco` | `cms_sections` | trigger `tg_cms_section_validate` | constraints ✅ |
| `salvarAjustes` | `settings` | — | — |

---

## Entrega de arquivo privado (`src/lib/storage/assinado.ts`)

Não é rota HTTP: é chamado por Server Components. A sequência é sempre a mesma —
sessão real → o **banco** decide → URL assinada curta.

| Função | Verificação | Validade |
|---|---|---|
| `urlDeMidiaDaAula` | RPC `lesson_is_released` + o caminho tem de conter o `lessonId` | 900 s |
| `urlDaEntrega` | RLS de `storage.objects` + dono/staff | 600 s |
| `urlDoFeedback` | dono ou staff | 600 s |
| `urlDoCertificado` | RLS de `certificates` | 300 s |
| `urlDaFotoDeDepoimento` | RLS exige publicado + verificado + consentido | 3600 s |
| `urlDeEnvioDeEntrega` | caminho **montado no servidor** a partir do `auth.uid()` | 7200 s |

A service role vive só neste arquivo (`server-only`). Nenhuma URL assinada é gravada no banco.

---

## Regras do escopo — situação

| Regra | Situação |
|---|---|
| Não desabilitar RLS para as rotas funcionarem | ✅ nenhuma rota desliga RLS |
| Não usar service role em tudo | ✅ 3 clientes distintos; service role só em webhook, funil público e cron |
| Validar entrada no servidor | ✅ zod em toda rota pública |
| Não confiar em IDs do cliente | ✅ `user_id` sempre da sessão; caminho de upload montado no servidor |
| Não aceitar `user_id` arbitrário | ✅ testado — `42501` na policy de Storage |
| Não expor mensagem interna do banco | ✅ rotas devolvem texto neutro e logam o resto |
| Não retornar secrets | ✅ nenhuma rota devolve chave |
| Idempotência em escrita sensível | ✅ webhook (unique key) e checkout (chave por visita) |
| Rate limit | ⚠️ **parcial** — balde em memória, por instância. Contém repetição acidental, não ataque distribuído |

---

## Bloqueio

Nenhuma destas rotas foi executada por HTTP contra um Supabase real, porque **não há
projeto de homologação nem credencial neste ambiente**:

```
.env.local ......................... não existe
SUPABASE_ACCESS_TOKEN .............. não definido
supabase projects list ............. "Access token not provided"
MERCADOPAGO_ACCESS_TOKEN ........... não definido
```

Criar o projeto exige a conta Supabase da responsável. O que já está pronto para o
momento em que a credencial existir:

- `scripts/homolog/07-compat.mjs` aceita `PGHOMOLOG_URL` e compara o Supabase com o
  PostgreSQL local sonda a sonda;
- todos os scripts de teste (`01`–`09`) rodam contra qualquer PostgreSQL via a mesma
  variável;
- `.env.example` lista cada variável necessária, com exemplo fictício.
