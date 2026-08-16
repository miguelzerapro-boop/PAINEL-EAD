# Wireframes de baixa fidelidade

Revisados antes do acabamento visual. `▬` = trilho. `▢` = palheta.
Blocos marcados **[CMS]** só renderizam se a responsável preencher; sem dado, a seção
não existe no site público (não vira placeholder).

---

## 1. Landing do diagnóstico `/`

```
┌───────────────────────────────────────────────────────────┐
│ [logo]                        Cursos  Entrar   [Diagnóstico]│  ← topo fino, sem menu inchado
├───────────────────────────────────────────────────────────┤
│                                                           │
│  DESCUBRA SEU                    ┌─────────┐              │
│  MOMENTO NA                      │  foto   │              │  ← herói assimétrico
│  PROFISSÃO                       │ pendente│                 (texto 7 col / imagem 5 col)
│  ────────────────                └─────────┘              │
│  4 perguntas. Sem custo.                                  │
│                                                           │
│  ▬▬▢▬▬▢▬▬▢▬▬▢▬▬▢▬▬▬▬▬▬▬▬▬▬▬▬▬▬[ Começar → ]              │  ← TRILHO: a última palheta é o CTA
│                                                           │
├───────────────────────────────────────────────────────────┤
│  [CMS] texto editorial — o que a escola faz               │
├───────────────────────────────────────────────────────────┤
│  Cursos disponíveis                                       │
│  ▬▢────▢────▢────                                         │  ← vitrine dinâmica
│  (se não houver curso publicado, a seção some por inteiro)│
├───────────────────────────────────────────────────────────┤
│  [CMS] instrutora  │  [CMS] galeria  │  [CMS] depoimentos │  ← cada um some se vazio
├───────────────────────────────────────────────────────────┤
│  Perguntas frequentes (acordeão)                          │
├───────────────────────────────────────────────────────────┤
│  rodapé: razão social, CNPJ, termos, privacidade, contato │
└───────────────────────────────────────────────────────────┘
```

**Revisão feita:** o herói **não** é centralizado; não há onda, bolha desfocada nem mockup
flutuando; o CTA está *dentro* do trilho, o que dá função ao elemento em vez de decoração.
Ordem: promessa → prova do que existe → dúvida → ação. Sem alternar imagem/texto repetidamente.

---

## 2. Quiz `/diagnostico`

```
┌───────────────────────────────────────────┐
│  ▬▢━━▢━━○━━○     3 de 5                   │  ← trilho = progresso. Palheta preenchida = respondida
├───────────────────────────────────────────┤
│  Pergunta 3                               │  ← mono, pequeno
│                                           │
│  Há quanto tempo você trabalha            │  ← Fraunces, grande
│  com unhas?                               │
│                                           │
│  ┌───────────────────────────────────┐    │
│  │ ▢  Ainda não trabalho             │    │  ← alternativa = palheta deitada, alvo ≥56px
│  ├───────────────────────────────────┤    │
│  │ ▢  Menos de um ano                │    │
│  └───────────────────────────────────┘    │
│                                           │
│  ← Voltar                     Continuar → │
└───────────────────────────────────────────┘
```

Uma pergunta por tela. Sem barra de progresso genérica. Última etapa coleta nome,
WhatsApp e **consentimento explícito** com o texto da política.

---

## 3. Resultado `/diagnostico/resultado`

