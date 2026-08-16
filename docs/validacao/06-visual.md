# Evidência — inspeção visual real

**Comando:** `node scripts/screenshots.mjs http://localhost:3117 depois`
**Navegador:** Google Chrome instalado na máquina (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
**Larguras:** 1440 (desktop), 834 (tablet), 390 e 360 (celular)
**Rotas:** 15 · **Imagens:** 60 antes + 60 depois, em `screenshots/antes/` e `screenshots/depois/`

## Como o bloqueio do Playwright foi contornado

O download do Chromium do Playwright continua falhando neste ambiente
(`cdn.playwright.dev` → `getaddrinfo ENOTFOUND`). Em vez de desligar a validação, o
script passou a usar um navegador já instalado via `executablePath`. Chrome e Edge foram
detectados; o Chrome foi o escolhido.

Para as telas internas — quiz, área da aluna, curso, aula, painel — não há Supabase
alcançável, então elas renderizariam apenas o estado vazio. Foi criado um **harness de
revisão** em `/estilo/telas/[tela]`, que monta essas composições com os **componentes
reais** e dados de amostra. É `noindex`, fica fora de qualquer navegação e exibe uma faixa
permanente de aviso no topo. Nenhum dado dele vai ao ar.

---

## Verificação automática: rolagem horizontal

O script mede `scrollWidth` contra `clientWidth` em toda captura.

| Rodada | Resultado |
|---|---|
| **antes** | 2 rotas com rolagem horizontal + 2 falhas de carregamento |
| **depois** | **0 rolagens horizontais** em 15 rotas × 4 larguras |

---

## Problemas encontrados e corrigidos

### 1. O elemento de assinatura não estava se lendo — o mais grave

**Antes** (`screenshots/antes/15-design-system-desktop-1440.png`): a silhueta de tip usava
raio vertical de 22%, o que produzia uma **cúpula enorme** — as palhetas pareciam lápides
arredondadas, não amostras de mostruário. Pior: o trilho corria *por dentro* das palhetas,
a `2.75rem` do topo, e ficava **escondido atrás do fundo opaco**. Só aparecia nos vãos
entre uma palheta e outra. A ideia central da direção escolhida — amostras penduradas num
trilho — simplesmente não existia na tela.

**Depois** (`screenshots/depois/15-design-system-desktop-1440.png`):
- raio vertical de 22% → **10%**: arco largo e raso, que lê como perfil de tip;
- o trilho passa **acima** das palhetas (`--rail-offset: 0.6875rem`), visível de ponta a ponta;
- cada palheta ganhou uma **haste** (`::after`) ligando o entalhe ao seu topo, e o entalhe
  agora fica centrado *sobre* a linha;
- haste e entalhe mudam de cor nos estados concluído/atual, o que dá leitura de progresso
  ao longo do trilho.

### 2. Fileira de palhetas estourava a página entre 768 e ~1000 px

A rolagem lateral só existia abaixo de 768 px. Entre 768 e a largura em que a fileira
coubesse, ela simplesmente vazava: em 834 px o documento media 876 px.

**Corrigido:** `overflow-x: auto` em qualquer largura; abaixo de 768 px cada palheta ocupa
76% da tela (convida ao gesto), a partir de 768 px elas dividem o espaço (`flex: 1 1 0`)
e só rolam se forem muitas.

### 3. Rolagem horizontal de 4 px na área da aluna em 360 px

Itens de grid nascem com `min-width: auto` e se recusam a encolher abaixo do próprio
conteúdo mínimo, empurrando a coluna para fora do contêiner. A cadeia foi rastreada até
`main.page.aluna` (360 de largura, 364 de scroll).

**Corrigido:** `min-width: 0` nos filhos diretos dos contêineres de layout
(`.heroi__grade`, `.editorial`, `.vitrine`, `.checkout`, `.aluna`, `.aluna__blocos`,
`.aluna__continuar`, `.aula`, `.rodape__grade`).

### 4. Capturas falhando por espera de rede

`waitUntil: 'networkidle'` nunca resolvia nas rotas que consultam o banco, porque o
Supabase é inalcançável e a rede jamais fica ociosa. Duas rotas estouravam o tempo limite.

**Corrigido:** `domcontentloaded` + espera de `load` + 600 ms.

### 5. Palheta de ação sem estrutura

`.palheta--acao` usava `justify-content: flex-end` e era criada sem código nem meta,
quebrando o ritmo da fileira: virava um bloco vermelho com o texto solto.

**Corrigido:** mesma estrutura das demais (código, título, meta), com os tons secundários
ajustados para contraste sobre o vermelho.

---

## Análise das imagens, item a item

| Verificação pedida | Situação |
|---|---|
| A direção "Mostruário" é perceptível? | **Sim, depois da correção 1.** A fileira de amostras penduradas num trilho contínuo é a primeira coisa que se vê no catálogo, na vitrine e no dashboard. Antes, não era. |
| A palheta funciona como sistema? | Sim: mesma peça aparece como curso, módulo, etapa do quiz, item de progresso e ação, com quatro estados distintos. |
| Ainda lembra template de EAD? | Não. Não há sidebar com ícones, cartão de curso com barra de progresso embaixo, nem grade de thumbnails 16:9. |
| O dashboard parece genérico? | Não. O bloco "continuar de onde parou" é invertido e ocupa a largura toda; o resto é lista editorial, não cartões. |
| Cards repetidos demais? | Corrigido antes desta rodada (depoimentos viraram lista editorial). No dashboard só há palhetas no trilho — que é o sistema, não repetição. |
| Textos legíveis? | Sim. Corpo em 16 px, texto de estudo em 19 px, entrelinha 1,65. Nenhum texto abaixo de 14 px. |
| Fraunces está equilibrada? | Boa no herói e nos títulos. **Ressalva registrada:** no dashboard em 360 px há cinco `h2` em Fraunces seguidos (Meus cursos / Atividades / Avisos / Certificados / Suporte), o que pesa a leitura. Não foi alterado por ser questão de gosto e não de legibilidade — fica anotado para decisão da responsável. |
| Plex Sans e Plex Mono carregaram? | Sim, confirmado nas imagens: interface em Plex Sans e os códigos `N.01`, `04:32`, `38%`, `2026-07-29` em Plex Mono com números tabulares. |
| Quebra de texto? | Nenhuma observada nas 60 imagens. |
| Botões cortados? | Nenhum. Alvos ≥ 44 px em todas as larguras. |
| Navegação mobile funciona? | Sim. O menu vira um CTA único abaixo de 768 px; a bandeja do painel vira régua horizontal rolável. |
| Modais cabem em 360 px? | Não há modal no projeto — decisão de design. O quiz usa tela cheia e o painel usa páginas. |
| Teclado virtual atrapalha? | Formulários têm um campo por bloco com rótulo acima, `inputMode` correto (`tel`, `email`, `numeric`) e o botão de ação no fim do fluxo, não fixo na base. |
| Estados bloqueados explicam o motivo? | Sim. A palheta bloqueada mostra o texto real ("Esta aula abre quando você concluir a anterior", "Abre 7 dias após a matrícula"), nunca só um cadeado. |
| Contraste atende? | Texto primário 14,8:1 e secundário 6,9:1 sobre a superfície principal; branco sobre o cereja do CTA 5,7:1. Rótulos do painel corrigidos de 4,4:1 para acima de 6:1 na rodada anterior. |
| Rolagem horizontal? | **Zero**, medida automaticamente em 60 combinações. |
| Continua coerente sem as fotos finais? | Sim. Onde faltam fotos, o placeholder declara "Foto pendente" com o nome da vaga e as dimensões. A página não fica com buracos. |

---

## O que continua sem verificação

- **As telas internas nunca foram vistas com dados reais.** O harness usa amostras. Com
  nomes de curso verdadeiros — provavelmente mais longos — o equilíbrio da fileira pode mudar.
- **Sem teste com leitor de tela.** As marcações ARIA foram escritas com cuidado
  (`aria-checked`, `aria-live`, `role="radiogroup"`, `aria-invalid`), mas não foram
  testadas com NVDA nem VoiceOver.
- **Sem teste em aparelho físico.** As capturas são emulação de viewport no Chrome desktop;
  não cobrem teclado virtual real, notch, nem barra de endereço que encolhe ao rolar.
- **O build depende do Google Fonts.** Uma das execuções falhou com `ETIMEDOUT` ao buscar
  Fraunces/Plex. Em CI sem rede estável, convém baixar as fontes para o repositório.

---

## Defeito encontrado ao rodar localmente (01/08/2026)

**Soft 404 em página pública indexável.**

`/cursos/curso-inexistente` renderizava a página de "não encontrado" mas respondia com
**status 200**. Para buscador, isso é uma página válida com conteúdo de erro — o clássico
*soft 404*.

Confirmado em **build de produção**, não era artefato do modo dev:

```
antes:   /cursos/curso-inexistente  →  200  (corpo = página 404)
depois:  /cursos/curso-inexistente  →  404
```

**Causa:** `src/app/loading.tsx` na raiz envolvia toda página num Suspense. O cabeçalho
HTTP era enviado antes de a página resolver os dados, e o `notFound()` posterior já não
conseguia alterar o status.

**Correção:** o esqueleto de carregamento saiu da raiz e passou a existir só em
`src/app/aluna/loading.tsx` e `src/app/admin/loading.tsx` — áreas autenticadas, que não
são indexadas e onde mostrar a estrutura enquanto carrega tem valor real. As rotas
públicas voltaram a responder o status correto.

Verificado depois da correção, em produção:

| Rota | Status |
|---|---|
| `/cursos/inexistente` | 404 ✅ |
| `/checkout/oferta-inexistente` | 404 ✅ |
| `/rota-inexistente` | 404 ✅ |
| `/`, `/cursos`, `/diagnostico`, `/entrar`, `/termos` | 200 ✅ |
| `/aluna`, `/admin` | 307 → `/entrar` ✅ |
