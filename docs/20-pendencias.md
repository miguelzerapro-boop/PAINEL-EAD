# Pendências — o que precisa ser preenchido antes de publicar

Checklist operacional. O painel (`/admin`) mostra esta mesma lista, viva, a partir do banco.

---

## 1. Bloqueia o site de ir ao ar

### 1.1 Ajustes obrigatórios (`/admin/ajustes`)

| Chave | O que é |
|---|---|
| `site.name` | Nome do site |
| `site.logo_media_id` | Logotipo |
| `contact.whatsapp` | Número de WhatsApp (só dígitos, com DDI) |
| `contact.email` | E-mail de contato |
| `legal.company_name` | Razão social |
| `legal.tax_id` | CNPJ ou CPF |
| `legal.address` | Endereço |
| `legal.terms` | Texto dos termos de uso |
| `legal.privacy` | Texto da política de privacidade |
| `legal.refund` | Texto da política de reembolso |
| `legal.dpo_contact` | Contato do encarregado de dados (LGPD) |
| `seo.default_title` | Título padrão |
| `seo.default_description` | Descrição padrão |
| `seo.og_image_media_id` | Imagem de compartilhamento (1200×630) |

Enquanto `contact.whatsapp` estiver vazio, **todo botão de WhatsApp some do site** — não aponta para número falso.

### 1.2 Variáveis de ambiente

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Mercado Pago → Suas integrações |
| `MERCADOPAGO_WEBHOOK_SECRET` | Mercado Pago → Webhooks → Configurar notificações |
| `MERCADOPAGO_NOTIFICATION_URL` | URL pública de `/api/webhooks/mercadopago` |
| `CMS_PREVIEW_SECRET`, `DIAGNOSTIC_SECRET`, `CRON_SECRET` | Gerar (ex.: `openssl rand -hex 32`) |

Sem as credenciais do Mercado Pago o checkout aparece **bloqueado com aviso** — não quebra.

### 1.3 Remover o conteúdo de demonstração

`/admin` → "Remover conteúdo de teste". O alerta some quando não restar nenhum registro `is_demo`.

---

## 2. Conteúdo pedagógico — a decidir com a responsável

Nada aqui foi criado pelo projeto. Cada linha é uma decisão que ainda não foi tomada.

- [ ] Quantos cursos existirão e como se chamam
- [ ] A grade de cada curso: quantos módulos, com que nomes, em que ordem
- [ ] As aulas de cada módulo: títulos, ordem, tipo de conteúdo, duração
- [ ] Carga horária total de cada curso
- [ ] Materiais complementares
- [ ] Atividades práticas e como serão corrigidas
- [ ] Avaliações e nota mínima
- [ ] Critérios de conclusão e se haverá certificado
- [ ] Regra de liberação: tudo de uma vez, por módulo, por data, por dias após a matrícula, manual ou por turma
- [ ] Quem são as instrutoras; biografia e formação (texto real, fornecido por elas)
- [ ] Prazo de acesso
- [ ] Preço e número de parcelas
- [ ] Se haverá garantia — e qual (a política de reembolso precisa existir antes)

### Perguntas do quiz — ✅ concluído

As 7 perguntas e as 42 alternativas estão cadastradas e publicadas (migration `0017`),
com os pesos por resultado e a regra da pergunta-âncora (`0019`). Editáveis em
`/admin/quiz`. Nada aqui pendente.

---

## 6. Lacunas técnicas conhecidas

Levantadas pela validação de 30/07/2026 ([`docs/validacao/00-relatorio.md`](validacao/00-relatorio.md)):

- [ ] **Policies de Storage não existem.** Os buckets não foram criados e as regras não
      foram escritas. Vídeos e PDFs privados **não estão protegidos hoje** — é o item mais
      urgente antes de subir qualquer material real.
- [ ] Emissão do PDF do certificado (`certificates.pdf_url` nunca é preenchido)
- [ ] E-mail transacional (nenhum e-mail é enviado em nenhum momento)
- [ ] Rate limit em `/api/diagnostico` e `/api/checkout`
- [ ] Reprocessamento automático de webhook que falhou
- [ ] Rotina de expurgo LGPD (as políticas de retenção estão cadastradas, mas nada apaga)
- [ ] Validar as migrations em PostgreSQL **15** (a validação rodou em 18.4)
- [ ] Baixar as fontes para o repositório — o build depende do Google Fonts e já falhou
      uma vez com `ETIMEDOUT`

---

## 3. Produção fotográfica

20 vagas cadastradas em `image_slots`, todas pendentes. A lista completa, com dimensões,
proporção e orientação, está em `/admin/midia`.

**Resumo do que precisa ser fotografado:**

| Grupo | Fotos |
|---|---|
| Landing | abertura horizontal (2400×1600) + recorte vertical para celular (1200×1600) |
| Instrutora | retrato 4:5, trabalhando 3:2, ensinando 3:2 |
| Detalhe | mãos em macro 1:1, sequência de camadas 1:1 |
| Ambiente | bancada montada 3:2, materiais 1:1, espaço 16:9, bastidor da gravação 3:2 |
| Portfólio | 3 trabalhos reais 4:5, evolução prática 5:3 |
| Alunas | retrato e prática — **só com autorização de imagem registrada** |
| EAD | capa padrão de curso 16:9, faixa de abertura 8:3 |
| SEO | imagem de compartilhamento 1200×630 |

**Regras que o sistema aplica sozinho:**

- Enquanto a vaga estiver pendente, aparece um placeholder que **diz que a foto não existe** e informa as dimensões — nunca uma foto de banco.
- `media_assets.source` registra a procedência (`own_shoot`, `client_provided`, `stock`, `ai_generated`, `illustration`).
- Uma constraint impede marcar imagem de banco ou gerada por IA como retrato de pessoa real.
- Outra constraint exige consentimento registrado para qualquer foto de pessoa real.

**A direção de arte** (`image_slots.art_direction`) fica em branco de propósito: será definida junto com o ensaio, quando a identidade oficial existir. O que já está definido é a parte estrutural — quais fotos, em que proporção, com que enquadramento.

---

## 4. Identidade visual

A paleta e a tipografia atuais são **provisórias e substituíveis**. Estão inteiramente em
`src/styles/tokens.css`. Trocar os valores lá muda o site inteiro — nenhum componente
declara cor, fonte, espaçamento ou raio literal.

Quando a identidade oficial chegar:

1. substituir os valores de `--brand-*` e `--surface-*`;
2. conferir contraste (mínimo 4,5:1 para texto, 3:1 para elementos de interface);
3. se a fonte mudar, trocar em `src/app/layout.tsx` e nos tokens `--font-*`.

---

## 5. LGPD — antes de divulgar

- [ ] Redigir e publicar termos de uso, privacidade e reembolso
- [ ] Definir o contato do encarregado de dados
- [ ] Revisar a política de retenção em `retention_policies` (padrões conservadores já cadastrados)
- [ ] Definir quem responde os pedidos de titular em `/admin/lgpd` (prazo padrão: 15 dias)
- [ ] Coletar autorização de uso de imagem para qualquer foto de aluna ou instrutora
