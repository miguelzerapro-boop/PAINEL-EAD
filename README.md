# Plataforma de formação profissional em manicure e nail design

Funil de captação, checkout e área de ensino a distância.

> ## Aviso importante sobre o conteúdo
>
> **Nenhuma informação pedagógica deste projeto foi definida ou aprovada.**
> Não existe grade curricular, nome de curso, quantidade de módulos, título de aula,
> carga horária, preço, prazo de acesso ou biografia de instrutora neste repositório.
>
> O que existe é a **infraestrutura completa e editável** para que tudo isso seja
> cadastrado depois, pelo painel administrativo.
>
> O `seed.sql` cria **um** curso de demonstração, todo marcado, em rascunho, e com a
> descrição *"Este conteúdo existe apenas para testar a plataforma e deve ser removido
> antes da publicação."* Remova-o antes de qualquer divulgação.

---

## Como rodar

```bash
# 1. dependências
npm install

# 2. ambiente
cp .env.example .env.local     # e preencha

# 3. banco local (precisa do Docker)
npx supabase start
npx supabase db reset          # aplica migrations + seed de demonstração

# 4. tipos do banco (opcional, recomendado)
npm run db:types

# 5. aplicação
npm run dev
```

Sem Docker, use um projeto Supabase na nuvem e rode `npx supabase db push`.

### Primeiro administrador

O primeiro perfil nasce como `student`. Promova pelo SQL Editor do Supabase:

```sql
update public.profiles set role = 'owner' where email = 'seu@email.com';
```

> Isto só funciona a partir da migration `0016`. Antes dela, o trigger de guarda de papel
> descartava a alteração em silêncio — defeito encontrado na validação de RLS.

---

## Validação

O projeto tem uma suíte que roda contra um **PostgreSQL real**, sem Docker:

```bash
npm run homolog:up     # sobe um PostgreSQL 18 embarcado em localhost:55432
npm run validar        # 222 verificações: migrations, constraints, liberação, RLS, quiz, E2E
npm run homolog:down
```

Para a inspeção visual (usa o Chrome/Edge já instalado):

```bash
npm run build && npx next start -p 3117
npm run screenshots    # 15 rotas × 4 larguras, detecta rolagem horizontal
```

As evidências de cada execução ficam em [`docs/validacao/`](docs/validacao/) — comece pelo
[relatório consolidado](docs/validacao/00-relatorio.md), que traz o status atual do projeto,
o que foi testado, o que não foi e o que está bloqueado.

---

## Estrutura

```
docs/
  00-estado-do-conteudo.md   o que existe, o que falta, e as travas contra conteúdo inventado
  01-arquitetura.md          stack, rotas, fluxo de pagamento, segurança
  10-direcao-visual.md       universo da marca, 3 direções, escolha, assinatura, tipografia
  11-wireframes.md           wireframes de baixa fidelidade de todas as telas
  20-pendencias.md           checklist do que precisa ser preenchido

supabase/
  migrations/                13 migrations, na ordem
  seed.sql                   conteúdo de demonstração (remover antes de publicar)

src/
  app/                       rotas (público, aluna, admin, api)
  components/                palheta, trilho, estados, foto pendente, blocos do CMS
  lib/                       supabase, mercadopago, cms, funil, gating, formatação
  styles/                    tokens.css → base.css → components.css → layouts.css
```

---

## Como o projeto impede conteúdo inventado

Não são convenções de código: são regras no banco.

| Trava | Impede |
|---|---|
| `offers_publish_requires_price` | Publicar oferta sem preço |
| `courses_publish_requires_description` | Publicar curso sem descrição |
| `testimonials_publish_requires_proof` | Depoimento sem verificação e sem consentimento |
| `public_metrics_publish_requires_source` | Número sem fonte e sem data |
| `media_ai_not_real` | Imagem de IA ou de banco marcada como pessoa real |
| `tg_cms_section_validate` | Bloco de página com campo obrigatório vazio |

Além disso: duração e carga horária nulas **não viram zero** — o campo simplesmente não é
exibido; o botão de WhatsApp só existe se o número estiver cadastrado; a vitrine de cursos
some se não houver curso publicado; e o resultado do diagnóstico nunca afirma que existe
uma trilha — ele consulta o banco e, sem curso publicado, encaminha para o WhatsApp.

---

## Design

A direção visual escolhida é **"Mostruário"**: a plataforma é organizada como um mostruário
profissional de amostras. O elemento de assinatura é a **palheta pendurada num trilho** —
usada como curso, módulo, aula, etapa do quiz e item de progresso, com estados
*disponível / em andamento / concluída / bloqueada*.

O raciocínio completo — universo da marca, as três direções avaliadas, o motivo da escolha,
a tipografia e as proibições respeitadas — está em [`docs/10-direcao-visual.md`](docs/10-direcao-visual.md).

Tipografia: **Fraunces** (destaque), **IBM Plex Sans** (leitura e interface), **IBM Plex Mono**
(números e códigos). Nenhuma das fontes proibidas no escopo.

Toda a identidade é substituível a partir de `src/styles/tokens.css`.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run db:reset` | Recria o banco local com migrations + seed |
| `npm run db:push` | Aplica migrations no projeto remoto |
| `npm run db:types` | Gera `src/types/database.ts` |
