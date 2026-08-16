# Relatório de validação

**Data:** 31/07/2026
**Produção:** intocada. Nenhum deploy. Nenhum banco de produção acessado.

## STATUS

# `PRONTO PARA HOMOLOGAÇÃO LOCAL DO NÚCLEO`

Não é `HOMOLOGADO` nem `PRONTO PARA PRODUÇÃO`. O motivo está em
[Bloqueios](#bloqueios): não existe projeto Supabase nem credencial de Mercado Pago
neste ambiente, e sem isso os itens integrados não podem ser executados.

---

## Resumo das evidências

| # | O que foi validado | Resultado | Arquivo |
|---|---|---|---|
| 01 | Migrations (21 arquivos) + reset repetido | ✅ 2× SUCESSO, em duas versões | [01-migrations.md](01-migrations.md) |
| 02 | Constraints com inserts reais | ✅ 43/43 | [02-constraints.md](02-constraints.md) |
| 03 | As sete regras de liberação | ✅ 44/44 | [03-liberacao.md](03-liberacao.md) |
| 04 | RLS com 7 perfis | ✅ 55/55 | [04-rls.md](04-rls.md) |
| 05 | Diagnóstico: conteúdo, segmentação, versão | ✅ 47/47 | [05-quiz.md](05-quiz.md) |
| 06 | Inspeção visual, 4 larguras | ✅ 10 defeitos corrigidos | [06-visual.md](06-visual.md) |
| 07 | E2E do núcleo | ✅ 24/25 · 1 bloqueada | [07-e2e.md](07-e2e.md) |
| 08 | Mercado Pago por camada | ⛔ integração não testada | [08-mercadopago.md](08-mercadopago.md) |
| 09 | **PG 15.18 × PG 18.4** | ✅ 47/47 sondas idênticas | [09-compatibilidade.md](09-compatibilidade.md) |
| 10 | **Storage: buckets e policies** | ✅ 48/48 | [10-storage.md](10-storage.md) |
| 11 | **Primeiro administrador** | ✅ 16/16 | [11-admin.md](11-admin.md) |
| 12 | **Inventário das rotas `/api/*`** | ⚠️ código pronto, HTTP não testado | [12-rotas-api.md](12-rotas-api.md) |

**253 verificações executadas contra PostgreSQL real, todas conforme o esperado, em duas
versões diferentes do PostgreSQL.**

---

## O que mudou nesta etapa

### Bloqueio nº 5 eliminado — diferença de versão

A dúvida era: o schema foi validado em PostgreSQL 18.4, mas o Supabase roda 15.

Instalei o **PostgreSQL 15.18** — mesma linha do Supabase — em paralelo, na porta 55433, e
rodei **a suíte inteira nas duas versões**. Depois escrevi 47 sondas de comportamento
sobre exatamente as construções que o escopo listou: `bool_and`, `NULL`, security definer,
`search_path`, enums, JSONB, índices parciais, triggers, fusos, grants, RLS, funções via
RPC, tipos de retorno.

```
PG 15.18 · 213 verificações · todas conforme
PG 18.4  · 213 verificações · todas conforme
sondas de comportamento: 47/47 idênticas · 0 divergência
```

Isto **não substitui** rodar no Supabase — falta PostgREST, API de Storage e GoTrue. Mas a
dúvida sobre a *versão do PostgreSQL* foi respondida com execução, não com suposição.

### Bloqueio nº 1 eliminado — Storage

O projeto **não tinha bucket nenhum**. Qualquer vídeo ou PDF enviado ficaria sem proteção.

A migration `0020` cria **10 buckets** e **24 policies**:

| Bucket | Acesso | Caminho | Quem lê |
|---|---|---|---|
| `cms-media`, `course-covers`, `instructor-media` | 🌐 público | — | qualquer pessoa · **só admin envia** |
| `lesson-videos`, `lesson-assets` | 🔒 privado | `{course_id}/{lesson_id}/…` | quem tem a aula liberada |
| `student-submissions` | 🔒 privado | `{user_id}/{activity_id}/…` | a aluna, a instrutora do curso, admin |
| `submission-feedback` | 🔒 privado | `{user_id}/{submission_id}/…` | a aluna dona e a equipe |
| `certificates` | 🔒 privado | `{user_id}/{certificate_id}.pdf` | a dona e o admin · **só o servidor grava** |
| `profile-avatars` | 🔒 privado | `{user_id}/…` | a própria pessoa |
| `testimonials` | 🔒 privado | `{testimonial_id}/…` | **ninguém pelo cliente** |

Provado por execução (48/48), entre outras coisas:

- Aluna B **não lê nem substitui** a entrega da Aluna A;
- trocar o `{user_id}` no caminho para gravar na pasta de outra aluna → `42501`;
- vídeo de aula **trancada** não aparece nem na listagem;
- instrutora enxerga os cursos que leciona e **só** eles;
- comercial e financeiro **não leem** entrega de aluna;
- tipo MIME proibido e arquivo acima do limite são recusados;
- arquivo removido deixa de ser acessível.

**Por que depoimento é bucket privado:** a foto é de uma aluna real. Bucket público serve
o arquivo a qualquer pessoa que tenha a URL, inclusive antes de o depoimento ser
publicado. O site recebe URL assinada, e só quando o depoimento está publicado, verificado
e com consentimento registrado.

### Entrega de conteúdo pago

`src/lib/storage/assinado.ts`: nenhum vídeo sai por URL pública permanente. A sequência é
sempre sessão real → **o banco decide** (`lesson_is_released`) → URL assinada de 15 min. A
service role vive só nesse arquivo, marcado `server-only`. Nenhuma URL assinada é gravada
no banco. O caminho de upload é **montado no servidor** a partir do `auth.uid()` — o
cliente não escolhe onde grava.

### Primeiro administrador

O README mandava editar a tabela na mão, e isso já falhou em silêncio uma vez. Agora
existe `bootstrap_first_admin()` com quatro travas, todas testadas (16/16):

1. só roda enquanto **não houver** nenhum admin ou owner;
2. só de contexto de servidor (`auth.uid()` nulo) — SQL Editor ou service role;
3. `EXECUTE` revogado de `anon` e `authenticated` — não há como tentar pelo navegador;
4. grava em `audit_log` quem virou owner e quando.

Mais: `set_user_role()` concede e revoga depois, com auditoria, e **ninguém altera o
próprio papel** — nem o owner. Uma aluna tentando se promover continua `student`.

### Endurecimento das rotas

- **Rate limit** em `/api/diagnostico` (10 por IP a cada 10 min) e `/api/checkout` (12).
- **Idempotência de checkout**: chave por visita à tela; duplo clique, aba duplicada ou
  retry reaproveitam o pedido pendente. A mesma chave vai para o Mercado Pago.
- Defeito encontrado ao escrever isso e corrigido: a gravação da preferência
  **substituía** o `metadata` do pedido e apagava a `idempotency_key`. Agora mescla.

---

## Classificação

### ✅ Implementado e testado

Execução real contra PostgreSQL 15.18 **e** 18.4:

- 21 migrations, instalação limpa, reset repetido duas vezes
- 56 tabelas, 8 enums, 1 view, 143 índices, 118 FKs, 71 CHECKs
- RLS ligada em **todas** as tabelas · 106 policies no `public` · 24 no `storage`
- As 7 regras de liberação: caso liberado, bloqueado, transição, fuso horário
- Matrícula cancelada, expirada, suspensa, sem matrícula, curso e aula em rascunho
- Constraints: oferta sem preço, depoimento sem prova, métrica sem fonte, bloco
  incompleto, imagem de IA como pessoa real, matrícula/pagamento/certificado duplicados
- Matriz de RLS com 7 perfis, incluindo comercial e financeiro
- Matriz de Storage com 8 perfis
- Diagnóstico: 7 perguntas, 42 alternativas, segmentação dos 5 perfis, versionamento
- Bootstrap e revogação de administrador
- Isolamento do conteúdo demonstrativo (9/9): não vaza em nenhuma superfície pública
- Inspeção visual em 1440 / 834 / 390 / 360 px

### ⚠️ Implementado, mas não testado em execução

- Rotas `/api/*` por HTTP contra Supabase real — inventário em [12-rotas-api.md](12-rotas-api.md)
- Geração de URL assinada pela API de Storage (a *policy* está testada; a *assinatura* é
  do servidor de Storage)
- Expiração da URL assinada
- Limite de tamanho e MIME aplicados pela API de Storage — aqui foram emulados por
  trigger, o que prova a **configuração do bucket**, não a aplicação pela API
- Publicação agendada por cron
- Envio de e-mail do link mágico (GoTrue)
- Rate limit sob concorrência real

### ⛔ Bloqueado

| Item | Depende de |
|---|---|
| Criar o Supabase de homologação | conta Supabase da responsável |
| Rodar migrations no ambiente alvo | idem |
| Testes HTTP das rotas | idem |
| Buckets criados no Storage real | idem |
| Qualquer chamada ao Mercado Pago | credencial de teste |
| Webhook público | credencial + túnel |
| E2E integrado | as duas acima |
| Screenshots com dados reais | Supabase populado |

Verificado neste ambiente:

```
.env.local ......................... não existe
SUPABASE_ACCESS_TOKEN .............. não definido
supabase projects list ............. "Access token not provided"
MERCADOPAGO_ACCESS_TOKEN ........... não definido
```

### ❌ Não implementado

- Geração do PDF do certificado — a tabela, a elegibilidade e o bucket existem; o desenho
  e a renderização, não
- Rate limit distribuído (hoje é por instância)
- Regra de revogação de acesso em caso de reembolso — **decisão comercial pendente**,
  deixada configurável de propósito
- Envio de e-mail transacional além do link mágico

---

## Separação entre o shim de teste e o Supabase real

| | `scripts/homolog/00-auth-shim.sql` | `supabase/migrations/*.sql` |
|---|---|---|
| Onde roda | só no PostgreSQL embarcado local | Supabase |
| Cria schema `auth`? | **sim** — `auth.users`, `auth.uid()`, `auth.role()` | **nunca** |
| Cria schema `storage`? | **sim** — `buckets`, `objects`, `foldername()` | **nunca** — só INSERT em `buckets` e CREATE POLICY |
| Cria papéis `anon`/`authenticated`/`service_role`? | **sim** | **nunca** |
| Emula limite de tamanho e MIME? | **sim**, por trigger | não — quem aplica é a API de Storage |
| Vai para produção? | **não** | sim |
| Importado pelo runtime? | **não** — é SQL, fora de `src/` | — |

O shim é aplicado apenas por `scripts/homolog/lib.mjs`, no passo `resetCompleto()`, antes
das migrations. Nenhum arquivo em `src/` o referencia. O `auth.uid()` do shim lê
`request.jwt.claim.sub`, exatamente como o Supabase — é o que torna os testes de RLS
fiéis.

**O que o shim não cobre, e por isso continua por verificar:** PostgREST (tradução de HTTP
para SQL e forma dos erros), GoTrue (fluxo real do link mágico) e o servidor de Storage
(assinatura de URL, limite de upload, expiração).

---

## Bloqueios

Para sair de `PRONTO PARA HOMOLOGAÇÃO LOCAL DO NÚCLEO`, preciso de duas coisas suas.

### 1. Um projeto Supabase de homologação

Crie um projeto **separado do de produção** e grave em `.env.local` (já está no
`.gitignore`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
```

Com isso eu rodo, nesta ordem:

```bash
npx supabase link --project-ref <ref-de-homologacao>
npx supabase db push                                    # 21 migrations
PGHOMOLOG_URL="$SUPABASE_DB_URL" node scripts/homolog/07-compat.mjs supabase
node scripts/homolog/07-compat.mjs --comparar pg15 supabase
PGHOMOLOG_URL="$SUPABASE_DB_URL" node scripts/homolog/02-constraints.mjs
# …03, 04, 05, 08, 09 — todos aceitam a mesma variável
```

### 2. Credenciais de **teste** do Mercado Pago

```
MERCADOPAGO_ACCESS_TOKEN=TEST-...
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-...
MERCADOPAGO_WEBHOOK_SECRET=...
```

Sem dinheiro real. Com elas eu executo os 24 casos de pagamento do escopo, incluindo
webhook repetido, evento fora de ordem e matrícula única.

**Não crio nenhum desses ambientes por conta própria** — ambos exigem sua conta, e o
escopo é explícito em não tocar produção.

---

## Como reproduzir tudo que está aqui

```bash
npm install

# Sobe os dois PostgreSQL locais
powershell -File scripts/homolog/iniciar-banco.ps1 -Versao 18   # porta 55432
powershell -File scripts/homolog/iniciar-banco.ps1 -Versao 15   # porta 55433

# Suíte completa — troque a porta para repetir na outra versão
export PGHOMOLOG_PORT=55432
node scripts/homolog/01-migrations.mjs     # migrations + reset duplo
node scripts/homolog/02-constraints.mjs    # 43 casos
node scripts/homolog/03-liberacao.mjs      # 44 casos
node scripts/homolog/04-rls.mjs            # 55 verificações
node scripts/homolog/05-quiz.mjs           # 47 verificações
node scripts/homolog/06-e2e.mjs            # fluxo principal
node scripts/homolog/08-storage.mjs        # 48 verificações
node scripts/homolog/09-admin.mjs          # 16 verificações

# Compatibilidade entre versões
PGHOMOLOG_PORT=55433 node scripts/homolog/07-compat.mjs pg15
PGHOMOLOG_PORT=55432 node scripts/homolog/07-compat.mjs pg18
node scripts/homolog/07-compat.mjs --comparar pg15 pg18

# Visual
npm run build && npx next start -p 3117
node scripts/screenshots.mjs http://localhost:3117 atual
```

Os scripts rodam em transação com `rollback` ou limpam o que criaram. Podem ser
executados quantas vezes for preciso — o de Storage foi verificado três vezes seguidas
com o mesmo resultado.
