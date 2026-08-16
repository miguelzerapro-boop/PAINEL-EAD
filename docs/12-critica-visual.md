# Crítica visual

## O que foi possível verificar — e o que não foi

**Não foi possível capturar screenshots.** O download do Chromium do Playwright falha neste
ambiente (`cdn.playwright.dev` inacessível — `getaddrinfo ENOTFOUND`). O script já está pronto
em [`scripts/screenshots.mjs`](../scripts/screenshots.mjs) e captura desktop 1440, tablet 834,
celular 390 e celular 360. Para rodar quando houver rede:

```bash
npx playwright install chromium
npm run build && npx next start -p 3117
node scripts/screenshots.mjs http://localhost:3117
```

**Também não foi possível executar as migrations.** Não há Docker nem `psql` nesta máquina,
então o SQL foi escrito e revisado, mas **não foi aplicado a um banco real**. Isso precisa ser
feito antes de qualquer confiança no comportamento em runtime.

**O que foi verificado de fato:**

- `npx tsc --noEmit` — sem erros
- `npx next build` — compila, 35 rotas
- Servidor de produção respondendo, todas as rotas conferidas por HTTP:

| Rota | Resultado |
|---|---|
| `/` `/cursos` `/diagnostico` `/entrar` `/suporte` `/estilo` | 200 |
| `/termos` `/privacidade` `/reembolso` | 200 |
| `/rota-inexistente` | **404** (status correto, não 200) |
| `/aluna` `/admin` | **307** para `/entrar` (proteção funcionando) |

Para tornar a crítica possível sem banco, criei [`/estilo`](../src/app/estilo/page.tsx) —
página interna, não indexada, que renderiza o sistema visual inteiro com rótulos
explicitamente marcados como amostra.

---

## Problemas encontrados e corrigidos

### 1. Glassmorphism disfarçado no cabeçalho
`.topo` usava `background: color-mix(... 92%, transparent)` + `backdrop-filter: saturate(1.2)`.
Isso é o primeiro passo do glassmorphism — proibido no escopo — e derruba o contraste do texto
quando algo colorido rola por baixo.
**Corrigido:** fundo opaco, separação por borda de 1px.

### 2. Depoimentos eram uma grade de cartões iguais
O bloco renderizava `<figure>` idênticos em grade de 3 colunas — exatamente o
"conjunto de cards iguais" e o "todos os cantos com o mesmo raio" que o escopo proíbe.
**Corrigido:** lista editorial numerada (`.depoimentos`), citação em Fraunces itálico com
peso visual real, atribuição discreta, índice monoespaçado na margem. Sem caixa, sem sombra.

### 3. Todas as seções tinham o mesmo ritmo vertical
`.section` aplicava `--section-y` uniformemente. Uma página inteira com a mesma respiração lê
como pilha de blocos, não como peça editorial — e a própria direção escolhida proíbe isso.
**Corrigido:** `.section--denso` (0,55×) e `.section--amplo` (1,45×), aplicados alternadamente
na página de vendas: descrição ampla → grade padrão → pré-requisitos densa → instrutora densa
→ investimento ampla.

### 4. Barra de progresso invisível no celular
`.progresso__trilha` tinha `height: var(--rail-width)` = 2px. Coerente com a metáfora do
trilho, ilegível na prática.
**Corrigido:** 5px. O trilho estrutural continua em 2px; o progresso é outro objeto.

### 5. Contraste insuficiente nos rótulos do painel
`.bandeja__rotulo` usava `color-mix(... 55%)` do texto claro sobre o verde-tinta — cerca de
4,4:1, abaixo do mínimo para texto pequeno.
**Corrigido:** 72%, passando de 6:1.

### 6. Navegação do painel inutilizável no celular
A bandeja é `grid` de 15rem no desktop; abaixo de 900px virava uma coluna de 18 links
empurrando todo o conteúdo do painel para baixo da dobra.
**Corrigido:** vira uma régua horizontal rolável, fixa no topo.

### 7. Raio inconsistente sem motivo
`.opcao` declarava `border-radius: 4px 4px 4px 4px` — um valor solto, fora do sistema.
**Corrigido:** passa a usar `--radius-control`. A silhueta de tip fica onde tem função:
no marcador da alternativa e no topo da palheta.

