# Upload de vídeo de aula

Como um vídeo sai do computador da responsável e chega, protegido, à aluna que
pagou por ele.

---

## 1. O caminho dos bytes

```
navegador ──── bytes, em blocos de 6 MB ────▶ Supabase Storage
    │          (token da própria sessão)              ▲
    │                                                 │
    └── autorizar · anotar · confirmar ──▶ Next.js    │
                                             │        │
                                             └─ policy do bucket ─┘
```

O arquivo **nunca atravessa o Next.js**. Uma Server Action que recebesse um
vídeo de 800 MB carregaria isso na memória do servidor. Aqui o servidor só
autoriza antes, anota o andamento durante e confere o resultado depois.

### Quem autoriza

A administradora envia com **o access token da própria sessão** — não existe
chave de backend no navegador. Quem aceita ou recusa a gravação é a policy
`aula: apenas equipe envia` (migration 20), que exige `is_admin()` ou
`instructor_teaches(course_id)` e confere o `{course_id}` no primeiro segmento
do caminho.

Consequência prática: uma sessão de aluna simplesmente não grava. O Storage
recusa — não a interface.

---

## 2. O invariante do caminho

```
lesson-videos/{course_id}/{lesson_id}/{uuid}.{ext}
```

**Este formato não pode mudar.** A policy de leitura chama
`storage_lesson_released(name)`, que lê o **segmento 2** como `lesson_id` e o
entrega a `lesson_is_released()`. Inserir um `{chapter_id}` no meio deslocaria
o segmento e quebraria a autorização de leitura de todos os vídeos.

O capítulo não se perde: ele está em `lessons.module_id`. A relação
`aula → capítulo` é do banco, não do caminho do arquivo.

O caminho é montado **no servidor**, a partir do id da aula. O cliente não
escolhe onde grava. Não há nome, e-mail nem telefone de ninguém no caminho —
só UUIDs.

---

## 3. Upload resumível (TUS)

Vídeos de aula têm centenas de MB. Uma queda aos 80% não pode significar
recomeçar.

O protocolo TUS quebra o arquivo em blocos e o servidor guarda quantos bytes
já recebeu. Retomar é perguntar "onde paramos?" e continuar dali.

| Item | Valor | Por quê |
| --- | --- | --- |
| Endpoint | `/storage/v1/upload/resumable` | endpoint resumível do Supabase |
| Bloco | **exatamente 6 MB** | exigência do Supabase; outro valor é recusado |
| Retentativa | 0s, 3s, 10s, 20s | só para falha de rede; 4xx não se repete |
| Retomada | `tus_url` no banco | funciona depois de fechar a aba, e de outra máquina |

### Duas formas de retomar

1. **`tus_url` guardada em `lesson_video_uploads`** — é a que importa.
   Sobrevive a fechar o navegador e funciona em outro computador.
2. **Impressão digital no `localStorage`** (do `tus-js-client`) — reconhece o
   mesmo arquivo e continua sozinha. Só vale no mesmo navegador; por isso não
   se depende dela.

### Um envio ativo por aula

O índice parcial único `lesson_video_uploads_um_ativo_por_aula` garante no
banco que só existe um envio em aberto por aula. Sem ele, duas abas criariam
duas transferências para a mesma aula e a última a confirmar apagaria o rastro
da outra — deixando um arquivo órfão que ninguém procuraria.

---

## 4. Estados

Fonte única: `src/lib/video/estados.ts`, espelhando a constraint
`lesson_video_uploads_status_check` (migration 25).

| Estado | Significado |
| --- | --- |
| `pendente` | registro criado; os bytes ainda não começaram |
| `enviando` | transferência em andamento |
| `pausado` | interrompida — por escolha ou por queda. Retomável |
| `validando` | bytes no bucket; servidor conferindo a assinatura |
| `concluido` | arquivo validado e ligado à aula |
| `falhou` | recusado na validação, ou erro definitivo |
| `cancelado` | abandonado por escolha explícita |
| `substituido` | a aula trocou de vídeo; este arquivo ficou para trás |
| `orfao` | marcado pela limpeza administrativa |
| `arquivado` | fora de uso, guardado por histórico |

Os quatro primeiros são os **em aberto**: bloqueiam a publicação da aula e
impedem um segundo envio.

As transições permitidas estão em `TRANSICOES`. `concluido` não volta para
`enviando` — seria o caminho para ressuscitar um arquivo já substituído.

---

## 5. Quatro camadas de validação

| Quando | Onde | O que confere |
| --- | --- | --- |
| **Antes** | navegador | extensão, MIME e **assinatura** dos primeiros 32 bytes |
| **Ao autorizar** | Server Action | sessão, papel, curso, capítulo, aula, MIME, extensão, tamanho |
| **Durante** | Storage | `allowed_mime_types` e `file_size_limit` do bucket |
| **Depois** | Server Action | lê os primeiros bytes do que **realmente** chegou, por Range |

Só a última prova o tipo do arquivo — é a única que o cliente não tem como
enganar. As outras existem para a pessoa receber "esse arquivo não é um vídeo"
em dois segundos, e não depois de quarenta minutos subindo.

