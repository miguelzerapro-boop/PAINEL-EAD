import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CabecalhoAdmin } from '@/components/admin/cabecalho'
import { EditorDePergunta, type RespostaEditavel } from './editor'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pergunta do diagnóstico' }

/**
 * `/admin/quiz/pergunta/nova` cria; `/admin/quiz/pergunta/{id}` edita.
 *
 * Os resultados possíveis do diagnóstico vêm do banco — nenhum nome de
 * momento está escrito aqui.
 */
export default async function PerguntaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nova = id === 'nova'
  const db = createAdminClient()

  const { data: quiz } = await db
    .from('quizzes')
    .select('id, name')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!quiz) notFound()

  const { data: resultados } = await db
    .from('quiz_outcomes')
    .select('key, name, position')
    .eq('quiz_id', quiz.id)
    .order('position')

  let pergunta: { id: string; prompt: string; help_text: string | null; position: number } | null =
    null
  let respostas: RespostaEditavel[] = []

  if (!nova) {
    const { data } = await db
      .from('quiz_questions')
      .select('id, prompt, help_text, position')
      .eq('id', id)
      .maybeSingle()

    if (!data) notFound()
    pergunta = data

    const { data: opcoes } = await db
      .from('quiz_options')
      .select('id, label, weights, position')
      .eq('question_id', id)
      .order('position')

    respostas = (opcoes ?? []).map((o) => {
      /*
       * Desmonta o `weights` para a tela. O motor aceita vários resultados
       * por resposta; a interface mostra o de maior peso, que é como as
       * perguntas do escopo estão montadas. Se um dia alguém escrever um peso
       * combinado direto no banco, a tela mostra o principal e preserva o
       * resto ao salvar apenas se não for editado — por isso o campo é
       * explícito, e não adivinhado.
       */
      const pesos = Object.entries((o.weights ?? {}) as Record<string, number>)
      const principal = pesos.sort((a, b) => Number(b[1]) - Number(a[1]))[0]

      return {
        id: o.id,
        label: o.label,
        outcome: principal?.[0] ?? '',
        peso: Number(principal?.[1] ?? 2),
      }
    })
  }

  const { count: total } = await db
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quiz.id)

  return (
    <>
      <CabecalhoAdmin
        trilha={<Link href="/admin/quiz">Diagnóstico</Link>}
        titulo={nova ? 'Nova pergunta' : 'Editar pergunta'}
        descricao="A pergunta e as respostas são salvas juntas. Ao lado, você vê exatamente como a aluna enxerga."
      />

      <EditorDePergunta
        quizId={quiz.id}
        perguntaId={pergunta?.id ?? null}
        promptInicial={pergunta?.prompt ?? ''}
        ajudaInicial={pergunta?.help_text ?? ''}
        posicao={pergunta?.position ?? total ?? 0}
        respostasIniciais={respostas}
        resultados={(resultados ?? []).map((o) => ({ chave: o.key, nome: o.name }))}
      />
    </>
  )
}
