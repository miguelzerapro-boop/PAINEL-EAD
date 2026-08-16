# Funil — validação final

Gerado em 15/08/2026. Servidor: `http://localhost:3117`, PID único, build
limpo (hashes de CSS servidos conferidos contra o disco).

**Legenda:** ✅ funcionando · ⚠️ depende de configuração · ❌ quebrado

---

## Limite desta validação — leia antes

O `.env.local` tem credenciais **de exemplo** (`https://placeholder.supabase.co`).
Não existe banco, autenticação nem Storage.

Isso significa que **o funil não foi percorrido por dentro**. O que foi feito:

| Verificação | Como |
| --- | --- |
| Rotas respondem, redirecionam ou quebram | navegador real, 19 rotas |
| Links e botões sem destino | varredura do DOM em cada página |
| Destinos internos existem | cada `href` aberto e conferido |
| Lógica de segmentação e destino | PostgreSQL real, 47/47 |
| Regras de acesso e liberação | PostgreSQL real, 54/54 |

O que **não** foi verificado: responder o quiz de verdade, gerar token,
entrar, comprar, matricular. Isso exige Supabase.

Toda página que lê do banco leva **7 a 21 segundos** para responder — é o
tempo que o cliente Supabase gasta até desistir do endereço falso. Com
credenciais reais isso cai para milissegundos. Não é lentidão da aplicação.

---

## Diagrama

```
LANDING  /                                              ✅ responde
   │  "Fazer meu diagnóstico"
   ▼
QUIZ  /diagnostico                                      ⚠️ carrega, perguntas vêm do banco
   │  responde N perguntas · POST /api/diagnostico
   │  salva: lead + quiz_response + consentimento
   │  devolve: token assinado (24 h)
   ▼
RESULTADO  /diagnostico/resultado?t={token}             ⚠️ exige token
   │
   │  resolve_quiz_outcome() decide, nesta ordem:
   │
   ├─ curso publicado ──▶ /cursos/{slug}                ✅ rota existe
   ├─ oferta ativa    ──▶ /checkout/{slug}              ✅ CORRIGIDO nesta rodada
   ├─ página          ──▶ target_path                   ⚠️ vale o que a admin cadastrar
   └─ nada disso      ──▶ WhatsApp                      ⚠️ some sem número configurado
                             │
                             ▼
CHECKOUT  /checkout/{oferta}                            ⚠️ 404 sem oferta publicada
   │  formulário → POST /api/checkout
   │  salva: order (pending) + idempotência
   │  devolve: initPoint do Mercado Pago
   ▼
PAGAMENTO  Mercado Pago (externo)                       ❌ sem credencial
   │
   ▼
WEBHOOK  /api/webhooks/mercadopago                      ❌ sem credencial
   │  salva: payment + order.paid + enrollment (upsert)
   ▼
OBRIGADO  /obrigado                                     ✅ responde
   │  "Entrar"
   ▼
LOGIN  /entrar                                          ⚠️ exige auth do Supabase
   │  link mágico por e-mail → /auth/callback
   │  liga pedidos pagos do mesmo e-mail à conta
   ▼
ÁREA DA ALUNA  /aluna                                   ⚠️ exige sessão
   ▼
CURSO  /aluna/curso/{slug}                              ⚠️ exige matrícula
   ▼
AULA  /aluna/curso/{slug}/{aula}                        ⚠️ exige lesson_is_released()
      vídeo: GET /api/aulas/{id}/video → URL assinada 15 min
```

---

## Rotas — resultado da varredura

| Rota | Status | Tempo | Observação |
| --- | --- | --- | --- |
| `/` | ✅ 200 | 14,1 s | landing completa |
| `/diagnostico` | ✅ 200 | 14,1 s | abertura do quiz |
| `/diagnostico/resultado` | ✅ 200 | 7,1 s | sem token: estado vazio + "Refazer" |
| `/cursos` | ✅ 200 | 21,1 s | catálogo vazio (sem curso publicado) |
| `/entrar` | ✅ 200 | 7,1 s | formulário renderiza |
| `/termos` | ✅ 200 | 14,1 s | texto vem de `settings` |
| `/privacidade` | ✅ 200 | 14,1 s | idem |
| `/reembolso` | ✅ 200 | 16,7 s | idem |
| `/suporte` | ✅ 200 | 14,1 s | idem |
| `/obrigado` | ✅ 200 | 7,1 s | pós-compra |
| `/preview/{chave-inválida}` | ✅ 200 | 26 ms | recusa sem vazar detalhe |
| `/estilo` | ✅ 200 | 24 ms | mostruário interno |
| `/checkout/{inexistente}` | ✅ 404 | 7,1 s | correto |
| `/cursos/{inexistente}` | ✅ 404 | 7,1 s | correto |
| `/rota-que-nao-existe` | ✅ 404 | 20 ms | correto |

**19 rotas testadas. Nenhuma quebrada.**

---

## Redirecionamentos

| Situação | Destino | |
| --- | --- | --- |
| Visitante em `/admin` | `/entrar?proximo=%2Fadmin` | ✅ |
| Visitante em `/admin/formacao` | `/entrar?proximo=%2Fadmin%2Fformacao` | ✅ |
| Visitante em `/aluna` | `/entrar?proximo=%2Faluna` | ✅ |
| Visitante em `/aluna/cursos` | `/entrar?proximo=%2Faluna%2Fcursos` | ✅ |
| Oferta inexistente | 404 | ✅ |
| Curso inexistente | 404 | ✅ |
| Token de preview inválido | 200 com recusa | ✅ |
| Token de resultado ausente | 200 com "Refazer o diagnóstico" | ✅ |

