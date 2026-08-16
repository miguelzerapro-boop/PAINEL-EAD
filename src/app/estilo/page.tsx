import type { Metadata } from 'next'

import { Aviso, EstadoVazio, EsqueletoTrilho, Progresso } from '@/components/estados'
import { Foto } from '@/components/foto-pendente'
import { Palheta, Trilho, TrilhoItem } from '@/components/palheta'

export const metadata: Metadata = {
  title: 'Referência do design system',
  robots: { index: false, follow: false },
}

/**
 * Página de referência do design system.
 *
 * Existe para conferir o sistema visual sem depender de conteúdo real: todos
 * os rótulos aqui são explicitamente marcados como amostra. Não é uma página
 * do site, não é indexada e não deve ser divulgada.
 */
export default function EstiloPage() {
  return (
    <main id="conteudo" className="page" style={{ paddingBlock: 'var(--space-6) var(--space-9)' }}>
      <p className="eyebrow">Referência interna</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-display)', lineHeight: 'var(--leading-display)' }}>
        Mostruário
      </h1>
      <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
        Amostras do sistema visual. Todo texto desta página é rótulo de amostra, não conteúdo.
      </p>

      {/* --- Tipografia --- */}
      <Secao titulo="Tipografia">
        <p className="eyebrow">Fraunces · destaque</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-display)', lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-display)' }}>
          Precisão em camadas
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-h1)', lineHeight: 'var(--leading-title)' }}>
          Título de página — ação, coração, mãos
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-h2)', lineHeight: 'var(--leading-title)' }}>
          Título de seção
        </p>

        <p className="eyebrow" style={{ marginBlockStart: 'var(--space-6)' }}>IBM Plex Sans · leitura</p>
        <h3>Título de bloco</h3>
        <h4>Título de aula</h4>
        <p className="prose" style={{ marginBlockStart: 'var(--space-3)' }}>
          Texto de estudo em corpo 19px com entrelinha 1,65 e largura máxima de 62 caracteres.
          Acentuação completa: à, á, â, ã, é, ê, í, ó, ô, õ, ú, ç. Números tabulares: 0123456789.
        </p>

        <p className="eyebrow" style={{ marginBlockStart: 'var(--space-6)' }}>IBM Plex Mono · números</p>
        <p className="mono">N.01 · 04:32 · R$ 0.000,00 · 38% · 2026-07-29</p>
      </Secao>

      {/* --- Cores --- */}
      <Secao titulo="Cores (provisórias)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {[
            ['--brand-primary', 'brand-primary'],
            ['--brand-secondary', 'brand-secondary'],
            ['--brand-accent', 'brand-accent'],
            ['--surface-main', 'surface-main'],
            ['--surface-soft', 'surface-soft'],
            ['--surface-strong', 'surface-strong'],
            ['--success', 'success'],
            ['--warning', 'warning'],
            ['--error', 'error'],
          ].map(([token, nome]) => (
            <div key={nome} style={{ width: '9rem' }}>
              <div
                style={{
                  height: '4rem',
                  background: `var(${token})`,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-media)',
                }}
              />
              <p className="mono" style={{ marginBlockStart: 'var(--space-2)' }}>{nome}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* --- Palheta e trilho --- */}
      <Secao titulo="Palheta no trilho — elemento de assinatura">
        <Trilho rotulo="Amostra do trilho horizontal">
          <Palheta codigo="N.01" titulo="Amostra concluída" meta="estado done" state="done" />
          <Palheta codigo="N.02" titulo="Amostra em andamento" meta="estado current" state="current" />
          <Palheta codigo="N.03" titulo="Amostra disponível" meta="estado available" />
          <Palheta
            codigo="N.04"
            titulo="Amostra bloqueada"
            state="locked"
            motivo="Esta aula abre quando você concluir a anterior."
          />
          <Palheta acao codigo="N.05" titulo="Amostra de ação" meta="a última do trilho é sempre a ação" destaque />
        </Trilho>

        <div style={{ marginBlockStart: 'var(--space-7)', maxWidth: '34rem' }}>
          <p className="eyebrow">Trilho vertical</p>
          <div className="trilho trilho--vertical" style={{ marginBlockStart: 'var(--space-3)' }}>
            <div className="trilho__itens">
              <TrilhoItem titulo="Item concluído" meta="04:12" state="done" />
              <TrilhoItem titulo="Item atual" meta="07:40" state="current" />
              <TrilhoItem titulo="Item disponível" meta="03:05" />
              <TrilhoItem titulo="Item bloqueado" state="locked" motivo="Abre 7 dias após a matrícula." />
            </div>
          </div>
        </div>
      </Secao>

      {/* --- Controles --- */}
      <Secao titulo="Controles">
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button className="botao botao--primario">Ação primária</button>
          <button className="botao botao--secundario">Ação secundária</button>
          <button className="botao botao--discreto">Ação discreta</button>
          <button className="botao botao--primario" disabled>Desabilitada</button>
        </div>

        <div className="formulario" style={{ marginBlockStart: 'var(--space-6)' }}>
          <label className="campo">
            <span className="campo__rotulo">Rótulo do campo</span>
            <input className="entrada" placeholder="Amostra" />
            <span className="campo__dica">Dica de preenchimento.</span>
          </label>
          <label className="campo">
            <span className="campo__rotulo">Campo com erro</span>
            <input className="entrada" aria-invalid="true" defaultValue="valor inválido" />
            <span className="campo__erro">Mensagem de erro.</span>
          </label>
          <button className="opcao" role="radio" aria-checked="true" type="button">
            <span className="opcao__marca" aria-hidden="true" />
            <span>Alternativa marcada</span>
          </button>
          <button className="opcao" role="radio" aria-checked="false" type="button">
            <span className="opcao__marca" aria-hidden="true" />
            <span>Alternativa não marcada</span>
          </button>
        </div>
      </Secao>

      {/* --- Progresso e avisos --- */}
      <Secao titulo="Progresso e avisos">
        <div style={{ maxWidth: '26rem' }}>
          <Progresso pct={38} rotulo="Amostra de progresso" />
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginBlockStart: 'var(--space-5)', maxWidth: '38rem' }}>
          <Aviso titulo="Aviso neutro">Texto de amostra.</Aviso>
          <Aviso tone="success" titulo="Confirmação">Texto de amostra.</Aviso>
          <Aviso tone="warning" titulo="Atenção">Texto de amostra.</Aviso>
          <Aviso tone="error" titulo="Erro">Texto de amostra.</Aviso>
        </div>
      </Secao>

      {/* --- Estados --- */}
      <Secao titulo="Estado vazio, carregamento e foto pendente">
        <EstadoVazio
          titulo="Amostra de estado vazio"
          texto="Diz o que não existe, por quê, e o que fazer agora."
          acao={{ label: 'Ação sugerida', href: '/estilo' }}
        />

        <div style={{ marginBlockStart: 'var(--space-6)' }}>
          <EsqueletoTrilho itens={3} />
        </div>

        <div style={{ marginBlockStart: 'var(--space-6)', maxWidth: '28rem' }}>
          <Foto
            slot={{
              key: 'amostra',
              name: 'Foto principal da abertura',
              recommendedWidth: 2400,
              recommendedHeight: 1600,
              aspectRatio: '3:2',
            }}
          />
        </div>
      </Secao>
    </main>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBlockStart: 'var(--space-9)' }}>
      <p
        className="editorial__rotulo"
        style={{ marginBlockEnd: 'var(--space-5)', display: 'block', maxWidth: '22ch' }}
      >
        {titulo}
      </p>
      {children}
    </section>
  )
}
