# Revisão de design — evidências

Etapa de **design, comunicação e navegação**. Nada de banco, migrations, RLS,
regras de liberação, quiz, APIs, Mercado Pago, estrutura de cursos, CMS, regras
de publicação, constraints ou lógica de negócio foi tocado.

**Comece pelo relatório visual:** abra [`relatorio.html`](relatorio.html) no navegador.
Ele mostra as imagens; este arquivo explica o que elas significam.

> **Leia primeiro a RODADA 2, no fim deste arquivo.** As seções 1 a 6 abaixo são o
> diagnóstico da rodada 1 e ficaram registradas de propósito, mas várias das falhas
> que elas apontam — Mostruário ausente, menu mobile inexistente, "Como funciona"
> com cara de template — **já foram corrigidas**. A rodada 2 traz o placar atual.

---

## 1. Escopo recebido

A mensagem que abriu esta etapa chegou **cortada**. O texto bruto termina em:

```css
--border-strong: #9f8a8f;
```

sem fechar o bloco de código. Verificável no transcript da sessão.

**Recebido e aplicado:**

| Seção | Situação |
|---|---|
| Lista do que não alterar (12 itens) | completa |
| Objetivos da etapa (8 itens) | completa |
| Diagnóstico visual atual | completa |
| Novo posicionamento + 4 alternativas | completa |
| "Não utilize promessas de renda garantida" | completa |
| "Não invente cursos, módulos, números, depoimentos ou resultados" | completa |
| Direção de cor em prosa (9 papéis) | completa |
| Bloco de tokens CSS | **cortado em `--border-strong`** |

**Não recebido:** o fechamento do bloco e qualquer coisa depois dele.

Consequência concreta: a prosa pede "verde profundo e elegante", "âmbar" e
"vermelho intenso", mas o bloco foi cortado antes desses tokens. Os valores de
`--success`, `--warning` e `--error` **são escolha minha**, não sua. O mesmo vale
para `--surface-sunken`, `--text-inverse`, `--text-on-accent`, `--menu-fundo` e
`--brand-primary-suave`.

Nenhuma instrução posterior ao corte foi seguida, porque nenhuma chegou.

### Arquivos alterados

O projeto **não é um repositório git** — não existe commit nem diff para citar.
Os arquivos tocados nesta etapa:

| Arquivo | O que mudou |
|---|---|
| `src/styles/tokens.css` | paleta, escala tipográfica, sombras |
| `src/styles/animacoes.css` | **novo** — três movimentos de marca |
| `src/styles/landing.css` | **novo** — capa, faixa, etapas, momentos, fechamento |
| `src/styles/components.css` | botões, palheta, trilho |
| `src/styles/layouts.css` | bloco LANDING removido (migrou para `landing.css`) |
| `src/app/page.tsx` | novo posicionamento e seção de contraste |
| `src/app/globals.css` | importa `landing.css` e `animacoes.css` |
| `scripts/diag-contraste.mjs` | **novo** — verificação de contraste |
| `scripts/evidencia-landing.mjs` | **novo** |
| `scripts/evidencia-animacoes.mjs` | **novo** |
| `scripts/evidencia-laca.mjs` | **novo** |
| `scripts/diag-laca-zindex.mjs` | **novo** |

---

## 2. Tokens finais

```css
--brand-deep: #421328;          --brand-primary: #6d1737;
--brand-accent: #c69a59;        /* champagne */
--brand-action: #d94a54;        /* traço, marca, detalhe */
--brand-action-hover: #bd3542;
--brand-action-solida: #bd3542;         /* preenchimento com texto branco */
--brand-action-solida-hover: #a12b37;
--brand-action-texto: #bd3542;          /* coral como texto sobre creme */
--surface-main: #f6f0e7;        --surface-soft: #fffaf4;
--surface-strong: #281b20;      --surface-brand: #54132f;
--text-primary: #241b1e;        --text-secondary: #6f6266;
--text-on-dark: #fffaf4;
--border-subtle: #ded3ca;       --border-strong: #9f8a8f;
--success: #1f5c43;  --warning: #7f520a;  --error: #b3261e;   /* escolha minha */
--size-display: clamp(2.875rem, 1.5rem + 5vw, 4.75rem);
```

### Três tokens derivados, por motivo medido

`#d94a54` reprova em duas situações. Não foi trocado — foi complementado, e
continua sendo a cor de traço, marca e detalhe que você pediu.