**Não verificados** (exigem sessão): aluna tentando `/admin`, pessoa já
autenticada abrindo `/entrar`, token expirado de verdade.

---

## Botões e links

Varredura do DOM em 16 páginas:

| | |
| --- | --- |
| Links sem `href` | **0** |
| Links para `#` | **0** |
| Destinos internos quebrados | **0** |
| Botões clicáveis sem ação | **0** |

Nenhum botão bonito sem função.

Links legais (Termos, Privacidade, Reembolso) apontam para rotas que existem
e respondem. O conteúdo vem de `settings` — enquanto vazio, a página diz que
o documento ainda não foi publicado, em vez de mostrar texto genérico. O link
de Reembolso só aparece no rodapé depois de o texto ser redigido.

O botão de WhatsApp **desaparece** quando `contact.whatsapp` está vazio —
não vira link morto.

---

## ❌ Defeito encontrado e corrigido

**`resolve_quiz_outcome()` mandava a aluna para uma rota inexistente.**

A função devolvia `/oferta/{slug}`. Essa rota nunca existiu — as rotas são
`/cursos/[slug]`, `/checkout/[oferta]`, `/preview/[key]`.

Consequência: sempre que o diagnóstico resolvia para uma **oferta**, o botão
da tela de resultado levava a um 404. O funil morria no ponto de venda.

Passou despercebido porque só acontece nesse caminho: com curso publicado o
destino é `/cursos/{slug}`, que funciona; sem oferta ativa cai no WhatsApp,
que também funciona.

Corrigido em `supabase/migrations/27_corrige_destino_da_oferta.sql`,
que também reescreve as respostas já gravadas com o destino errado.

Provado contra PostgreSQL real:

```
oferta   → /checkout/oferta-x        OK
fallback → whatsapp | Mensagem oficial do quiz | no_published_target
```

> Na primeira tentativa, esta correção quebrou o teste 05-quiz: ao reescrever
> a função copiei uma versão sem a variável `v_fallback`, e a mensagem oficial
> do WhatsApp sumiu. Detectado por `47/47 → 46/47` e corrigido. Ambos os
> comportamentos estão verificados acima.

---

## ⚠️ Eventos do funil — não existem

A pergunta era se `landing_view`, `hero_cta_click`, `quiz_start`,
`quiz_complete`, `whatsapp_click`, `checkout_start` etc. estão sendo
registrados.

**Nenhum deles existe.** Não há nome diferente para mostrar: a instrumentação
nunca foi construída.

O que existe é a **infraestrutura**, sem nada escrevendo nela:

| Peça | Onde | Estado |
| --- | --- | --- |
| Tabela `analytics_events` | migration 09 | criada, com índices |
| Policy de insert anônimo | migration 11 | ativa |
| View `funnel_daily` | migration 09 | criada |
| Retenção LGPD (395 dias) | migration 12 | registrada |
| **Chamadas no `src/`** | — | **zero** |

`grep -rni "analytics" src/` não devolve uma linha.

O que dá para medir hoje, sem eventos: leads, respostas do quiz e pedidos —
que são gravados em tabelas próprias. Não dá para medir abandono entre
etapas, nem taxa de clique no CTA, nem quantas pessoas abrem o resultado e
não clicam no WhatsApp.

Instrumentar é trabalho novo, não configuração. Não fiz porque a pergunta era
o que existe.

---

## Dependências externas

| Etapa | Depende de | Sem isso |
| --- | --- | --- |
| Landing, quiz, catálogo, legais | Supabase | responde em 7-21 s, conteúdo vazio |
| Login e área da aluna | Supabase Auth | não entra |
| Salvar resposta do quiz | Supabase | quiz não conclui |
| Checkout | Mercado Pago | formulário bloqueado, com aviso |
| Pagamento e matrícula | Mercado Pago + webhook | não acontece |
| Vídeo da aula | Supabase Storage | não reproduz |
| WhatsApp | `contact.whatsapp` | botão some |

---

## Pontos mortos

Nenhum ponto morto de navegação. Dois pontos de **parada legítima**, ambos
com mensagem honesta:

1. **Diagnóstico sem curso nem oferta** → WhatsApp. Sem número configurado, a
   tela mostra o texto de encaminhamento sem botão. Correto: melhor do que
   um botão que não abre nada.

2. **Catálogo vazio** → `/cursos` responde e diz que ainda não há curso
   publicado. O link "Cursos" some do menu quando não há nenhum.

---

## Status

`PRONTO PARA HOMOLOGAÇÃO`

Justificativa: as 19 rotas respondem, nenhuma quebrada, zero botão morto,
zero destino inválido, redirecionamentos corretos, e o único defeito
funcional encontrado foi corrigido e provado.

**Não** é `PRONTO PARA ENTREGA AO CLIENTE` porque o funil nunca foi percorrido
de ponta a ponta: ninguém respondeu o quiz, entrou, comprou ou assistiu uma
aula. Tudo isso está verificado no banco e na navegação, mas não numa sessão
real.

Para virar `PRONTO PARA ENTREGA AO CLIENTE`:

1. Supabase de homologação configurado (`docs/23-implantacao.md`)
2. `npm run storage:validate` passando
3. Funil percorrido de ponta a ponta com um lead de teste
4. Decidir sobre os eventos de analytics — entregar sem eles é uma escolha
   defensável, mas precisa ser consciente
