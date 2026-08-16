# Acesso por pacote — verificação

26/26 verificações conforme o esperado.

Gerado por `node scripts/homolog/11-pacotes.mjs`. Toda pergunta sobre acesso
é feita a `lesson_is_released()` no PostgreSQL — a regra de pacote não é
reimplementada no teste.

## A. Matriz

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| iniciante: R$ 29.90 com 3 capítulos | `R$ 29.90 / 3 capítulos` | `R$ 29.90 / 3 capítulos` | ok |
| profissional: R$ 39.90 com 6 capítulos | `R$ 39.90 / 6 capítulos` | `R$ 39.90 / 6 capítulos` | ok |
| completo: R$ 54.90 com 8 capítulos | `R$ 54.90 / 8 capítulos` | `R$ 54.90 / 8 capítulos` | ok |
| Profissional inclui tudo do Iniciante | `0` | `0` | ok |
| Completo inclui tudo do Profissional | `0` | `0` | ok |

## B. Jornada iniciante

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| abre exatamente 3 capítulos | `3` | `3` | ok |
| nenhum capítulo além do pacote | `nenhum` | `nenhum` | ok |
| nenhum capítulo do pacote foi negado | `nenhum` | `nenhum` | ok |

## B. Jornada profissional

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| abre exatamente 6 capítulos | `6` | `6` | ok |
| nenhum capítulo além do pacote | `nenhum` | `nenhum` | ok |
| nenhum capítulo do pacote foi negado | `nenhum` | `nenhum` | ok |

## B. Jornada completo

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| abre exatamente 8 capítulos | `8` | `8` | ok |
| nenhum capítulo além do pacote | `nenhum` | `nenhum` | ok |
| nenhum capítulo do pacote foi negado | `nenhum` | `nenhum` | ok |

## C. URL direta

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| Iniciante NÃO abre Unhas de Fibra pela URL | `false` | `false` | ok |
| Iniciante NÃO abre Esmaltação em Gel pela URL | `false` | `false` | ok |
| Profissional NÃO abre Unhas de Fibra pela URL | `false` | `false` | ok |
| Completo ABRE Unhas de Fibra | `true` | `true` | ok |
| aula GRATUITA de capítulo não comprado continua bloqueada | `false` | `false` | ok |
| a mesma aula gratuita abre para quem nunca comprou (degustação) | `true` | `true` | ok |

## D. Upgrade

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| após comprar o Completo, abre os 8 capítulos | `8` | `8` | ok |
| continua com UMA matrícula, sem duplicar | `1` | `1` | ok |
| o progresso anterior foi preservado | `1` | `1` | ok |

## E. Pagamento

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| pedido PENDENTE não libera capítulo nenhum | `false` | `false` | ok |
| ao virar PAGO, o capítulo do pacote abre | `true` | `true` | ok |

## F. Cortesia

| verificação | esperado | obtido |  |
| --- | --- | --- | --- |
| matrícula manual abre os 8 (não veio de compra) | `8` | `8` | ok |
