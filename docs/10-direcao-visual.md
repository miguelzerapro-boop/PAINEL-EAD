# Direção visual

> **Nota de processo.** O escopo pedia a skill oficial `frontend-design` da Anthropic.
> Ela **não está instalada** neste ambiente e a responsável decidiu não instalá-la
> ("continue, não vou baixar skill"). O processo visual exigido no escopo — universo da
> marca → três direções → escolha justificada → elemento de assinatura → wireframes →
> design system → implementação → crítica — foi executado manualmente, e é o que este
> documento registra. Se a skill for instalada depois, este documento é o insumo para
> revalidar as decisões.

---

## 1. Universo da marca

Matéria-prima conceitual levantada do ofício real, não de estereótipo de "salão".

| Elemento real | O que ele carrega | Onde pode virar interface |
|---|---|---|
| **Mostruário de amostras** (tips presas num anel, numeradas) | Coleção, comparação, código, ordem | Catálogo, vitrine, portfólio |
| **Formatos de unha** (quadrada, oval, amendoada, bailarina) | Vocabulário geométrico próprio da área | Recortes, silhuetas, molduras |
| **Linha do sorriso** | Precisão milimétrica, curva assimétrica | Máscara de imagem, progresso |
| **Camadas** (base → cor → cobertura) | Construção, cura entre etapas, paciência | Progresso, etapas da aula |
| **Bandeja de instrumentos** | Ordem fixa, ritual, preparo | Navegação, barra de ferramentas do admin |
| **Bancada e luz direcionada** | Foco, trabalho, ambiente | Fundo, sombra, hierarquia de foco |
| **Portfólio físico** | Prova de trabalho, evolução | Galeria, área da aluna |
| **Repetição da prática** | A mesma mão feita 50 vezes, melhor a cada vez | Trilha de progresso |
| **Correção da instrutora sobre o trabalho** | Relação, apontar o detalhe | Feedback de atividade |

**Descarte deliberado:** vidro de esmalte desenhado, respingo, brilho, coração, glitter.
São o clichê da categoria e a primeira coisa que uma IA desenharia.

---

## 2. Três direções

### Direção A — **Mostruário**

- **Ideia central:** a plataforma inteira é organizada como um mostruário profissional de amostras. Conteúdo vive em fileiras densas de *palhetas* identificadas por código, penduradas num trilho.
- **Sensação:** coleção, ofício, catálogo de trabalho, tátil. Objeto que se manuseia.
- **Tipografia:** serifada de exibição com caráter (não neutra) + sans humanista para leitura + monoespaçada para os códigos das amostras.
- **Paleta:** superfície de papel quente, tinta quase preta, **uma** cor saturada de esmalte por vez em foco.
- **Composição:** trilho horizontal contínuo; muitas amostras pequenas + um item grande em destaque; escala assimétrica; rolagem lateral onde faz sentido.
- **Assinatura:** a *palheta* — retângulo com topo curvo (silhueta de tip) e entalhe onde o trilho passa.
- **Landing:** o herói é um trilho de palhetas em que a primeira é a chamada e as demais são o que a escola oferece.
- **EAD:** módulos são palhetas penduradas no trilho do curso; a aula atual é a palheta destacada.
- **Risco:** vira "grade de cards iguais" — exatamente o proibido — se a escala não variar e o trilho não for contínuo.
- **Por que não parece template:** nenhum framework tem "palheta com entalhe num trilho" como primitiva. O card padrão arredondado desaparece.

### Direção B — **Linha do Sorriso**

- **Ideia central:** a curva assimétrica da francesinha é o único elemento gráfico estrutural. Divide seções, recorta imagens, mede progresso.
- **Sensação:** precisão técnica, sobriedade, elegância contida.
- **Tipografia:** serifa editorial de transição para títulos + sans de altura-x alta para texto.
- **Paleta:** quase monocromática; a cor só existe dentro da curva.
- **Composição:** editorial, colunas assimétricas, muito espaço negativo, imagem sempre mascarada pela curva.
- **Assinatura:** a curva como máscara e como barra de progresso.
- **Landing:** herói de uma coluna só, texto à esquerda, imagem recortada pela curva à direita.
- **EAD:** progresso do módulo desenhado como a curva se completando.
- **Risco:** frieza. O público inclui quem está começando do zero; excesso de sobriedade lê como "não é para mim". E a curva vira decoração vazia se usada em tudo.
- **Por que não parece template:** máscara curva assimétrica não existe em biblioteca de componentes.

### Direção C — **Camadas**

