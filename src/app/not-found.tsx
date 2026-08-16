import Link from 'next/link'

import { Palheta, Trilho } from '@/components/palheta'

export default function NaoEncontrado() {
  return (
    /*
     * `id="conteudo"` é obrigatório: o link "Ir para o conteúdo" do layout
     * aponta para esta âncora. Sem ele, o atalho de acessibilidade não leva a
     * lugar nenhum — foi o que a auditoria de cliques encontrou nesta tela.
     */
    <main id="conteudo" className="page section" style={{ maxWidth: 'var(--width-text)' }}>
      <p className="eyebrow">404</p>
      <h1>Esta página não existe</h1>
      <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>
        O endereço pode ter mudado, ou o conteúdo ainda não foi publicado.
      </p>

      <div style={{ marginBlockStart: 'var(--space-7)' }}>
        <Trilho rotulo="Para onde ir">
          <Palheta titulo="Início" meta="a página principal" href="/" />
          <Palheta titulo="Planos" meta="os três pacotes e preços" href="/planos" />
          <Palheta acao titulo="Ver planos" href="/planos" />
        </Trilho>
      </div>

      <p style={{ marginBlockStart: 'var(--space-6)' }}>
        <Link href="/entrar">Entrar na área da aluna</Link>
      </p>
    </main>
  )
}
