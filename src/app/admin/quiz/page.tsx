import Link from 'next/link'

import { PublicarQuiz } from './publicar'
import { Aviso } from '@/components/estados'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Painel do diagnóstico.
 *
 * Reúne o que estava espalhado: perguntas, alternativas, resultados,
 * publicação e histórico de versões.
 */
export default async function AdminQuizPage() {
  const db = createAdminClient()

  const { data: quiz } = await db
    .from('quizzes')
    .select('id, slug, name, status, version, published_at, fallback_message, collect_city, collect_state')
    .eq('slug', 'diagnostico')
    .maybeSingle()

  if (!quiz) {
    return (
      <>
        <h1 className="admin__titulo">Diagnóstico</h1>
        <Aviso tone="error">O diagnóstico não foi encontrado no banco.</Aviso>
      </>
    )
  }

  const [perguntas, resultados, historico, respostas] = await Promise.all([
    db
      .from('quiz_questions')
      .select('id, prompt, type, position, status, max_selections, quiz_options (id)')
      .eq('quiz_id', quiz.id)
      .order('position'),
    db.from('quiz_outcomes').select('id, key, name, preferred_target, course_id, offer_id, target_path').eq('quiz_id', quiz.id).order('position'),
    db
      .from('cms_revisions')
      .select('id, version, action, actor_name, note, created_at')
      .eq('entity_type', 'quizzes')
      .eq('entity_id', quiz.id)
      .order('version', { ascending: false })
      .limit(10),
    db.from('quiz_responses').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id),
  ])

  const publicadas = (perguntas.data ?? []).filter((p) => p.status === 'published').length

  return (
    <>
      <h1 className="admin__titulo">Diagnóstico</h1>

      <div style={{ display: 'grid', gap: 'var(--space-3)', marginBlockEnd: 'var(--space-6)' }}>
        <Aviso tone={quiz.status === 'published' ? 'success' : 'warning'}>
          <p>
            <strong>{quiz.status === 'published' ? 'No ar' : 'Fora do ar'}</strong> · versão{' '}
            <span className="mono">{quiz.version}</span>
            {quiz.published_at ? ` · publicado em ${formatDate(quiz.published_at, 'short')}` : ''}
          </p>
          <p className="palheta__meta">
            {publicadas} perguntas publicadas · {resultados.data?.length ?? 0} resultados ·{' '}
            {respostas.count ?? 0} respostas recebidas
          </p>
        </Aviso>

        <PublicarQuiz quizId={quiz.id} publicado={quiz.status === 'published'} />
      </div>

      {/* --- Perguntas --- */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)' }}>
          <h2>Perguntas</h2>
          {/*
            Aponta para o construtor, não para o cadastro genérico. O caminho
            antigo (`/admin/perguntas-quiz/novo` + `/admin/opcoes-quiz`) fazia
            a pergunta nascer numa tela e as alternativas em outra.
          */}
          <Link className="botao botao--cta" href="/admin/quiz/pergunta/nova">
            + Nova pergunta
          </Link>
        </div>

        <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
          {(perguntas.data ?? []).map((p, i) => (
            <div key={p.id} className="lista-admin__linha">
              <div>
                <span className="mono" style={{ marginInlineEnd: 'var(--space-3)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Link href={`/admin/quiz/pergunta/${p.id}`} style={{ fontWeight: 600 }}>
                  {p.prompt}
                </Link>
                <p className="palheta__meta">
                  {p.type === 'multiple'
                    ? `múltipla escolha · até ${p.max_selections ?? 'sem limite'}`
                    : 'escolha única'}{' '}
                  · {(p.quiz_options ?? []).length}{' '}
                  {(p.quiz_options ?? []).length === 1 ? 'resposta' : 'respostas'}
                </p>
              </div>
              <span className="mono">{p.status}</span>
            </div>
          ))}
          {(perguntas.data ?? []).length === 0 ? (
            <p className="lista-admin__vazia">Nenhuma pergunta cadastrada.</p>
          ) : null}
        </div>
      </section>

      {/* --- Resultados --- */}
      <section style={{ marginBlockStart: 'var(--space-7)' }}>
        <h2>Resultados possíveis</h2>
        <p className="lead" style={{ marginBlockStart: 'var(--space-3)' }}>
          Cada resultado descreve um <strong>momento da pessoa</strong>, não um produto. O destino é
          decidido na hora: curso publicado → oferta ativa → página → WhatsApp.
        </p>
        <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
          {(resultados.data ?? []).map((r) => {
            const destino = r.course_id
              ? 'curso vinculado'
              : r.offer_id
                ? 'oferta vinculada'
                : r.target_path
                  ? `página ${r.target_path}`
                  : 'WhatsApp (nenhum destino cadastrado)'
            return (
              <div key={r.id} className="lista-admin__linha">
                <div>
                  <Link href={`/admin/resultados-quiz/${r.id}`} style={{ fontWeight: 600 }}>
                    {r.name}
                  </Link>
                  <p className="palheta__meta">
                    <span className="mono">{r.key}</span> · {destino}
                  </p>
                </div>
                <span className="mono">{r.preferred_target}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* --- Histórico --- */}
      <section style={{ marginBlockStart: 'var(--space-7)' }}>
        <h2>Histórico de versões</h2>
        <div className="lista-admin" style={{ marginBlockStart: 'var(--space-4)' }}>
          {(historico.data ?? []).map((h) => (
            <div key={h.id} className="lista-admin__linha">
              <div>
                <strong>
                  versão <span className="mono">{h.version}</span> · {h.action}
                </strong>
                {h.note ? <p className="palheta__meta">{h.note}</p> : null}
              </div>
              <span className="mono">
                {h.actor_name ?? '—'} · {formatDate(h.created_at, 'short')}
              </span>
            </div>
          ))}
          {(historico.data ?? []).length === 0 ? (
            <p className="lista-admin__vazia">Nenhuma publicação registrada.</p>
          ) : null}
        </div>
      </section>

      {/* --- Mensagem de encaminhamento --- */}
      <section style={{ marginBlockStart: 'var(--space-7)' }}>
        <h2>Mensagem quando não há curso compatível</h2>
        <p className="prose" style={{ marginBlockStart: 'var(--space-3)' }}>
          {quiz.fallback_message}
        </p>
        <p className="palheta__meta" style={{ marginBlockStart: 'var(--space-3)' }}>
          Editável em <code>quizzes.fallback_message</code>. O botão de WhatsApp só aparece se o
          número estiver cadastrado em Ajustes.
        </p>
      </section>
    </>
  )
}
