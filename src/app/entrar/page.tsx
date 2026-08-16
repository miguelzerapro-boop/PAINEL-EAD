import type { Metadata } from 'next'

import { LoginForm } from './login-form'
import { Assinatura } from '@/components/site-chrome'
import { ComposicaoVisual, VAGAS } from '@/components/composicao-visual'
import { MARCA } from '@/lib/marca'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

/**
 * ENTRADA POR E-MAIL E SENHA.
 *
 * A versão anterior era um título e dois campos centrados num branco vazio —
 * lia como tela padrão de autenticação, de qualquer sistema. Nada ali dizia
 * de quem era a plataforma.
 *
 * Agora são duas metades: a marca à esquerda, sobre fotografia e roxo
 * profundo, e o formulário à direita. No celular a foto sai da frente e o
 * formulário sobe — quem abre o login no telefone quer digitar, não admirar a
 * composição.
 *
 * A senha é criada na compra. Por isso não existe botão de cadastro aqui: um
 * "criar conta" nesta tela abriria caminho para conta sem compra, e a pessoa
 * chegaria numa área de estudos vazia sem entender por quê. O link leva para
 * os planos.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams

  return (
    <main id="conteudo" className="entrar">
      {/* ------------------------------------------------ lado da marca --- */}
      <section className="entrar__marca" aria-hidden="true">
        <div className="entrar__fundo">
          <ComposicaoVisual
            vaga={VAGAS.heroPrincipal}
            mediaPath={null}
            className="entrar__foto"
            sizes="(max-width: 60rem) 0px, 50vw"
            prioridade
          />
          <span className="entrar__veu" />
          <span className="capa__luz capa__luz--alta" />
        </div>

        <div className="entrar__marca-conteudo">
          <Assinatura href="/" tamanho="grande" />
          <p className="entrar__frase">
            A formação continua de onde você parou.
          </p>
        </div>
      </section>

      {/* -------------------------------------------- lado do formulário --- */}
      <section className="entrar__painel">
        <div className="entrar__caixa">
          {/* No celular o lado da marca some; a assinatura reaparece aqui. */}
          <div className="entrar__marca-mobile">
            <Assinatura href="/" />
          </div>

          <p className="eyebrow">Área da aluna</p>
          <h1 className="entrar__titulo">Entre na sua conta</h1>
          <p className="entrar__apoio">
            Use o e-mail e a senha que você criou ao escolher seu plano.
          </p>

          <LoginForm proximo={proximo ?? '/aluna'} />

          <p className="entrar__assinatura-legal">{MARCA.nome}</p>
        </div>
      </section>
    </main>
  )
}
