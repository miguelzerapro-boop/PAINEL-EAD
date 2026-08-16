import Image from 'next/image'
import Link from 'next/link'

import { NavMobile, type ItemNav } from '@/components/nav-mobile'
import { getPublicSettings } from '@/lib/cms/page'
import { listPublishedCourses } from '@/lib/content/catalog'
import { MARCA } from '@/lib/marca'

/**
 * Cabecalho e rodape do site publico.
 *
 * Tudo que aparece vem de settings. O que ainda nao foi preenchido
 * simplesmente nao e renderizado - nada de "Sua Empresa LTDA" de exemplo.
 *
 * O CABEÇALHO É ESCURO. A versão anterior era uma barra branca com o nome em
 * texto e quatro links em linha: lia como template administrativo, e a marca
 * não aparecia em lugar nenhum. Agora o topo abre no roxo profundo da
 * identidade, com a logo real, e é a primeira coisa que se vê — inclusive
 * porque emenda com a primeira dobra da landing, que também é escura.
 */

/**
 * A assinatura visual: selo + nome em duas linhas.
 *
 * Não aceita nome por parâmetro de propósito. O lockup depende da quebra
 * exata "Katia Franck / Nail's Studio" — jogar uma string arbitrária de
 * `site.name` aqui desmontaria a composição. `site.name` continua mandando
 * onde é texto corrido: título do navegador e linha legal do rodapé.
 */
export function Assinatura({
  href = '/',
  tamanho = 'padrao',
}: {
  href?: string | null
  tamanho?: 'padrao' | 'grande'
}) {
  const conteudo = (
    <>
      <Image
        className="marca__selo"
        src={MARCA.logo.src}
        alt=""
        width={MARCA.logo.largura}
        height={MARCA.logo.altura}
        priority
      />
      {/*
        A logo é decorativa (`alt=""`) porque o nome vem logo abaixo em texto.
        As duas linhas já leem "Katia Franck Nail's Studio" na ordem certa —
        um texto extra só para leitor de tela faria a marca ser anunciada
        duas vezes seguidas.
      */}
      <span className="marca__nome">
        <span className="marca__nome-principal">{MARCA.assinatura.principal}</span>
        <span className="marca__nome-apoio">{MARCA.assinatura.apoio}</span>
      </span>
    </>
  )

  const classe = `marca marca--${tamanho}`

  return href ? (
    <Link className={classe} href={href}>
      {conteudo}
    </Link>
  ) : (
    <span className={classe}>{conteudo}</span>
  )
}

export async function Topo() {
  // O cabeçalho não lê mais `settings`: o nome dele vem do lockup da marca, e
  // a consulta sobrava em toda página do site.
  const cursos = await listPublishedCourses({ limit: 1 })

  // "Cursos" só entra quando existe curso publicado: um link para catálogo
  // vazio é pior do que link nenhum.
  const temCursos = cursos.length > 0

  const itens: ItemNav[] = [
    { href: '/#como-funciona', rotulo: 'Como funciona' },
    ...(temCursos ? [{ href: '/cursos', rotulo: 'Cursos' }] : []),
    { href: '/planos', rotulo: 'Planos' },
    { href: '/entrar', rotulo: 'Entrar' },
    { href: '/diagnostico', rotulo: 'Fazer o diagnóstico', cta: true },
  ]

  return (
    <header className="topo">
      <div className="page topo__interno">
        <Assinatura />

        <nav className="topo__nav" aria-label="Navegação principal">
          <Link href="/#como-funciona">Como funciona</Link>
          {temCursos ? <Link href="/cursos">Cursos</Link> : null}
          <Link href="/planos">Planos</Link>
          <Link href="/entrar">Entrar</Link>
          <Link className="botao botao--cta topo__cta" href="/diagnostico">
            Fazer o diagnóstico
          </Link>
        </nav>

        <NavMobile itens={itens} />
      </div>
    </header>
  )
}

export async function Rodape() {
  const settings = await getPublicSettings()

  const nome = asText(settings['site.name'])
  const razao = asText(settings['legal.company_name'])
  const cnpj = asText(settings['legal.tax_id'])
  const endereco = asText(settings['legal.address'])
  const email = asText(settings['contact.email'])
  const instagram = asText(settings['contact.instagram'])
  const horario = asText(settings['contact.hours'])

  // A política de reembolso só entra no rodapé depois de redigida: link para
  // um documento vazio é pior do que link nenhum — e, aqui, é promessa vaga.
  const temReembolso = Boolean(asText(settings['legal.refund']))

  const ano = new Date().getFullYear()

  return (
    <footer className="rodape">
      <div className="page">
        <div className="rodape__grade">
          <div>
            <Assinatura href={null} />
            {horario ? <p className="lead" style={{ marginBlockStart: 'var(--space-4)' }}>{horario}</p> : null}
          </div>

          <div>
            <p className="eyebrow">Navegação</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBlockStart: 'var(--space-3)' }}>
              <li><Link href="/cursos">Cursos</Link></li>
              <li><Link href="/diagnostico">Diagnóstico</Link></li>
              <li><Link href="/planos">Planos e preços</Link></li>
              <li><Link href="/entrar">Área da aluna</Link></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow">Contato</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBlockStart: 'var(--space-3)' }}>
              {email ? <li><a href={`mailto:${email}`}>{email}</a></li> : null}
              {instagram ? <li><a href={instagram} rel="noopener noreferrer">Instagram</a></li> : null}
              <li><Link href="/termos">Termos de uso</Link></li>
              <li><Link href="/privacidade">Política de privacidade</Link></li>
              {temReembolso ? (
                <li><Link href="/reembolso">Política de reembolso</Link></li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="rodape__legal">
          {razao ? <p>{razao}{cnpj ? ` · CNPJ ${cnpj}` : ''}</p> : null}
          {endereco ? <p>{endereco}</p> : null}
          <p>© {ano} {nome ?? MARCA.nome}</p>
        </div>
      </div>
    </footer>
  )
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}
