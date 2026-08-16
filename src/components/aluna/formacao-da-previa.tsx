import Link from 'next/link'

import { capitulosDaPrevia, type PreviaAtiva } from '@/lib/admin/previa'

/**
 * A FORMAÇÃO COMO A ALUNA DESTE PLANO VÊ.
 *
 * Renderiza dentro da área da aluna de verdade — mesmo cabeçalho, mesmo menu,
 * mesma tipografia. Não é uma tela de administração disfarçada: é a interface
 * que a compradora encontra, montada com os capítulos do plano escolhido.
 *
 * O CAPÍTULO FECHADO NÃO É ERRO. Ele aparece inteiro, com o nome legível e o
 * plano que o abre — em cinza neutro, nunca em vermelho. Um cadeado seco em
 * cima de um bloco apagado faz a aluna achar que a plataforma quebrou; dizer
 * "disponível no plano Completo" transforma o mesmo bloqueio em informação.
 */
export async function FormacaoDaPrevia({
  previa,
  nomeDoPlanoCompleto,
}: {
  previa: PreviaAtiva
  /** Para o convite do capítulo fechado apontar o plano certo. */
  nomeDoPlanoCompleto?: string
}) {
  const capitulos = await capitulosDaPrevia(previa)
  const abertos = capitulos.filter((c) => c.aberto).length

  return (
    <section className="formacao-aluna">
      <header className="formacao-aluna__topo">
        <p className="eyebrow">Minha formação</p>
        <h1 className="formacao-aluna__titulo">Formação em manicure e nail design</h1>
        <p className="formacao-aluna__resumo">
          <strong>
            {abertos} de {capitulos.length}
          </strong>{' '}
          capítulos liberados no seu plano <strong>{previa.nome}</strong>.
        </p>

        {/* Barra de progresso do plano, não do estudo: nenhuma aula foi vista
            ainda porque este é um modo de conferência. */}
        <div
          className="formacao-aluna__barra"
          role="img"
          aria-label={`${abertos} de ${capitulos.length} capítulos liberados`}
        >
          <span style={{ inlineSize: `${(abertos / Math.max(capitulos.length, 1)) * 100}%` }} />
        </div>
      </header>

      <ol className="capitulos" role="list">
        {capitulos.map((c, i) => (
          <li key={c.id} className="capitulo" data-aberto={c.aberto ? 'sim' : 'nao'}>
            <span className="capitulo__ordem mono">{String(i + 1).padStart(2, '0')}</span>

            <div className="capitulo__corpo">
              <p className="capitulo__nome">{c.nome}</p>

              {c.aberto ? (
                <p className="capitulo__meta">
                  {c.aulas > 0
                    ? `${c.aulas} ${c.aulas === 1 ? 'aula' : 'aulas'}`
                    : 'As aulas deste capítulo estão sendo preparadas.'}
                </p>
              ) : (
                <p className="capitulo__meta capitulo__meta--fechado">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                    <path d="M5.75 7V5a2.25 2.25 0 0 1 4.5 0v2" />
                  </svg>
                  Disponível no plano {nomeDoPlanoCompleto ?? 'Completo'}
                </p>
              )}
            </div>

            {c.aberto ? (
              <span className="capitulo__acao capitulo__acao--aberto">Abrir</span>
            ) : (
              <Link className="capitulo__acao capitulo__acao--fechado" href="/planos">
                Ver planos
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
