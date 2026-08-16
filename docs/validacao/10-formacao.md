# Formação, aulas e vídeo — verificação

54/54 verificações conforme o esperado.

Gerado por `node scripts/homolog/10-formacao.mjs` contra PostgreSQL local com
todas as migrations aplicadas. Cada asserção assume `authenticated` ou `anon`
e define `request.jwt.claim.sub`, como o Supabase faz — o superusuário nunca
é usado dentro de uma asserção.

## Fora do alcance deste script

O serviço de **Storage** do Supabase (emissão de URL assinada, PUT do arquivo,
leitura por Range) não é exercitado aqui: exige um Supabase real. O que este
script prova sobre vídeo é a camada de AUTORIZAÇÃO — as policies de
`storage.objects` que decidem quem lê e quem grava. Ver `docs/22-upload-de-video.md`.

## A. Conteúdo

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| existem exatamente 8 capítulos | `8` | `8` | ok |
| os 8 nomes aparecem na ordem aprovada | `ordem aprovada` | `ordem correta` | ok |
| nenhum capítulo nasce publicado | `todos draft` | `todos draft` | ok |
| a migration não inventou nenhuma aula | `0` | `0` | ok |
| a formação continua em rascunho mesmo com a descrição cadastrada | `draft` | `draft` | ok |
| a descrição curta é exatamente a aprovada, sem texto inventado | `texto aprovado` | `texto aprovado` | ok |
| reaplicar a migration não sobrescreve descrição reescrita no painel | `draft / Texto reescrito pela responsável.` | `draft / Texto reescrito pela responsável.` | ok |
| reaplicar a migration não duplica capítulos | `8` | `8` | ok |
| reaplicar não duplica a formação | `1` | `1` | ok |
| reaplicar preserva renomeação e reordenação feitas no painel | `RENOMEADO PELA DONA @ 42` | `RENOMEADO PELA DONA @ 42` | ok |

## B. Capítulo vazio

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| capítulo publicado sem aula aparece, mas sem aula nenhuma | `1 linha com lesson_id nulo` | `1 linha(s), lesson_id=null` | ok |
| capítulo com aula publicada mostra exatamente 1 aula (a rascunho não entra) | `1: Aula publicada de teste` | `1: Aula publicada de teste` | ok |
| aula sem duração definida devolve NULL (nunca 0) | `null` | `` | ok |
| reordenação das aulas persiste e reordena | `1:Aula em rascunho primeiro` | `1:Aula em rascunho | 5:Aula publicada de teste` | ok |

## C. Publicação

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| aula publicada + matrícula ativa → liberada | `true` | `true` | ok |
| aula em RASCUNHO não é liberada nem para quem tem matrícula | `false` | `false` | ok |
| aluna SEM matrícula não recebe liberação | `false` | `false` | ok |
| usuário anônimo (null) não recebe liberação | `false` | `false` | ok |
| formação despublicada bloqueia a aula publicada | `false` | `false` | ok |
| matrícula expirada bloqueia a aula | `false` | `false` | ok |

## D. Enviar vídeo

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| admin envia vídeo | `permitido` | `permitido` | ok |
| instrutora do curso envia vídeo | `permitido` | `permitido` | ok |
| instrutora de OUTRO curso envia vídeo | `recusado` | `recusado` | ok |
| aluna matriculada envia vídeo | `recusado` | `recusado` | ok |
| comercial envia vídeo | `recusado` | `recusado` | ok |
| financeiro envia vídeo | `recusado` | `recusado` | ok |
| anônimo envia vídeo | `recusado` | `recusado` | ok |
| aluna não enxerga o rastro de envios | `0` | `0` | ok |

## E. Assistir

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| aluna matriculada, aula liberada lê o vídeo | `1` | `1` | ok |
| aluna matriculada, aula em rascunho lê o vídeo | `0` | `0` | ok |
| aluna SEM matrícula lê o vídeo | `0` | `0` | ok |
| outra aluna qualquer lê o vídeo | `0` | `0` | ok |
| anônimo lê o vídeo | `0` | `0` | ok |
| comercial lê o vídeo | `0` | `0` | ok |
| financeiro lê o vídeo | `0` | `0` | ok |
| instrutora do curso lê o vídeo | `1` | `1` | ok |
| instrutora de OUTRO curso lê o vídeo | `0` | `0` | ok |
| admin lê o vídeo | `1` | `1` | ok |
| aluna não consegue GRAVAR no bucket de vídeos | `recusado` | `recusado` | ok |

## F. Antiórfão

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| upload abandonado aparece na lista de limpeza | `inclui abandonado.mp4` | `abandonado.mp4` | ok |
| upload concluído NÃO aparece como órfão | `sem ok.mp4` | `abandonado.mp4` | ok |
| aula sem progresso de aluna → pode excluir | `false` | `false` | ok |
| aula com progresso de aluna → exige arquivamento | `true` | `true` | ok |
| arquivar preserva o progresso da aluna | `1` | `1` | ok |
| aula arquivada deixa de ser liberada | `false` | `false` | ok |

## H. Upload resumível

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| os 10 estados formalizados são aceitos pelo banco | `todos aceitos` | `todos aceitos` | ok |
| estado fora da lista é recusado pelo banco | `recusou` | `recusou` | ok |
| duas abas não conseguem abrir dois envios para a mesma aula | `recusou o segundo` | `recusou o segundo` | ok |
| trocar o vídeo depois de concluído é permitido | `aceitou` | `aceitou` | ok |
| aula sem vídeo não está pronta para publicar | `false` | `false` | ok |
| aula com vídeo validado e nenhum envio em aberto está pronta | `true` | `true` | ok |
| envio em andamento impede publicar, mesmo com vídeo anterior ligado | `false` | `false` | ok |
| envio pausado, enviando ou validando abandonado entra na limpeza | `os três aparecem` | `abandonado-pausado.mp4,abandonado-enviando.mp4,abandonado-validando.mp4` | ok |

## G. Limpeza

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| a formação volta a rascunho, sem aulas, com a descrição aprovada preservada | `draft/0 aulas/0 capítulos publicados` | `draft/0 aulas/0 capítulos publicados` | ok |