- **Ideia central:** base, cor, cobertura. A interface se monta empilhando lâminas levemente deslocadas; o progresso é uma camada aplicada.
- **Sensação:** processo, feito à mão, evolução.
- **Tipografia:** sans geométrica humanizada + mono para números.
- **Paleta:** uma cor em várias opacidades sobre papel.
- **Composição:** sobreposição e deslocamento, papel sobre papel.
- **Assinatura:** a lâmina deslocada.
- **Landing:** seções que se sobrepõem verticalmente em vez de empilhar.
- **EAD:** a aula concluída "aplica" uma camada sobre o módulo.
- **Risco:** **alto.** Translucidez empilhada escorrega para *glassmorphism* (proibido) e derruba contraste — problema direto de acessibilidade para leitoras mais velhas no celular.
- **Por que não parece template:** conceito é bom, mas a execução tende ao efeito proibido.

---

## 3. Escolha: **Direção A — Mostruário**

**Motivo objetivo:** é a única das três cuja metáfora é *estrutural*, não decorativa.

| Critério | Por que A atende |
|---|---|
| **Beleza** | O trilho de palhetas cria ritmo e um foco claro sem depender de efeito. |
| **Profissionalismo** | O mostruário é um objeto de trabalho, não de vitrine de beleza. Coloca a escola do lado de quem executa. |
| **Facilidade de uso** | A metáfora já é uma lista ordenada e comparável — que é literalmente o que catálogo, módulo e aula precisam ser. Não há atrito entre conceito e função. |
| **Acolhimento** | Papel quente, escala grande, uma cor por vez. Convida a folhear. |
| **Maturidade** | Sem glitter, sem rosa-bebê, sem infantilização. |
| **Confiança** | Numeração e código em monoespaçada dão sensação de acervo organizado, não de improviso. |
| **Conversão** | O trilho tem direção. A última palheta do trilho é sempre a ação. |
| **Acessibilidade** | Fundo opaco, contraste alto, nenhuma transparência empilhada. Ao contrário de C. |
| **Identidade própria** | A palheta com entalhe não existe em nenhum kit de UI. |

**Contra B:** B é mais bonita numa peça isolada, mas piora a experiência de quem está começando e não tem como escalar para 40 aulas numa lista.
**Contra C:** risco de acessibilidade e proximidade com técnica proibida.

**Risco assumido de A e como é controlado:**
o perigo é degenerar em grade de cards iguais. Controles obrigatórios:
1. o trilho é **contínuo e visível** — as palhetas estão penduradas nele, não soltas;
2. a escala **varia** dentro da mesma fileira (uma palheta em destaque, as demais menores);
3. o raio de canto **não é uniforme** — o topo da palheta é curvo, a base é reta;
4. nenhuma seção repete a mesma densidade da anterior.

---

## 4. Elemento de assinatura

### A palheta no trilho

Um único sistema, usado em toda a experiência:

```
        ╭───────────╮   ← topo curvo: silhueta de tip
   ═════╡  ▢        ╞═══════  ← o trilho atravessa o entalhe
        │  N.01     │      (o trilho é a linha do percurso)
        │           │
        │  Título   │
        └───────────┘   ← base reta
```

**Função em cada tela — não é decoração:**

| Tela | O que a palheta representa | O que o trilho representa |
|---|---|---|
| Landing | Cada oferta ou etapa do percurso | A jornada da visitante |
| Quiz | Cada pergunta respondida | Progresso do diagnóstico |
| Resultado | O momento identificado | O caminho até a conversa |
| Catálogo | Um curso | A coleção disponível |
| Página do curso | Um módulo | A ordem pedagógica |
| Página da aula | Um item da aula (vídeo, material, atividade) | A sequência dentro da aula |
| Dashboard | Um curso matriculado | O que já foi percorrido |
| Certificado | O curso concluído | — |
| Admin | Um item na lista ordenável (arrastar reordena ao longo do trilho) | A ordem de publicação |

**Estados da palheta:** disponível (papel), em andamento (metade preenchida na cor), concluída (preenchida + entalhe fechado), bloqueada (papel vazado, sem cor, com o motivo da trava em texto).

O estado bloqueado é importante: as regras de liberação do banco (`lesson_is_released`) ganham representação visual honesta — a aluna vê que existe e por que ainda não abriu.

---

## 5. Tipografia

Nenhuma das fontes proibidas. Escolhas justificadas pelo uso, não por popularidade.