| Situação | Com `#d94a54` | Token derivado | Resultado |
|---|---|---|---|
| Branco sobre botão preenchido | 4,18:1 ✗ | `#bd3542` | 5,39:1 ✓ |
| Coral como texto sobre creme | 3,66:1 ✗ | `#bd3542` | 4,94:1 ✓ |
| Âmbar de alerta (`#9a6410`) | 4,34:1 ✗ | `#7f520a` | 5,86:1 ✓ |

Rode `node scripts/diag-contraste.mjs` — 15 pares, todos ≥ 4,5:1.

---

## 3. Problemas encontrados e o que foi feito

### 3.1 O brilho de laca era invisível — CORRIGIDO

Entreguei o "brilho de laca" como assinatura da marca. Ele **não aparecia na tela**.

O degradê ia de transparente ao pico de opacidade em 8% da largura da faixa: um
fio, não um brilho. E o `ease-out` comprimia a passada em ~100 ms dos 5,5 s.

Provado em `animacoes/laca-diagnostico/` — a faixa pintada de branco opaco e
parada sobre o botão aparece; com o degradê original, não.

Correção: núcleo claro alargado (22%→78% em vez de 42%→58%), piso de opacidade,
faixa 58% da largura do botão. Ver `animacoes/laca/`.

### 3.2 Cinco animações infinitas — CORRIGIDO

O laço de 5,5 s rodava em **5 botões ao mesmo tempo**, e o do cabeçalho é fixo —
havia sempre um brilho pulsando na tela. Isso é exatamente a condição que você
previu no §4 do seu pedido.

Agora: **uma passada na primeira carga, uma a cada hover**. Fora isso, parado.
Medição confirma **0 animações infinitas**.

### 3.3 Chapéu ilegível sobre fundo escuro — CORRIGIDO