### 8. Link morto na página de vendas
A seção "aula aberta" apontava para `/cursos/[slug]/aula/[id]`, que não existia.
**Corrigido:** rota criada, com acesso garantido pela RLS (só aula `is_free` e publicada).

### 9. `/termos` retornava 500 e `/rota-inexistente` retornava 200
As páginas legais estavam sob uma rota dinâmica raiz `[pagina]` com `generateStaticParams`,
mas liam cookies — `DYNAMIC_SERVER_USAGE`. Pior: o catch-all na raiz engolia qualquer
endereço desconhecido e devolvia a página 404 com status **200**, o que é um erro de SEO.
**Corrigido:** três rotas explícitas (`/termos`, `/privacidade`, `/reembolso`) compartilhando
um componente. Catch-all removido; 404 volta a ser 404.

### 10. Dois CTAs no cabeçalho em desktop
O botão do celular era renderizado sempre, duplicando a chamada ao lado da navegação.
**Corrigido:** `.topo__cta-mobile` some a partir de 768px.

---

## Autoavaliação contra a lista de proibições do escopo

| Proibição | Situação |
|---|---|
| Inter / Roboto / Arial / Poppins / Montserrat / Space Grotesk | Não usadas. Fraunces + IBM Plex Sans + IBM Plex Mono |
| Gradiente roxo sobre branco | Nenhum gradiente de marca. O único `linear-gradient` do projeto é o esqueleto de carregamento |
| Creme + terracota "porque está na moda" | O par é papel quente + vinho profundo, com acento cereja e secundário verde-tinta. Justificado em `10-direcao-visual.md` |
| Preto com verde neon | Não |
| Muitos cards arredondados flutuando | Removido nos depoimentos. O objeto recorrente é a palheta, com topo curvo e base reta, presa a um trilho |
| Glassmorphism | Removido (item 1) |
| Bordas brilhantes / sombras exageradas | Duas sombras no projeto: `hairline` de 1px e uma de elevação para menu |
| Ícones decorativos em todos os títulos | Nenhum ícone decorativo no projeto |
| Etiquetas "01, 02, 03" sem função | Os códigos `N.01` identificam a amostra no mostruário e o índice dos depoimentos ordena a leitura. Nenhum é numeração de passo decorativa |
| Ondas / bolas desfocadas no hero | Não |
| Mockup falso flutuando | Não |
| Mulher apontando para o CTA / foto de banco posada | Nenhuma foto. Placeholders declaram que a foto não existe |
| Todos os cantos com o mesmo raio | Quatro raios com papéis distintos: `tip`, `control` 3px, `rail` pill, `media` 2px |
| Animações em todas as seções | Nenhuma animação de entrada. Transições só em hover e progresso |
| Texto centralizado em páginas inteiras | Nenhuma página centralizada. Herói é 7/5 assimétrico; corpo usa grade editorial rótulo/conteúdo |
| Seções alternando imagem e texto repetidamente | Não existe esse padrão |
| Depoimentos genéricos inventados | Tabela nasce vazia e o banco recusa publicação sem verificação e consentimento |
| Métricas sem dados reais | Constraint exige fonte e data de medição |

---

## O que ainda não dá para afirmar

Sendo direto sobre os limites desta revisão:

- **Não vi as telas renderizadas.** A crítica acima é de código e de HTML servido, não de
  imagem. Coisas que só aparecem no pixel — peso ótico real da Fraunces nos títulos, se o
  entalhe da palheta lê como entalhe ou como ruído, se o trilho horizontal no celular convida
  ao gesto — **continuam por verificar**.
- **A palheta e o trilho nunca foram vistos com conteúdo real.** Com títulos de curso de
  verdade (mais longos), o equilíbrio da fileira pode mudar.
- **Nenhuma query rodou contra um Postgres real.** Sintaxe e lógica foram revisadas; execução, não.
- **Sem teste com leitor de tela.** As marcações ARIA foram escritas com cuidado, mas não
  foram testadas com NVDA nem VoiceOver.

Estes quatro pontos precisam ser fechados antes de considerar o frontend finalizado, conforme
a definição de pronto do escopo.
