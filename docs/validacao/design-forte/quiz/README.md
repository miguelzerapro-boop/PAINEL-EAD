# Quiz — identidade Mostruário

Rodada de **design do quiz**. Nenhuma regra de negócio foi alterada.

## 1. O que NÃO mudou

Verificável por leitura do diff em `src/app/diagnostico/quiz-form.tsx`: as funções
`responder`, `enviar` e `lerUtm`, o cálculo de `podeAvancar`, `selecionadas` e
`limiteAtingido`, a lista `UF`, a chave `diagnostico:rascunho`, o formato do
rascunho e o consentimento desmarcado por padrão continuam **idênticos**.

Não foram tocados: perguntas, alternativas, ordem, limites, pontuação,
segmentação, banco, versionamento, retomada (mecanismo), normalização de
telefone, UTM, APIs, resultado calculado, lógica do WhatsApp, regras de curso
publicado, CMS, RLS.

## 2. Como o Mostruário funciona aqui

| Elemento | Função real |
|---|---|
| Trilho de progresso | as 8 etapas (7 perguntas + contato), com estado por **forma**, não só cor |
| Etapa concluída | amostra baixa, preenchida em vinho suave, com marca de conferido |
| Etapa atual | amostra alta, gancho coral, sombra |
| Etapa futura | traço fino tracejado |
| Palheta da pergunta | contêiner editorial do enunciado, largura de leitura |
| Alternativas | **não** são palhetas — botões grandes e simples, de propósito |

### Dois defeitos de forma encontrados e corrigidos

1. **`--radius-tip` em caixa larga vira lápide.** O raio da palheta é percentual
   (46%/26%), pensado para a amostra estreita. Aplicado num contêiner de 42rem
   produziu uma cúpula alta. Trocado por raio fixo `20px 20px 6px 6px`.
2. **`--radius-rail` (999px) na amostra do trilho virou um "U".** Trocado por
   `0 0 4px 4px`.

Ambos estão registrados em comentário no CSS para não voltarem.

## 3. Estados capturados

Quatro larguras: `1440/`, `834/`, `390/`, `360/`.

| # | Estado pedido | Situação |
|---|---|---|
| 1 | Tela inicial | `01-inicial` |
| 2 | Pergunta de seleção única | `02-pergunta-unica` |
| 3 | Alternativa selecionada | `03-alternativa-selecionada` |
| 4 | Múltipla escolha | `04-multipla-escolha` |
| 5 | Limite atingido | `05-limite-atingido` |
| 6 | Salvando | **não capturável** — ver §5 |
| 7 | Salvo | visível em `04` e `05` ("Resposta salva neste navegador") |
| 8 | Erro de conexão | `09-erro-de-conexao` |
| 9 | Retomada encontrada | `06-retomada` |
| 10 | Nome e contato | `07-contato` |
| 11 | Cidade e estado | dentro de `07-contato` |
| 12 | Consentimento não marcado | `08-consentimento-pendente` |
| 13 | Resultado final | **não capturável** — ver §5 |
| 14 | Resultado sem curso publicado | **não capturável** — ver §5 |
| 15 | WhatsApp não configurado | **não capturável** — ver §5 |

Extras: `10-bloqueio-explicado`, `estados/11-diagnostico-sem-quiz-publicado`,
`estados/12-resultado-token-invalido`, `estados/13-resultado-sem-token`,
`acessibilidade/foco-alternativa`, `acessibilidade/reducao-de-movimento`,
`animacoes/transicao-entre-perguntas.webm`.

**11 dos 15 estados foram capturados. 4 não foram.**

## 4. Como os estados foram alcançados

Não existe prop de teste nem estado forçado. `scripts/evidencia-quiz.mjs` **clica
no componente real**: o limite de múltipla escolha, a validação de avanço e o
rascunho que produz a tela de retomada são os do produto.

O erro de conexão é produzido abortando a requisição de verdade
(`route.abort('failed')`), não escrevendo uma mensagem falsa na tela.

## 5. Limitações — leia antes de aprovar

**O Supabase deste ambiente é um espaço reservado.** Não há banco, então
`/diagnostico` cai (corretamente) no estado vazio e não existe token de resultado
válido. Consequências:

- **Estados 13, 14 e 15 não puderam ser fotografados.** Resultado, resultado sem
  curso publicado e WhatsApp ausente dependem de um diagnóstico concluído no
  banco. O código dessas telas não foi alterado nesta rodada.
- As capturas vêm de `/estilo/quiz`, uma **bancada de revisão** com faixa âmbar
  no topo, `robots: noindex`, fora do site público. As perguntas ali são rótulos
  neutros ("Enunciado de exemplo…") escritos só para exercitar o layout — **não
  são conteúdo do diagnóstico** e não devem ser confundidas com as aprovadas.