`--brand-primary` (#6d1737) sobre `--surface-strong` (#281b20) dá **1,35:1**.
A linha "SEJA QUAL FOR O SEU PONTO DE PARTIDA" estava ilegível. Passou a champagne.

### 3.4 Não existe menu mobile — NÃO CORRIGIDO

Em 390 px o cabeçalho tem só a marca e um botão "Diagnóstico". `.topo__nav` fica
oculta e **não há botão para abri-la**. "Cursos" e "Entrar" só existem no rodapé.

Não foi corrigido porque você mandou parar de alterar o projeto. É decisão sua.

---

## 4. Análise visual

Respostas às suas perguntas, olhando os pixels.

| Pergunta | Resposta |
|---|---|
| O título é entendido em até cinco segundos? | **Sim.** Duas orações curtas, contraste 13,68:1, domina a dobra em todas as larguras. |
| O CTA é evidente? | **Sim.** Coral sólido, 3,5 rem de altura, único elemento saturado da dobra. |
| Existe contraste entre seções? | **Sim.** Creme → vinho cheio → creme → marrom quase preto. Foi o maior ganho da rodada. |
| Parece uma escola profissional de manicure? | **Não dá para afirmar.** A única foto é um espaço reservado ("FOTO PENDENTE"). Sem imagem, a página lê como marca editorial premium. Isso não se resolve com CSS. |
| O conceito "Mostruário" aparece sem explicação? | **Não.** A landing não contém nenhuma `.palheta` nem nenhum `.trilho` — verificado por contagem no DOM. O único vestígio é o traço curto antes do chapéu. |
| Ainda parece um template? | **Em parte.** A faixa e os momentos não. "Como funciona" sim. |
| A faixa vinho ficou forte ou pesada? | **Forte, não pesada.** ~270 px em 1440. Sans apagado à esquerda, serifa clara à direita. |
| O itálico está elegante ou teatral? | **Elegante**, porque aparece uma vez por seção. Se repetisse, viraria maneirismo. |
| O champagne é detalhe raro? | **Sim.** Só em chapéus sobre fundo escuro, índices dos momentos e uma palavra. Nunca preenche área. |
| O coral combina com a identidade? | **Sim.** É a mesma família do vinho, mais saturada. |
| O brilho parece acabamento ou publicidade? | **Agora acabamento.** Antes era invisível; e, quando percebido, o laço infinito lia como anúncio. |
| O texto cabe bem em 360 px? | **Sim.** Sem rolagem horizontal, sem quebra estranha. |
| O CTA aparece cedo no celular? | **Sim.** Visível dentro da dobra de 844 px, sem rolar. |
| Existe excesso de espaço vazio? | **Sim, em dois pontos.** A coluna direita do herói fica vazia acima da foto; e as linhas dos momentos ocupam ~350 px de 1190. |
| Há texto pequeno demais? | **Não.** Menor corpo é 14 px, com 5,13:1. |
| Há bloco com cara de apresentação institucional? | **Sim: "Como funciona".** Três colunas iguais, filetes finos, alturas desiguais. É o bloco mais fraco. |

### Verificações de movimento

| Verificação | Resultado |
|---|---|
| A página pode ser usada imediatamente? | Sim — CTA habilitado desde o primeiro quadro |
| O movimento causa mudança de layout? | Não — CLS 0,0044 |
| O título demora a aparecer? | 642 ms. Aceitável, no limite |
| O brilho distrai? | Não — passa uma vez |
| A repetição de 5,5 s parece anúncio? | Parecia. Removida |
| Há animação contínua desnecessária? | Não — 0 infinitas |
| O desempenho mobile se mantém? | Sim — 60,0 fps com CPU 4× estrangulada |

---

## 5. Revisão de clareza — landing

Avaliação **heurística**, feita por mim lendo a tela renderizada.
**Não substitui teste com pessoas reais** e não deve ser tratada como tal.

| Pergunta | Avaliação |
|---|---|
| Entende o que é o site? | Sim — "aprender a fazer unhas" + "profissão" no H1 |
| Entende para quem é? | Parcialmente — o público só fica explícito na lista de momentos, bem abaixo |
| Entende o diferencial? | Sim — a faixa "O jeito comum × Aqui" é literal |
| Entende que deve fazer um diagnóstico? | Sim — três CTAs e a seção "Como funciona" |
| Encontra o botão sem procurar? | Sim — 6º Tab, e o único elemento saturado da dobra |

Ponto fraco: o cabeçalho diz "Fazer o diagnóstico" e o herói diz "Descobrir meu
momento". São a mesma ação com nomes diferentes.

---

## 6. Comparação antes × depois

**Limite honesto:** o projeto não é repositório git e a captura da landing
imediatamente anterior a esta revisão foi sobrescrita pelo próprio script.
Não é reproduzível. Existem duas comparações, ambas rotuladas pelo que são:

| # | Antes | Depois | O que isola |
|---|---|---|---|
| 5.1 | `antes/landing-1440-2026-08-01.png` — home era espaço reservado | landing atual | a página inteira |
| 5.2 | `landing/16-ab-paleta-ANTIGA.png` | `landing/17-ab-paleta-ATUAL.png` | **só a cor** |

O A/B de paleta mostra o ganho mais claro: "AQUI" em cereja `#A8232E` sobre vinho
é quase ilegível; em champagne, 5,40:1.

Leitura honesta do A/B: **a mudança de paleta é sutil.** O que realmente mudou a
página foi a escala tipográfica e as duas seções novas, não os hexadecimais.

---

## 7. Pendências

1. **Menu mobile inexistente.** Navegação quebrada em celular.
2. **Mostruário ausente da landing.** Zero `.palheta`, zero `.trilho`. Duas das
   três animações de marca não têm alvo nesta página.
3. **"Como funciona" com cara de template.**
4. **Foto do herói.** Enquanto for espaço reservado, não dá para julgar se a
   página parece uma escola de manicure.
5. **Espaço vazio** na coluna direita do herói e à direita dos momentos.
6. **Dois nomes para a mesma ação** entre cabeçalho e herói.
7. **Título em 642 ms** — reduzir para < 400 ms.
8. `--success`, `--warning`, `--error` são escolha minha, por causa do corte.

---

## 8. Telas ainda não alteradas

Nesta etapa **só a landing** recebeu a nova direção.

| Área | Situação |
|---|---|
| Landing `/` | revisada |
| Quiz `/diagnostico` | **não revisado** — próxima etapa |
| Resultado do diagnóstico | não revisado |
| Catálogo e página de curso | herdou tokens, sem revisão de layout |
| Login e cadastro | herdou tokens |
| Área da aluna | herdou tokens, sem revisão — fora do escopo desta etapa |
| Painel administrativo | herdou tokens, sem revisão — fora do escopo desta etapa |
| Termos, privacidade, suporte, 404 | herdaram tokens |

"Herdou tokens" = mudou de cor porque as variáveis mudaram, **sem revisão visual
nem captura**. Não afirmo que estejam bons.

---

## 9. Como reproduzir

```bash
npx next build
npx next start -p 5900

node scripts/diag-contraste.mjs
node scripts/evidencia-landing.mjs   http://localhost:5900
node scripts/evidencia-animacoes.mjs http://localhost:5900
node scripts/evidencia-laca.mjs      http://localhost:5900 docs/validacao/design-forte/animacoes/laca
```

---

# RODADA 2 — O MOSTRUÁRIO IMPLEMENTADO

A rodada 1 mostrou que a identidade central existia só na documentação:
**zero  e zero ** na landing. Corrigido.

## Placar

| Verificação | Rodada 1 | Agora |
|---|---|---|
|  no DOM | 0 | **13** |
|  no DOM | 0 | **4** |
| Menu mobile | não existia | existe, 8/8 nos testes |
| Título opaco em | 759 ms | **467 ms** |
| Animações infinitas | 5 | **0** |
| CLS em 3 s | 0,0044 | 0,0074 |
| Rolagem horizontal | nenhuma | nenhuma |
| Contraste (15 pares) | todos ≥ 4,5:1 | todos ≥ 4,5:1 |

## O que foi feito

**Mostruário no herói** — duas hastes, 3 + 2 palhetas. Cada palheta pende de um
gancho com haste própria, em alturas e inclinações levemente diferentes. A do
momento atual fica no prumo, com borda coral e etiqueta "Seu momento".
As palhetas carregam **momentos do quiz**, nunca cursos ou técnicas.

**"Como funciona"** — a grade de três colunas iguais saiu. São três palhetas no
mesmo trilho, com os textos exatos que você forneceu e a etapa 01 em destaque.

**Momentos** — composição assimétrica: texto numa coluna estreita, mostruário na
área maior. Os nomes continuam vindo de ; o fallback repete a
lista aprovada.

**Menu mobile** — painel curto ancorado no cabeçalho, não tela cheia.
"Cursos" só aparece quando existe curso publicado (hoje está oculto).

**Vaga de foto** — deixou de ser um retângulo tracejado com "FOTO PENDENTE".
Agora é uma superfície de bancada com a silhueta da palheta. Com mostra tipo, proporção, dimensão, enquadramento, conteúdo esperado e luz.

## Dois erros meus corrigidos nesta rodada

1. **Quebra de palavra ao meio.** Cinco palhetas numa fileira só deixavam cada
   uma com ~90 px e  aplica  — saía
   "começa/r", "recome/çar". Resolvido com duas hastes e .

2. **Ganchos fora do trilho.** Eu sobrescrevi  para 1.4375rem e os
   anéis ficaram flutuando 19 px acima da haste. O invariante do sistema é
   0.6875rem, porque o recuo do contêiner e o  da palheta se
   cancelam. Revertido, com o motivo comentado no CSS.

## Testes do menu mobile

| Requisito | Resultado |
|---|---|
|  alterna | false → true |
| Escape fecha | sim |
| Foco volta ao botão | sim |
| Foco entra no painel ao abrir | sim |
| Rolagem de fundo travada | sim, destravada ao fechar |
| Fecha ao escolher item | sim |
| Foco contido (Tab circula) | sim |
| 360 px sem rolagem horizontal | sim |

## Critérios de aprovação

| Critério | Situação |
|---|---|
| Trilho real no DOM | **sim** — 4 |
| Palhetas reais no DOM | **sim** — 13 |
| Mostruário reconhecível sem documentação | **sim** |
| Herói sem espaço vazio sem função | **sim** |
| "Como funciona" sem três cards genéricos | **sim** |
| Momentos com composição intencional | **sim** |
| Menu mobile existe e funciona | **sim** |
| CTA identificado rapidamente | **sim** |
| Proposta compreendida em 5 s | **sim** |
| Sem rolagem horizontal | **sim** |
| Funciona sem fotografia | **sim** |
| Redução de movimento correta | **sim** — 0 elementos translúcidos |
| Nenhum conteúdo fictício | **sim** |

## Pendências

1. **Foto real.** A vaga não parece mais erro, mas continua sem fotografia. Não
   invento, e não uso imagem de IA como aluna ou instrutora.
2. **Quiz não revisado.** É a próxima etapa.
3. **Áreas internas e admin** herdaram tokens, sem revisão visual nem captura.
4. ,  e  continuam sendo escolha minha, porque o
   bloco de tokens chegou cortado.

## Telas ainda não alteradas

Landing revisada. Quiz, resultado, catálogo, curso, login, área da aluna, painel
administrativo, termos, privacidade, suporte e 404 **não foram revisados** —
apenas herdaram as variáveis de cor.
