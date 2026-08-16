# Evidência — Storage: buckets e policies

**Comando:** `node scripts/homolog/08-storage.mjs`  
**Ambiente:** local PostgreSQL @ localhost:55432/homolog  
**Resultado:** 48/48 verificações conforme o esperado.

> Até esta rodada o projeto **não tinha bucket nenhum**: qualquer vídeo ou PDF enviado
> ficaria sem proteção. A migration `0020` cria os 10 buckets e 24 policies.

## Buckets

| Bucket | Acesso | Limite | Tipos | Caminho | URL assinada | Finalidade |
| --- | --- | --- | --- | --- | --- | --- |
| `cms-media` | 🌐 público | 10 MB | 5 | `{page_key}/{arquivo}` | — | Imagens da landing e institucionais já publicadas |
| `course-covers` | 🌐 público | 5 MB | 4 | `{course_id}/{arquivo}` | — | Capa pública de curso |
| `instructor-media` | 🌐 público | 5 MB | 4 | `{instructor_id}/{arquivo}` | — | Retrato e capa da instrutora |
| `certificates` | 🔒 privado | 5 MB | 1 | `{user_id}/{certificate_id}.pdf` | 300s | PDF do certificado |
| `lesson-assets` | 🔒 privado | 100 MB | 5 | `{course_id}/{lesson_id}/{arquivo}` | 900s | PDF e material de apoio da aula |
| `lesson-videos` | 🔒 privado | 5120 MB | 3 | `{course_id}/{lesson_id}/{arquivo}` | 900s | Vídeo de aula — conteúdo pago |
| `profile-avatars` | 🔒 privado | 2 MB | 3 | `{user_id}/{arquivo}` | 600s | Foto de perfil |
| `student-submissions` | 🔒 privado | 100 MB | 6 | `{user_id}/{activity_id}/{arquivo}` | 600s | Fotos e vídeos da prática da aluna |
| `submission-feedback` | 🔒 privado | 50 MB | 7 | `{user_id}/{submission_id}/{arquivo}` | 600s | Devolutiva da instrutora |
| `testimonials` | 🔒 privado | 5 MB | 3 | `{testimonial_id}/{arquivo}` | 3600s | Foto de aluna em depoimento |

## Matriz de permissões

| Valor | Significado |
| --- | --- |
| número | quantos objetos o perfil consegue LER |
| `permitido` | escrita aceita |
| `bloqueado` | escrita não atingiu nenhuma linha (a policy filtrou) |
| `negado` | recusado por policy no `WITH CHECK` (`42501`) |
| `recusado pelo bucket` | tipo MIME ou tamanho fora do configurado |