### Assinaturas reconhecidas

- **MP4 / M4V / MOV** (ISO-BMFF): bytes 4..8 são `ftyp`
- **WebM / Matroska** (EBML): começa com `1A 45 DF A3`

Um `.zip` renomeado para `.mp4` morre na primeira camada e, se passar, na
quarta.

---

## 6. Upload não é publicação

Subir vídeo **nunca** publica aula. O fluxo é:

```
upload concluído → aula continua RASCUNHO → responsável revisa → publica
```

Publicar aula de vídeo exige `lesson_video_is_ready(lesson_id)`, que responde
`true` só quando **as duas** condições valem:

1. existe vídeo validado ligado à aula, e
2. **não há nenhum envio em aberto** para ela.

A segunda metade importa: publicar com o upload ainda subindo entrega tela
vazia a quem pagou, mesmo que um vídeo antigo esteja ligado.

---

## 7. Não perder vídeo

O registro em `lesson_video_uploads` nasce **antes** do upload. Todo arquivo no
bucket tem, portanto, uma linha correspondente.

`orphan_lesson_videos(horas)` lista o que ficou para trás: envios em aberto que
nunca terminaram, vídeos substituídos, envios recusados na validação.

**A função só relata. Nunca apaga.** Remover objeto é ato administrativo
explícito — apagar automaticamente é exatamente o que "não perder vídeo"
proíbe.

### Aula com histórico não é excluída

`lesson_has_student_history(lesson_id)` responde se alguma aluna já tem
progresso. Quando sim, o painel **arquiva** em vez de excluir: o
`on delete cascade` de `lesson_progress` levaria o histórico dela junto. Quem
decide é o banco, não a interface.

---

## 8. Entrega para a aluna

`GET /api/aulas/{id}/video`

1. lê o caminho do `media_assets` ligado à aula — **o cliente não informa o
   caminho**;
2. chama `urlDeMidiaDaAula`, que pergunta ao banco
   `lesson_is_released(lesson_id, user_id)`;
3. só então assina uma URL de **15 minutos** e redireciona (302).

A regra de liberação — matrícula ativa, prazo, turma, pré-requisito, aula
publicada, curso publicado — **não é reimplementada em TypeScript**. Existe uma
fonte da verdade e ela é a função do banco.

A URL assinada nunca é gravada no banco nem aparece no HTML. Quem abrir o
código-fonte da página encontra `/api/aulas/{id}/video`, não um link para o
bucket.

---

## 9. Matriz de acesso

| Perfil | Enviar | Assistir |
| --- | --- | --- |
| admin / owner | sim | sim |
| instrutora **do curso** | sim | sim |
| instrutora de outro curso | não | não |
| aluna matriculada, aula liberada | não | **sim** |
| aluna matriculada, aula em rascunho | não | não |
| aluna sem matrícula | não | não |
| comercial | não | não |
| financeiro | não | não |
| anônimo | não | não |

Verificada contra PostgreSQL real em `scripts/homolog/10-formacao.mjs`,
seções D e E. Relatório em `docs/validacao/10-formacao.md`.

---

## 10. Configuração do bucket

Declarado na migration 20 (`20_storage.sql`):

| | |
| --- | --- |
| Nome | `lesson-videos` |
| Público | **não** |
| Limite | 5 GB por arquivo |
| MIME aceitos | `video/mp4`, `video/webm`, `video/quicktime` |
| Caminho | `{course_id}/{lesson_id}/{arquivo}` |
| Validade da URL assinada | 900 s (15 min) |

---

## 11. O que já está provado, e o que não está

| Camada | Como se prova | Estado |
| --- | --- | --- |
| Estrutura, RLS, policies, liberação | `node scripts/homolog/10-formacao.mjs` | **54/54** |
| Regras de arquivo, estados, credenciais, rota | `npm test` | **96 testes** |
| Estados do componente de envio | `npm test` (simulação) | passa |
| Classificação de falhas do TUS | `npm test` (simulação) | passa |
| **Upload real contra o Storage** | `npm run storage:validate` | **pendente** |

As duas primeiras linhas rodam sem Supabase. A última **exige um projeto real**
e é a única que fecha a prova de ponta a ponta.

### Para fechar

```bash
npm run storage:preflight   # confere config sem imprimir valor nenhum
npm run storage:validate    # a prova real
```

`storage:validate` cria curso, capítulo, aula e três contas temporárias; sobe
um MP4 mínimo **em dois blocos**, consultando o offset entre eles para provar a
retomada; liga o arquivo à aula; confirma que a aluna matriculada acessa e que
aluna sem matrícula, anônimo e URL expirada **não** acessam; e apaga tudo que
criou, inclusive em caso de falha.

Nenhum conteúdo real é usado: o MP4 é gerado pelo próprio script.

**Configure as credenciais de homologação no `.env.local` e me avise quando
estiver pronto.** Chave secreta não vai em mensagem, documentação nem captura
de tela.
