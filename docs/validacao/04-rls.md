# Evidência — matriz de RLS

**Comando:** `node scripts/homolog/04-rls.mjs`  
**Ambiente:** homologação local, PostgreSQL 18.4  
**Resultado:** 55/55 verificações conforme o esperado.

## Como o teste troca de usuário

Cada verificação roda em transação própria com:

```sql
set local role authenticated;   -- ou anon
select set_config('request.jwt.claim.sub', '<uuid do usuário>', true);
```

É exatamente o que o PostgREST/Supabase faz. O superusuário `postgres` monta a
massa de teste, mas **nenhuma asserção roda como superusuário** — se rodasse, a RLS
seria ignorada e o teste não provaria nada.

## Legenda

| Valor | Significado |
| --- | --- |
| número | quantidade de linhas que o perfil consegue LER |
| `permitido` | a escrita foi aceita |
| `bloqueado` | a escrita não afetou nenhuma linha (RLS filtrou) |
| `negado` | o PostgreSQL recusou por permissão (`42501`) |

## Matriz

| Operação | Aluna A | Aluna B | Instrutora | Comercial | Financeiro | Administrador | Anônimo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ler matrículas (quantas enxerga) | 1 ✅ | 1 ✅ | — | — | — | 2 ✅ | 0 ✅ |
| Ler a matrícula ESPECÍFICA da Aluna B | 0 ✅ | — | — | — | — | — | — |
| Ler o progresso da Aluna B | 0 ✅ | — | — | — | — | — | — |
| Ler o próprio progresso | — | 1 ✅ | — | — | — | — | — |
| Ler o perfil da Aluna B | 0 ✅ | — | — | — | — | — | — |
| Ler o pedido da Aluna A | — | 0 ✅ | — | — | — | — | — |
| Ler o próprio pedido | 1 ✅ | — | — | — | — | — | — |
| Alterar progresso da Aluna B | bloqueado ✅ | — | — | — | — | — | — |
| Tentar se promover a admin (UPDATE aceito) | permitido ✅ | — | — | — | — | — | — |
| …papel após a tentativa continua "student" | 1 ✅ | — | — | — | — | — | — |
| Criar curso | negado ✅ | — | — | — | — | — | — |
| Publicar oferta | bloqueado ✅ | — | — | — | — | — | — |
| Ler aula do curso que leciona | — | — | 1 ✅ | — | — | — | — |
| Ler aula de curso de OUTRA instrutora | — | — | 0 ✅ | — | — | — | — |
| Ler entrega de atividade do próprio curso | — | — | 1 ✅ | — | — | — | — |
| Corrigir entrega do próprio curso | — | — | permitido ✅ | — | — | — | — |
| Ler progresso de aluna do próprio curso | — | — | 1 ✅ | — | — | — | — |
| Alterar pagamento | — | — | bloqueado ✅ | — | — | — | — |
| Ler respostas do diagnóstico | — | — | 0 ✅ | 1 ✅ | 0 ✅ | 1 ✅ | 0 ✅ |
| Ler leads | — | — | — | 1 ✅ | 0 ✅ | 1 ✅ | 0 ✅ |
| Atualizar estágio do lead | — | — | — | permitido ✅ | — | — | — |
| Ler pedidos | — | — | — | 1 ✅ | 1 ✅ | — | 0 ✅ |
| ALTERAR pagamento | — | — | — | bloqueado ✅ | — | — | — |
| ALTERAR pedido | — | — | — | bloqueado ✅ | — | — | — |
| Alterar aula | — | — | — | bloqueado ✅ | — | — | — |
| Ler aula | — | — | — | 0 ✅ | — | — | — |
| Ler pagamentos | — | — | — | — | 1 ✅ | 1 ✅ | 0 ✅ |
| Atualizar pedido (estorno) | — | — | — | — | permitido ✅ | — | — |
| ALTERAR aula | — | — | — | — | bloqueado ✅ | — | — |
| Ler progresso de alunas | — | — | — | — | 0 ✅ | — | — |
| Editar aula | — | — | — | — | — | permitido ✅ | — |
| Ler auditoria | — | — | — | — | — | 1 ✅ | 0 ✅ |
| Ler curso publicado | — | — | — | — | — | — | 1 ✅ |
| Ler curso em RASCUNHO | — | — | — | — | — | — | 0 ✅ |
| Ler aula (sem matrícula) | — | — | — | — | — | — | 0 ✅ |
| Ler perfis | — | — | — | — | — | — | 0 ✅ |
| Ler consentimentos | — | — | — | — | — | — | 0 ✅ |
| Ler alternativas com gabarito | — | — | — | — | — | — | 0 ✅ |
| Inserir lead diretamente | — | — | — | — | — | — | negado ✅ |
| Inserir evento de analytics (permitido de propósito) | — | — | — | — | — | — | permitido ✅ |

## Observações

- **"Promover-se a admin" aparece como `permitido`** e está correto: o `UPDATE` é
  aceito porque a aluna pode editar o próprio perfil, mas o trigger
  `profiles_guard_role` **descarta a mudança de papel**. A verificação seguinte
  confirma que o papel continua `student`.
- **Comercial lê respostas do diagnóstico** por decisão de produto: é o insumo do
  atendimento. **Financeiro não lê** — não precisa desse dado para conciliar pagamento.
- **`analytics_events` aceita insert anônimo** de propósito: é o único ponto de escrita
  pública, sem dado pessoal. Lead, resposta de quiz e pedido passam por rota de servidor.
