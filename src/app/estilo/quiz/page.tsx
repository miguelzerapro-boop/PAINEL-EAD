import type { Metadata } from 'next'

import { QuizForm, type QuizPergunta } from '@/app/diagnostico/quiz-form'

/**
 * BANCADA DE REVISÃO DO QUIZ — não é página pública.
 *
 * O Supabase deste ambiente é um espaço reservado, então `/diagnostico` cai
 * (corretamente) no estado vazio e não há como fotografar os estados da
 * interface. Esta rota monta o COMPONENTE REAL, com a lógica real de limite,
 * validação, rascunho e envio, alimentado por perguntas de exemplo.
 *
 * As perguntas abaixo NÃO são conteúdo do curso e não devem ser confundidas
 * com as perguntas aprovadas: são rótulos neutros, escritos para exercitar o
 * layout. As perguntas reais vivem no banco e são cadastradas no painel.
 */

export const metadata: Metadata = {
  title: 'Bancada de revisão — quiz',
  robots: { index: false, follow: false },
}

const PERGUNTAS_DE_EXEMPLO: QuizPergunta[] = [
  {
    id: 'exemplo-1',
    prompt: 'Enunciado de exemplo, com o comprimento típico de uma pergunta real',
    helpText: 'Texto de apoio de exemplo. O texto real vem do painel.',
    type: 'single',
    required: true,
    minSelections: 1,
    maxSelections: null,
    opcoes: [
      { id: 'e1a', label: 'Primeira alternativa de exemplo', value: 'a', helpText: null },
      { id: 'e1b', label: 'Segunda alternativa de exemplo', value: 'b', helpText: 'Com texto de apoio.' },
      { id: 'e1c', label: 'Terceira alternativa de exemplo', value: 'c', helpText: null },
      { id: 'e1d', label: 'Quarta alternativa de exemplo', value: 'd', helpText: null },
    ],
  },
  {
    id: 'exemplo-2',
    prompt: 'Enunciado de exemplo para uma pergunta de múltipla escolha',
    helpText: null,
    type: 'multiple',
    required: true,
    minSelections: 1,
    maxSelections: 3,
    opcoes: [
      { id: 'e2a', label: 'Alternativa A de exemplo', value: 'a', helpText: null },
      { id: 'e2b', label: 'Alternativa B de exemplo', value: 'b', helpText: null },
      { id: 'e2c', label: 'Alternativa C de exemplo', value: 'c', helpText: null },
      { id: 'e2d', label: 'Alternativa D de exemplo', value: 'd', helpText: null },
      { id: 'e2e', label: 'Alternativa E de exemplo', value: 'e', helpText: null },
    ],
  },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `exemplo-${i + 3}`,
    prompt: `Enunciado de exemplo número ${i + 3}`,
    helpText: null,
    type: 'single' as const,
    required: true,
    minSelections: 1,
    maxSelections: null,
    opcoes: [
      { id: `e${i + 3}a`, label: 'Alternativa de exemplo', value: 'a', helpText: null },
      { id: `e${i + 3}b`, label: 'Outra alternativa de exemplo', value: 'b', helpText: null },
    ],
  })),
]

export default function BancadaQuiz() {
  return (
    <>
      <p className="bancada-aviso" role="note">
        <strong>Bancada de revisão.</strong> As perguntas e alternativas desta tela são exemplos
        neutros, escritos só para exercitar o layout. Não são o conteúdo do diagnóstico, que é
        cadastrado no painel. Esta rota não é indexada e não existe no site público.
      </p>

      <main id="conteudo">
        <QuizForm
          quizSlug="diagnostico"
          perguntas={PERGUNTAS_DE_EXEMPLO}
          consentText="Autorizo o contato pelo WhatsApp e o tratamento dos meus dados conforme a política de privacidade."
          coleta={{ email: true, cidade: true, estado: true, apenasPrimeiroNome: true }}
        />
      </main>
    </>
  )
}