```
┌───────────────────────────────────────────┐
│  ▬▢━━▢━━▢━━▢━━▣   diagnóstico concluído   │
├───────────────────────────────────────────┤
│  Seu momento                              │
│  JÁ PRATICO E QUERO EVOLUIR               │
│  ──────────────────────────               │
│                                           │
│  ┌── caso EXISTA curso publicado ──────┐  │
│  │ [curso cadastrado]   [Ver o curso →]│  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌── caso NÃO exista ──────────────────┐  │
│  │ "Seu diagnóstico foi concluído.     │  │  ← texto exato do escopo
│  │  Nossa equipe vai conversar com     │  │
│  │  você pelo WhatsApp..."             │  │
│  │            [Falar no WhatsApp →]    │  │  ← some se o número não estiver cadastrado
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

Nunca exibe trilha fictícia. O destino vem de `resolve_quiz_outcome()`.

---

## 4. Página de vendas `/inscricao`

```
┌───────────────────────────────────────────┐
│  [nome do curso cadastrado]               │
│  descrição curta cadastrada               │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬[ Quero me inscrever ]│
├───────────────────────────────────────────┤
│  O que você vai encontrar                 │
│  ▬▢ Módulo 1 ─ 4 aulas                    │  ← 100% do banco. Se não houver módulo,
│  ▬▢ Módulo 2 ─ 6 aulas                    │     a seção não aparece.
├───────────────────────────────────────────┤
│  [CMS] instrutora (só com dados reais)    │
├───────────────────────────────────────────┤
│  Investimento                             │
│  R$ ---  em até -x                        │  ← só existe se a oferta tiver preço.
│  [ Ir para o pagamento ]                  │     Sem preço → bloco não renderiza.
├───────────────────────────────────────────┤
│  [CMS] garantia (só após política existir)│
│  FAQ                                      │
└───────────────────────────────────────────┘
```

---

## 5. Checkout `/checkout/[oferta]`

```
┌──────────────────────┬────────────────────┐
│  1. Seus dados       │  Resumo            │
│  Nome                │  ▢ curso           │
│  E-mail              │  ─────────         │
│  WhatsApp            │  Total  R$ ---     │
│  CPF                 │                    │
│  [ ] aceito os termos│  pagamento seguro  │
│                      │  Mercado Pago      │
│  [ Continuar → ]     │                    │
└──────────────────────┴────────────────────┘
```

Uma coluna no mobile, resumo colapsado no topo. Sem etapa desnecessária.

---

## 6. Dashboard da aluna `/aluna`

```
┌───────────────────────────────────────────┐
│  Bom dia, [nome]                          │
├───────────────────────────────────────────┤
│  CONTINUAR DE ONDE PAROU                  │
│  ┌─────────────────────────────────────┐  │
│  │ ▣ curso · módulo · aula   [Retomar] │  │  ← palheta grande, única
│  │ ▬▬▬▬▬▬▬▬▬▬░░░░░░  62%               │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  MEUS CURSOS                              │
│  ▬▢───▢───▢                               │
│                                           │
│  PENDÊNCIAS         AVISOS                │
│  ▢ atividade        · aviso cadastrado    │
│                                           │
│  CERTIFICADOS       SUPORTE               │
└───────────────────────────────────────────┘
```

**Sem matrícula:** um único bloco, não seis blocos vazios —
*"Você ainda não possui nenhum curso disponível. Quando sua matrícula for liberada, ele
aparecerá aqui."*

---

## 7. Página do curso `/aluna/curso/[slug]`

```
┌───────────────────────────────────────────┐
│  [capa]  NOME DO CURSO                    │
│          instrutora · carga (se houver)   │
│          ▬▬▬▬▬▬░░░░  38% concluído        │
├───────────────────────────────────────────┤
│  ▬┬─▢ Módulo 1                    3/4     │  ← trilho vertical contínuo
│   │   ├ ▣ aula concluída                  │
│   │   ├ ▨ aula atual                      │
│   │   └ ▢ aula                            │
│   │                                       │
│  ─┴─▢ Módulo 2                  bloqueado │
│         "abre em 7 dias após a matrícula" │  ← motivo real, vindo da regra de liberação
├───────────────────────────────────────────┤
│  Materiais · Atividades · Certificado     │  ← abas que só aparecem se houver conteúdo
└───────────────────────────────────────────┘
```

---

## 8. Página da aula `/aluna/curso/[slug]/[aula]`

```
┌──────────────────────────┬────────────────┐
│  ┌────────────────────┐  │ ▬ Módulo 1     │
│  │      player        │  │  ▣ aula 1      │
│  └────────────────────┘  │  ▨ aula 2 ←    │
│  TÍTULO DA AULA          │  ▢ aula 3      │
│  descrição               │                │
│                          │ ▬ Módulo 2     │
│  [ Marcar como concluída]│  ▢ bloqueado   │
│                          │                │
│  ── só se existir ──     │                │
│  Materiais               │                │
│  Checklist               │                │
│  Atividade               │                │
│  Transcrição (recolhida) │                │
└──────────────────────────┴────────────────┘
```

**Regra:** a tela monta **apenas** os blocos cadastrados. Uma aula só de texto não
mostra player vazio; uma aula sem material não mostra a seção "Materiais".
No mobile a lista lateral vira uma gaveta acionada pelo trilho no topo.

---

## 9. Admin `/admin`

```
┌────────────┬──────────────────────────────┐
│ ▬ bandeja  │  Pendências para publicar    │  ← primeira coisa que o admin vê
│  Conteúdo  │  ⚠ 12 configurações vazias   │
│  · Cursos  │  ⚠ 8 fotos não produzidas    │
│  · Módulos │  ⚠ nenhum curso publicado    │
│  · Aulas   │  ⚠ conteúdo de teste ativo   │
│  Páginas   │     [ Remover conteúdo… ]    │
│  Ofertas   ├──────────────────────────────┤
│  Leads     │  Últimas alterações          │
│  Alunas    │  quem · o quê · quando       │
│  Mídia     │                              │
│  Ajustes   │                              │
└────────────┴──────────────────────────────┘
```

Navegação apresentada como **bandeja de instrumentos** (lista ordenada, sem ícone em
cada item), não como sidebar de dashboard genérico. Sem cartões de KPI decorativos:
o topo é lista de pendências acionável.

**Editor de página:** coluna de blocos arrastáveis à esquerda, pré-visualização à
direita com alternador **Desktop / Tablet / Mobile**, e um selo por bloco quando há
campo obrigatório vazio.
