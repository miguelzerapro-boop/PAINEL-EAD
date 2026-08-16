# Mercado Pago — status por camada

Este documento existe porque "Mercado Pago implementado" não diz nada útil.
Cada camada tem um estado diferente.

| Camada | Estado | Evidência |
|---|---|---|
| **Estrutura de banco** | ✅ criada e testada | `orders`, `payments`, `payment_webhook_events`, `coupons`, `offers`. Migrations executadas; unicidade de `provider_payment_id` e de `event_key` provadas em `02-constraints.md` |
| **Interface** | ✅ criada | `/checkout/[oferta]` com formulário, resumo e bloqueio automático quando falta credencial; `/obrigado` lendo o estado do pedido no banco |
| **Integração escrita** | ✅ código existe | `src/lib/mercadopago/checkout.ts` (preferência), `webhook.ts` (assinatura HMAC + idempotência), `src/app/api/webhooks/mercadopago/route.ts` |
| **Integração testada contra o Mercado Pago** | ⛔ **BLOQUEADA** | Nenhuma credencial disponível. Nenhuma chamada real foi feita a nenhum endpoint do Mercado Pago em nenhum momento |
| **Credenciais** | ⛔ ausentes | `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_NOTIFICATION_URL` |

Nenhum token do Mercado Pago aparece neste repositório, nas evidências ou nos logs.
`isCheckoutConfigured()` desabilita o formulário e mostra aviso quando as variáveis faltam.

---

## O que foi possível provar sem credencial

Testado contra PostgreSQL real (`docs/validacao/07-e2e.md`, etapas 12 e 14–16):

| Item | Resultado |
|---|---|
| Criação do pedido com preço lido da **oferta**, nunca do cliente | ✅ |
| Registro do evento de webhook | ✅ |
| **Webhook repetido é recusado** (unique em `event_key`) — base da idempotência | ✅ `23505` |
| Pagamento duplicado recusado (unique em `provider,provider_payment_id`) | ✅ `23505` |
| Matrícula criada **uma única vez** mesmo com webhook processado duas vezes | ✅ 1 matrícula |
| Oferta sem preço não pode ser publicada nem vendida | ✅ constraint |
| Pedido pago vincula à conta no primeiro login pelo e-mail da compra | ✅ lógica em `/auth/callback` (executada em `07-e2e.md` etapa 17) |

---

## O que continua sem teste — a lista completa

Todos os itens abaixo estão **bloqueados por falta de credencial**, não por falta de código:

- criação real de preferência de checkout
- pagamento por **Pix**
- pagamento por **cartão**
- pagamento **pendente** (boleto/Pix aguardando)
- pagamento **aprovado**
- pagamento **recusado**
- pagamento **expirado**
- recebimento real do **webhook** com assinatura verdadeira
- validação da assinatura `x-signature` com segredo real
- **reembolso** e **estorno**
- falha após aprovação (ex.: banco fora do ar no momento da liberação)
- comprador que já possui conta

---

## Como destravar

1. Criar credenciais de **teste** no painel do Mercado Pago (não as de produção).
2. Preencher no `.env.local`:
   ```
   MERCADOPAGO_ACCESS_TOKEN=TEST-...
   NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-...
   MERCADOPAGO_WEBHOOK_SECRET=...
   MERCADOPAGO_NOTIFICATION_URL=https://<túnel>/api/webhooks/mercadopago
   ```
3. Expor o webhook por um túnel (ngrok, Cloudflare Tunnel) — o Mercado Pago precisa
   alcançar a URL de fora.
4. Usar os **cartões de teste** do Mercado Pago para forçar aprovado, recusado e pendente.
5. Reenviar o mesmo evento pelo painel de webhooks para confirmar a idempotência
   ponta a ponta (o banco já prova a trava; falta provar o caminho HTTP).

Enquanto isso não acontecer, o projeto **não pode** ser considerado pronto para produção.