| Operação | Aluna A | Aluna B | Instrutora | Outra instrutora | Comercial | Financeiro | Admin | Anônimo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ler a própria entrega | 1 ✅ | — | — | — | — | — | — | — |
| Ler a entrega da Aluna A | — | 0 ✅ | 1 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | 1 ✅ | 0 ✅ |
| Enviar entrega na PRÓPRIA pasta | permitido ✅ | — | — | — | — | — | — | — |
| Enviar entrega na pasta de OUTRA aluna | — | negado ✅ | — | — | — | — | — | — |
| Substituir a entrega da Aluna A | — | bloqueado ✅ | — | — | — | — | — | — |
| Apagar a entrega da Aluna A | — | bloqueado ✅ | — | — | — | — | — | — |
| Enviar tipo PROIBIDO (executável) | recusado pelo bucket ✅ | — | — | — | — | — | — | — |
| Enviar acima do LIMITE de tamanho | recusado pelo bucket ✅ | — | — | — | — | — | — | — |
| Enviar sem activity_id no caminho | negado ✅ | — | — | — | — | — | — | — |
| Ler vídeo de aula LIBERADA | 1 ✅ | — | — | — | — | — | — | — |
| Ler vídeo de aula TRANCADA | 0 ✅ | — | — | — | — | — | — | — |
| Ler vídeo sem matrícula | — | — | — | — | 0 ✅ | — | — | — |
| Ler vídeo | — | — | — | — | — | — | — | 0 ✅ |
| Ler vídeo do curso que leciona | — | — | 1 ✅ | — | — | — | — | — |
| Ler vídeo de curso alheio | — | — | — | 0 ✅ | — | — | — | — |
| Enviar vídeo de aula | negado ✅ | — | — | — | — | — | — | — |
| Enviar vídeo no curso que leciona | — | — | permitido ✅ | — | — | — | — | — |
| Apagar vídeo de aula | — | — | bloqueado ✅ | — | — | — | — | — |
| Ler o próprio certificado | 1 ✅ | — | — | — | — | — | — | — |
| Ler o certificado da Aluna A | — | 0 ✅ | — | — | — | — | — | — |
| Ler certificado | — | — | — | — | — | — | — | 0 ✅ |
| Gravar o próprio certificado (só o servidor pode) | negado ✅ | — | — | — | — | — | — | — |
| Ler o próprio avatar | 1 ✅ | — | — | — | — | — | — | — |
| Ler o avatar da Aluna A | — | 0 ✅ | — | — | — | — | — | — |
| Trocar o próprio avatar | permitido ✅ | — | — | — | — | — | — | — |
| Ler o feedback recebido | 1 ✅ | — | — | — | — | — | — | — |
| Ler o feedback da Aluna A | — | 0 ✅ | — | — | — | — | — | — |
| Enviar feedback | — | negado ✅ | permitido ✅ | — | — | — | — | — |
| Ler foto de depoimento | 0 ✅ | — | — | — | — | — | 1 ✅ | 0 ✅ |
| Ler capa de curso (bucket público) | — | — | — | — | — | — | — | 1 ✅ |
| Enviar capa de curso | negado ✅ | — | — | — | — | — | permitido ✅ | — |
| Substituir capa de curso | — | — | — | — | bloqueado ✅ | — | — | — |
| Arquivo removido deixa de ser acessível | 0 ✅ | — | — | — | — | — | — | — |
| LISTAR o bucket de entregas (vê só as próprias) | 2 ✅ | 0 ✅ | — | — | — | — | 2 ✅ | — |
| LISTAR o bucket de vídeos (vê só as aulas liberadas) | 1 ✅ | — | — | — | — | — | — | 0 ✅ |

## Decisões que valem explicar

- **Depoimentos são bucket privado.** A foto é de uma aluna real. Bucket público serve o
  arquivo a qualquer pessoa com a URL, mesmo antes de o depoimento ser publicado. O site
  recebe URL assinada gerada no servidor, e só quando o depoimento está publicado,
  verificado e com consentimento registrado.
- **Certificado é privado.** Contém nome completo.
- **Nem a aluna grava o próprio certificado.** Só o servidor, via service role.
- **`{user_id}` no caminho é preso ao `auth.uid()`** pelo `WITH CHECK`. Trocar o id no
  caminho para gravar na pasta de outra aluna é recusado com `42501` — testado.
- **Instrutora só enxerga os cursos que leciona**, tanto no banco quanto no Storage.
- **Comercial e financeiro não leem entrega de aluna.** Não precisam.

## Limites deste teste

- Tamanho e MIME são aplicados pela **API de Storage** do Supabase, antes de a linha
  chegar ao banco. Aqui isso é emulado por trigger no shim, o que prova que a
  **configuração do bucket está correta**, não que a API a aplica.
- **A expiração da URL assinada não foi testada** — é comportamento do servidor de
  Storage do Supabase, não do PostgreSQL. Só verificável no ambiente hospedado.
- Um bucket público é, por definição, legível por qualquer pessoa que tenha a URL. O que
  o projeto garante é que **o site só monta essa URL quando o registro está publicado**.
