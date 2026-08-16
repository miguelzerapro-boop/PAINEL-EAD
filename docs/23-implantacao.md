# Colocar no ar — do zero, sem gastar nada

Guia de implantação. Do projeto vazio até o site funcionando, no plano
gratuito.

---

## O que custa (e o que não custa)

| | Plano gratuito | Quando passa a custar |
| --- | --- | --- |
| Banco de dados | 500 MB | quase nunca — é tudo texto |
| Contas de aluna | 50.000/mês | quase nunca |
| Hospedagem (Vercel) | grátis para projeto pessoal | tráfego alto |
| **Arquivos (vídeo)** | **1 GB** | **rápido — é aqui que dói** |
| Tráfego de saída | 5 GB/mês | quando as alunas assistirem |

Tudo — landing, diagnóstico, login, painel, os 8 capítulos, matrícula,
pedidos — cabe no gratuito com folga. **O único gargalo é vídeo:** 1 GB dá
para umas duas aulas de 40 min.

Isso significa que dá para colocar o site inteiro no ar, demonstrar e vender
sem pagar nada. A conta só aparece quando as aulas de verdade forem
publicadas — e aí é custo de operação da escola, não de quem desenvolveu.

### Quando o vídeo crescer

Para 8 capítulos × 6 aulas (~24 GB) com 100 alunas assistindo:

| | Custo mensal |
| --- | --- |
| Supabase Pro | ~US$ 47 (US$ 25 + excedente de tráfego) |
| Cloudflare R2 só para vídeo | ~US$ 0,21 (não cobra tráfego de saída) |

O que pesa não é guardar o arquivo, é **entregar**. O R2 não cobra por isso.

**Não migre agora.** O envio resumível deste projeto fala TUS, que é do
Supabase Storage; o R2 fala S3 multipart. Trocar é reescrever a camada de
envio, não mudar uma variável. Vale quando a conta de tráfego justificar.

---

## Passo a passo

### 1. Criar o projeto

Em [supabase.com](https://supabase.com) → **New project**.

- Região: **South America (São Paulo)** — é a mais perto das alunas.
- Guarde a senha do banco. Ela aparece uma vez só.

Provisionar leva uns 2 minutos.

### 2. Pegar as credenciais

**Project Settings → API Keys:**

| No painel | No `.env.local` |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (`sb_secret_…`) | `SUPABASE_SECRET_KEY` |

Se o projeto ainda mostrar as chaves antigas (`anon` / `service_role`), use
`NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. A aplicação
aceita os dois formatos.

**Project Settings → Database → Connection string → URI:**

Vai em `SUPABASE_DB_URL`. Troque `[YOUR-PASSWORD]` pela senha do passo 1.

> A chave secreta e a string de conexão **nunca** saem do `.env.local` ou do
> gerenciador de segredos do ambiente. Não vão em mensagem, documentação,
> issue, log ou captura de tela.

### 3. Conferir

```bash
npm run storage:preflight
```

Diz o que falta sem imprimir valor nenhum. Precisa dar tudo `OK`.

### 4. Aplicar o schema

```bash
npm run deploy:schema
```

Roda as migrations em ordem, uma vez cada, e confere no fim:

```
  capítulos da formação ..... 8   (esperado: 8)
  bucket lesson-videos ...... criado
  aulas cadastradas ......... 0   (esperado: 0 — nenhuma é inventada)
```

Pode rodar de novo à vontade: aplica só o que falta.

**Não roda o seed de demonstração.** O seed cria conteúdo fictício — bom em
teste local, veneno num projeto que vai virar produção.

### 5. Criar a administradora

O projeto não nasce com ninguém dentro. Um admin criado por migration seria
uma conta com senha conhecida por quem leu o repositório.

1. Rode o site (`npm run dev`) e entre uma vez em `/entrar` com o e-mail da
   responsável. O link de acesso chega por e-mail.
2. Depois:

```bash
npm run deploy:admin -- email@da-responsavel.com
```

Do segundo administrador em diante, o acesso se concede pelo painel.

### 6. Provar que o vídeo funciona

```bash
npm run storage:validate
```

Sobe um MP4 de teste **em dois blocos**, consulta o offset entre eles para
provar a retomada, liga o arquivo a uma aula, confirma que a aluna
matriculada assiste e que aluna sem matrícula, anônimo e URL expirada **não**
assistem — e apaga tudo que criou.

Se passar, o Storage está homologado.

---

## Publicar

### Vercel

1. Importe o repositório.
2. Cole as mesmas variáveis em **Settings → Environment Variables**.
3. Deploy.

O `vercel.json` já está no repositório com o cron de publicação agendada.
Ele chama `/api/cron/publicar`, que publica conteúdo com data marcada e
expira matrículas vencidas.

**O plano Hobby da Vercel só permite cron DIÁRIO.** Por isso o agendamento é
`0 9 * * *` — uma vez por dia, 6h no horário de Brasília.

Consequência prática: conteúdo agendado para as 14h só entra no ar na manhã
seguinte. Para publicação na hora marcada há dois caminhos:

- **Vercel Pro** (US$ 20/mês) libera cron de 15 em 15 minutos;
- **cron externo gratuito** (cron-job.org, por exemplo) chamando
  `/api/cron/publicar` com o cabeçalho `Authorization: Bearer ${CRON_SECRET}`.

Para o keep-alive do Supabase gratuito, o cron diário basta: uma visita por
dia já evita a pausa por inatividade de uma semana.

Defina também `CRON_SECRET` — sem ele a rota recusa qualquer chamada.

### O detalhe que salva o plano gratuito

**Projeto gratuito pausa depois de 1 semana sem uso.** Péssimo para um site
que fica no ar esperando visita.

Neste projeto isso se resolve sozinho: o cron toca o banco a cada 15 minutos,
e isso conta como atividade. O projeto não pausa. Sem custo.

Se ainda assim pausar (cron desligado, por exemplo), é só entrar no painel do
Supabase e restaurar — nenhum dado se perde.

---

## Antes de mostrar para o cliente

- [ ] `npm run storage:preflight` tudo `OK`
- [ ] `npm run deploy:schema` com 8 capítulos e o bucket criado
- [ ] administradora promovida e entrando no painel
- [ ] `npm run storage:validate` passando
- [ ] em **Ajustes**, preencher: nome do site, WhatsApp, e-mail, razão social,
      CNPJ, endereço, termos, privacidade
- [ ] a formação continua em **rascunho** até a responsável decidir publicar

O site esconde sozinho o que não estiver preenchido — botão de WhatsApp sem
número não aparece, curso sem descrição não publica. Não é preciso caçar
texto de exemplo: ele não existe.

---

## Quando algo não funciona

| Sintoma | Causa provável |
| --- | --- |
| `/`, `/cursos` e `/diagnostico` travam | credenciais ainda de exemplo |
| `deploy:schema` não conecta | senha errada na `SUPABASE_DB_URL`, ou projeto ainda provisionando |
| `deploy:admin` diz que não há conta | a pessoa ainda não entrou uma vez pelo site |
| `storage:validate` recusa rodar | `storage:preflight` acusa o que falta |
| Upload de vídeo dá 403 | a conta não é admin nem instrutora do curso |
| Projeto pausado | 1 semana sem atividade; restaure no painel e confira o cron |