- **Estado 6 ("Salvando") não é fotografável de forma honesta.** O rascunho vai
  para o `localStorage` de modo síncrono: o estado dura menos de um quadro.
  Preferi não inventar um timer só para produzir a foto — seria encenação.

**Sobre o rótulo de salvamento.** Diz "Resposta salva **neste navegador**", e não
"Resposta salva". O rascunho vive no `localStorage`; as respostas só vão ao
servidor no envio final. Dizer apenas "salvo" daria a entender que já está
guardado no servidor.

## 6. Acessibilidade

| Item | Resultado |
|---|---|
| Rolagem horizontal em 4 larguras × 10 estados | **nenhuma** |
| Foco visível nas alternativas | sim, anel de 2px com afastamento |
| Foco vai ao título ao trocar de pergunta | sim, `tabIndex={-1}` + `focus()` |
| Redução de movimento | etapa em opacidade 1, sem animação |
| Alternativas | `role=radio`/`checkbox` + `aria-checked` |
| Limite de múltipla escolha | contagem com `aria-live="polite"` + aviso `role="status"` |
| Erros de campo | `aria-describedby` ligando campo e mensagem |
| Salvamento | `role="status"` |

### Um problema de acessibilidade encontrado e corrigido

O botão "Continuar" usa `aria-disabled` (em vez de `disabled`) para poder
**explicar** o bloqueio ao ser clicado. Mas leitor de tela anuncia
"indisponível" — e ninguém clica num botão indisponível para descobrir o porquê.

Descoberto porque o Playwright, que aplica as mesmas regras de acessibilidade,
não conseguia clicar e o script falhou em 8 capturas.

Correção: o motivo do bloqueio passou a ficar **sempre** ligado por
`aria-describedby`, não só depois da tentativa.

## 7. Animação

Transição de 240 ms (dentro da faixa 180–320 ms pedida): a etapa entra 14 px pela
lateral, como a amostra seguinte deslizando no trilho. Sem fade-up genérico, sem
carrossel, sem bounce. A interação não espera a animação.

## 8. Testes de banco

Rodados contra o PostgreSQL 15.18 embarcado (a linha que o Supabase roda),
porta 55433, em 02/08/2026:

| Suíte | Resultado |
|---|---|
| `01-migrations` | 22 migrations + seed · SUCESSO |
| `02-constraints` | 43/43 |
| `03-liberacao` | 44/44 |
| `04-rls` | 55/55 |
| `05-quiz` | **47/47** |
| `06-e2e` | 24/25 etapas · **1 bloqueada** (Mercado Pago, sem credenciais) · isolamento 9/9 |
| `08-storage` | 48/48 |
| `09-admin` | 16/16 |

**253 verificações conforme o esperado, nenhuma falha.** A `05-quiz` cobre
exatamente o que o §15 pediu do lado servidor: limite de seleção, segmentação,
consentimento e resolução do resultado.

Sobre `npm test`: o script aponta para vitest, mas **não existe nenhum arquivo de
teste no projeto**. O comando roda e não verifica nada. Continua assim.

## 9. Correções desta rodada final

1. **Correção de uma afirmação errada minha.** A versão anterior deste arquivo
   dizia que `/diagnostico/resultado` "não recebeu a linguagem do Mostruário".
   **Estava errado** — a tela já usava `<Trilho>` e `<Palheta>` desde antes.
   O que era verdade é que ela não foi capturada, por falta de banco.
2. **WhatsApp não configurado deixava a pessoa sem saída.** A tela mostrava a
   mensagem oficial de encaminhamento e terminava ali, sem nenhum passo
   seguinte. Agora exibe orientação neutra — sem botão quebrado, sem número
   inventado.
3. **Duplicação de título resolvida.** `intro_title`/`intro_body` do CMS agora
   são passados **para** a tela de abertura em vez de renderizados acima dela.
   Quando preenchidos, substituem o texto padrão; quando vazios, vale o texto
   aprovado. Não havia como isso conviver com a nova abertura sem produzir dois
   `h1` na mesma tela.

## 10. Pendências

1. Estados 13, 14 e 15 dependem de banco conectado — pendentes.
2. `/diagnostico/resultado` nunca foi **capturado** em nenhuma largura.
3. Mercado Pago segue sem credenciais: 1 etapa do e2e bloqueada.

## 11. Reproduzir

```bash
npx next build && npx next start -p 5900
node scripts/evidencia-quiz.mjs http://localhost:5900
```
