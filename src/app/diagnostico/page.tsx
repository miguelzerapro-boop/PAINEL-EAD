import Link from 'next/link'
import type { Metadata } from 'next'

import { QuizForm, type QuizPergunta } from './quiz-form'
import { Topo } from '@/components/site-chrome'
import { EstadoVazio } from '@/components/estados'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Diagnóstico',
  description: 'Um diagnóstico curto para entender o seu momento na profissão.',
}

export const dynamic = 'force-dynamic'

export default async function DiagnosticoPage() {
  const db = await createClient()

  const { data: quiz } = await db
    .from('quizzes')
    .select(
      `id, slug, name, intro_title, intro_body, consent_text, status,
       collect_email, collect_city, collect_state, collect_first_name_only`,
    )
    .eq('slug', 'diagnostico')
    .eq('status', 'published')
    .maybeSingle()

  if (!quiz) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="O diagnóstico ainda não está disponível"
            texto="Assim que as perguntas forem cadastradas e publicadas no painel, esta página passa a funcionar."
            acao={{ label: 'Voltar ao início', href: '/' }}
          />
        </main>
      </>
    )
  }

  const { data: perguntas } = await db
    .from('quiz_questions')
    .select(
      `id, prompt, help_text, type, is_required, position, min_selections, max_selections,
       quiz_options (id, label, value, help_text, position)`,
    )
    .eq('quiz_id', quiz.id)
    .eq('status', 'published')
    .order('position')

  // `weights` NUNCA é enviado ao navegador: a segmentação é calculada no
  // servidor. O que vai para o cliente é só rótulo e valor.
  const lista: QuizPergunta[] = (perguntas ?? []).map((p) => ({
    id: p.id,
    prompt: p.prompt,
    helpText: p.help_text,
    type: p.type as QuizPergunta['type'],
    required: p.is_required,
    minSelections: p.min_selections ?? 1,
    maxSelections: p.max_selections,
    opcoes: (p.quiz_options ?? [])
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label, value: o.value, helpText: o.help_text })),
  }))

  if (lista.length === 0) {
    return (
      <>
        <Topo />
        <main id="conteudo" className="page section">
          <EstadoVazio
            titulo="O diagnóstico ainda não tem perguntas"
            texto="As perguntas precisam ser cadastradas no painel administrativo antes de o diagnóstico ir ao ar."
            acao={{ label: 'Voltar ao início', href: '/' }}
          />
        </main>
      </>
    )
  }

  return (
    <>
      <Topo />
      <main id="conteudo">
        {/*
          O texto de abertura do CMS é passado PARA a tela inicial do quiz, e
          não renderizado acima dela. Renderizado à parte, produzia dois títulos
          na mesma tela assim que `intro_title` fosse preenchido no painel.
        */}
        <QuizForm
          quizSlug={quiz.slug}
          perguntas={lista}
          introTitulo={quiz.intro_title}
          introTexto={quiz.intro_body}
          consentText={quiz.consent_text}
          coleta={{
            email: quiz.collect_email,
            cidade: quiz.collect_city,
            estado: quiz.collect_state,
            apenasPrimeiroNome: quiz.collect_first_name_only,
          }}
        />
      </main>
      <p className="page" style={{ paddingBlockEnd: 'var(--space-6)', fontSize: 'var(--size-small)', color: 'var(--text-secondary)' }}>
        <Link href="/privacidade">Como tratamos seus dados</Link>
      </p>
    </>
  )
}
