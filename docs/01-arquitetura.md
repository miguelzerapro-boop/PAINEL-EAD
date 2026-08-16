# Arquitetura

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Aplicação | **Next.js 15**, App Router, TypeScript estrito | Landing com SEO real, checkout server-side, EAD com controle de acesso e admin no mesmo projeto |
| Banco | **Supabase** (PostgreSQL 15) | RLS no banco = a autorização não depende do código da tela |
| Autenticação | Supabase Auth, **link mágico** | O público não precisa administrar mais uma senha; o e-mail já é o canal da matrícula |
| Arquivos | Supabase Storage (bucket `media`) | Vídeos, PDFs, imagens |
| Pagamento | **Mercado Pago** (Checkout Pro) | Definido no escopo |
| Estilo | CSS próprio com tokens | Sem Tailwind, para não herdar a estética de utilitário que o escopo proíbe |

## Princípio central

> **O banco é a autoridade. A interface não decide o que a aluna pode ver.**

Isso aparece em três lugares:

1. **Liberação de conteúdo** — `lesson_is_released()` e `module_is_released()` implementam as sete regras de liberação. A tela chama a função; não reimplementa a lógica.
2. **Publicação** — constraints e triggers impedem publicar conteúdo incompleto. Mesmo que alguém escreva direto no banco, a regra vale.
3. **Autorização** — RLS. O `anon` só enxerga o que está publicado; a aluna só enxerga os próprios dados.

## Mapa de rotas

```
/                          landing (blocos do CMS; sem CMS, estado honesto)
/diagnostico               quiz, uma pergunta por tela
/diagnostico/resultado     resultado, destino resolvido no banco
/cursos                    catálogo público
/cursos/[slug]             página de vendas do curso
/cursos/[slug]/aula/[id]   aula gratuita (degustação)
/checkout/[oferta]         dados + Mercado Pago
/obrigado                  retorno do pagamento
/entrar                    link mágico
/auth/callback             troca o código por sessão e liga matrículas pendentes
/termos /privacidade /reembolso

/aluna                     dashboard
/aluna/curso/[slug]        curso: módulos e aulas com gate
/aluna/curso/[slug]/[aula] aula: adapta ao tipo de conteúdo
/suporte

/admin                     pendências para publicar
/admin/cursos              lista + editor completo
/admin/paginas/[key]       editor de blocos + preview desktop/tablet/mobile
/admin/ajustes             settings (obrigatórios marcados)
/admin/midia               lista de produção fotográfica
/admin/leads               diagnósticos recebidos

/preview/[key]             pré-visualização de rascunho (token assinado)

/api/diagnostico           grava lead + consentimento + resolve destino
/api/checkout              cria pedido e preferência do Mercado Pago
/api/webhooks/mercadopago  confirma pagamento e libera matrícula (idempotente)
/api/cron/publicar         publicação agendada + expiração de matrícula
```

## Três clientes Supabase, com papéis distintos

| Arquivo | Chave | Quando usar |
|---|---|---|
| `lib/supabase/server.ts` | anon + sessão | Server Components e Server Actions. Respeita RLS. |
| `lib/supabase/browser.ts` | anon | Componentes de cliente (login, marcar aula concluída). Respeita RLS. |
| `lib/supabase/admin.ts` | **service role** | Webhook, escrita do funil, cron, painel. **Ignora RLS.** Nunca no cliente. |

O funil público (leads, respostas do quiz, consentimentos, pedidos) **não tem policy de insert para `anon`** de propósito: passa por rota de servidor, onde dá para validar, limitar e registrar o consentimento com o texto exato aceito.

## Fluxo de pagamento

```
checkout  →  POST /api/checkout
             ├─ lê o preço DA OFERTA no banco (nunca do cliente)
             ├─ cria orders (pending)
             ├─ cria preferência no Mercado Pago
             └─ devolve init_point

Mercado Pago  →  POST /api/webhooks/mercadopago
                 ├─ valida assinatura HMAC (x-signature)
                 ├─ insere em payment_webhook_events   ← unique key = idempotência
                 ├─ consulta o pagamento na API
                 ├─ atualiza orders + payments
                 └─ se pago: cria enrollments

primeiro login  →  /auth/callback
                   liga pedidos pagos do mesmo e-mail à conta recém-criada
```

Compra sem login funciona: o pedido guarda o e-mail, e a matrícula é criada quando a pessoa entra pela primeira vez.

## Rotina agendada

`/api/cron/publicar` (autenticada por `CRON_SECRET`) chama duas funções do banco:

- `publish_scheduled_content()` — cursos, módulos, aulas, blocos de página e ofertas com data marcada
- `expire_enrollments()` — matrículas vencidas

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/publicar", "schedule": "*/15 * * * *" }] }
```

## Segurança

- RLS habilitada em **todas** as tabelas, negando por padrão
- `SECURITY DEFINER` nos helpers de papel, para não recursar na RLS de `profiles`
- Trigger `profiles_guard_role` impede alguém se promover a admin
- `assessment_options.is_correct` não é legível pela aluna (só staff); as alternativas chegam por rota de servidor sem esse campo
- Cupons não são legíveis pelo cliente: a validação acontece no servidor
- Headers de segurança em `next.config.ts`; `/admin` e `/aluna` com `noindex`
- Webhook rejeita assinatura inválida com 401

## Acessibilidade

- Foco visível nunca removido; `:focus-visible` com contorno de 2px
- Alvos de toque ≥ 44px (`--target-min`)
- Texto corrido nunca abaixo de 16px
- `prefers-reduced-motion` respeitado em CSS e nos tokens de duração
- Estado bloqueado explica o **motivo** em texto, não só um cadeado
- `aria-live` no carregamento; `role="alert"` nos erros
- Contrastes verificados: texto primário 14,8:1 e secundário 6,9:1 sobre a superfície principal
