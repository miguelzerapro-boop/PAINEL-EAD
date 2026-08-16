import type { Metadata } from 'next'

import { LoginForm } from './login-form'
import { Assinatura } from '@/components/site-chrome'
import { ComposicaoVisual, VAGAS } from '@/components/composicao-visual'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

/**
 * ENTRAR — uma tela só, com a marca dentro dela.
 *
 * A versão anterior era "foto de um lado, formulário branco do outro": duas
 * metades que não se falavam, e no celular a metade da marca simplesmente
 * sumia, sobrando um formulário genérico.
 *
 * Agora é UMA composição. O fundo é a fotografia sob o roxo profundo, do lado
 * a lado; o formulário flutua sobre ela num cartão claro. No celular a
 * fotografia continua lá, atrás — o cartão só ocupa mais espaço. A pessoa vê
 * a mesma tela nos dois lugares, não duas telas diferentes.
 *
 * A conta é criada na compra. Por isso não existe "criar conta" aqui: um
 * cadastro livre nesta tela levaria a uma área de estudos vazia, sem que a
 * pessoa entendesse por quê.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams

  return (
    <main id="conteudo" className="entrar">
      {/* --------------------------------------------------- o cenário --- */}
      <div className="entrar__cena" aria-hidden="true">
        <ComposicaoVisual
          vaga={VAGAS.heroPrincipal}
          mediaPath={null}
          className="entrar__foto"
          sizes="100vw"
          prioridade
        />
        <span className="entrar__veu" />
        <span className="entrar__brilho" />
      </div>

      {/* --------------------------------------------------- o conteúdo -- */}
      <div className="entrar__palco">
        <header className="entrar__cabecalho">
          <Assinatura href="/" tamanho="grande" />
          <p className="entrar__frase">
            Sua formação continua
            <br />
            de onde você parou.
          </p>
        </header>

        <section className="entrar__cartao">
          <p className="entrar__rotulo">Área da aluna</p>
          <h1 className="entrar__titulo">Entre na sua conta</h1>
          <p className="entrar__apoio">
            Use o e-mail e a senha que você criou ao escolher seu plano.
          </p>

          <LoginForm proximo={proximo ?? '/aluna'} />
        </section>
      </div>
    </main>
  )
}