| Papel | Fonte | Motivo |
|---|---|---|
| **Destaque** | **Fraunces** (variável, eixos `opsz`, `SOFT`, `WONK`) | Serifa com caráter artesanal. Lê como algo feito à mão e editorial, não como produto de software. Eixo `SOFT` dá calor sem infantilizar; `WONK` fica em 0 para manter maturidade. Suporte Latin Extended completo (ã, ç, õ, é). |
| **Leitura e interface** | **IBM Plex Sans** | Altura-x generosa, formas abertas, ótima em 360 px. Tem personalidade discreta (o `a`, o `g`) sem virar neutra de template. Desenhada como família de sistema: aguenta formulário, tabela e texto longo. Latin Extended completo. |
| **Números e códigos** | **IBM Plex Mono** | Companheira da anterior. Sustenta os códigos do mostruário, durações, progresso, código do certificado e valores no admin — com alinhamento tabular real. |

### Escala tipográfica (fluida, base 16 px)

| Token | Mobile → Desktop | Uso |
|---|---|---|
| `display` | 40 → 68 px | Só no herói. Fraunces. |
| `h1` | 32 → 48 px | Título de página. Fraunces. |
| `h2` | 25 → 34 px | Seção. Fraunces. |
| `h3` | 20 → 24 px | Bloco, título de módulo. Plex Sans 600. |
| `h4` | 17 → 19 px | Título de aula. Plex Sans 600. |
| `body-lg` | 18 → 19 px | Texto de venda e de estudo. |
| `body` | 16 → 16 px | Padrão. Nunca menos que 16 px em texto corrido. |
| `small` | 14 → 14 px | Legenda, metadado. Nunca para texto de leitura. |
| `mono` | 13 → 14 px | Código, duração, valor. |

### Regras

- **Pesos:** Fraunces 400 e 600. Plex Sans 400, 500, 600. Nada de 300 (some no celular) nem 800.
- **Altura de linha:** 1.05 no `display`, 1.15 nos títulos, **1.65** no corpo, 1.5 em interface.
- **Largura máxima:** 62ch em texto de estudo, 46ch em texto de venda, 34ch em subtítulo de herói.
- **Mobile:** título nunca ultrapassa 4 linhas; a escala fluida usa `clamp()` com `svw` para não saltar.
- **Caixa alta:** só em rótulos curtos (≤ 14 caracteres) com `letter-spacing: 0.08em`. Nunca em frase.
- **Itálico:** só em citação de aluna e em nota de rodapé editorial. Nunca em CTA.
- **Números:** `font-variant-numeric: tabular-nums` em tabela, progresso, preço e duração — para não "dançar" ao atualizar.
- **Títulos de aula:** Plex Sans 600, sem caixa alta, sem truncar em desktop; no mobile, `line-clamp: 2` com `title` completo acessível. Título nunca recebe ícone decorativo.

---

## 6. Identidade provisória

**Isto não é a marca.** É um conjunto de tokens substituíveis. Trocar os valores em
`src/styles/tokens.css` muda o site inteiro sem tocar em componente.

| Token | Valor provisório | Papel |
|---|---|---|
| `--brand-primary` | `#5B1A2E` | Vinho profundo. Cor real de esmalte escuro; autoridade sem corporativismo. |
| `--brand-secondary` | `#2A2E2B` | Verde-tinta quase preto. O trilho, o rodapé, o chrome do admin. |
| `--brand-accent` | `#A8232E` | Cereja. **Só** em ação primária e na palheta ativa. |
| `--surface-main` | `#F5F1EA` | Papel de bancada. Baixo brilho para leitura longa. |
| `--surface-soft` | `#FBF9F5` | Cartão, campo de formulário. |
| `--surface-strong` | `#1C1A19` | Blocos invertidos. |
| `--text-primary` | `#1C1A19` | 14.8:1 sobre `surface-main`. |
| `--text-secondary` | `#5A534E` | 6.9:1 sobre `surface-main`. |
| `--border-subtle` | `#E0D8CC` | |
| `--success` | `#2F6B4F` | |
| `--warning` | `#8A5A12` | |
| `--error` | `#A32218` | |

**Por que não cai nas armadilhas proibidas:** não há gradiente roxo; o par não é
"creme + terracota da moda" — o acento é uma cereja saturada e o secundário é um
verde-tinta, combinação que não está em nenhuma paleta de tendência de 2025/2026;
não há preto com neon; não há rosa-e-dourado.

**Raios propositalmente diferentes** (o escopo proíbe "todos os cantos com o mesmo raio"):

| Token | Valor | Onde |
|---|---|---|
| `--radius-tip` | `42% 42% 4px 4px / 22% 22% 4px 4px` | Topo da palheta |
| `--radius-control` | `3px` | Botão, campo |
| `--radius-rail` | `999px` | Trilho, chip |
| `--radius-media` | `2px` | Imagem |

**Sombras:** uma só, rasa e quente (`0 1px 0 var(--border-subtle)`), mais uma de
elevação real só em menu suspenso. Nada de sombra difusa colorida.
