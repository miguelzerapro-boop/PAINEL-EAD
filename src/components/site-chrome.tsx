import Link from 'next/link'

import { NavMobile, type ItemNav } from '@/components/nav-mobile'
import { getPublicSettings } from '@/lib/cms/page'
import { listPublishedCourses } from '@/lib/content/catalog'

/**
 * Cabecalho e rodape do site publico.
 *
 * Tudo que aparece vem de settings. O que ainda nao foi preenchido
 * simplesmente nao e renderizado - nada de "Sua Empresa LTDA" de exemplo.
 */

export async function Topo() {
  const [settings, cursos] = await Promise.all([
    getPublicSettings(),
    listPublishedCourses({ limit: 1 }),
  ])
  const nome = asText(settings['site.name'])

  // "Cursos" só entra quando existe curso publicado: um link para catálogo
  // vazio é pior do que link nenhum.
  const temCursos = cursos.length > 0

  const itens: ItemNav[] = [
    { href: '/#como-funciona', rotulo: 'Como funciona' },
    ...(temCursos ? [{ href: '/cursos', rotulo: 'Cursos' }] : []),
    { href: '/entrar', rotulo: 'Entrar' },
    { href: '/diagnostico', rotulo: 'Fazer o diagnóstico', cta: true },
  ]

  return (
    <header className="topo">
      <div className="page topo__interno">
        <Link className="topo__marca" href="/">
          {nome ?? 'Escola de unhas'}
        </Link>

        <nav className="topo__nav" aria-label="Navegação principal">
          <Link href="/#como-funciona">Como funciona</Link>
          {temCursos ? <Link href="/cursos">Cursos</Link> : null}
          <Link href="/entrar">Entrar</Link>
          <Link className="botao botao--primario" href="/diagnostico">
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
            <p className="topo__marca">{nome ?? 'Escola de unhas'}</p>
            {horario ? <p className="lead" style={{ marginBlockStart: 'var(--space-3)' }}>{horario}</p> : null}
          </div>

          <div>
            <p className="eyebrow">Navegação</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBlockStart: 'var(--space-3)' }}>
              <li><Link href="/cursos">Cursos</Link></li>
              <li><Link href="/diagnostico">Diagnóstico</Link></li>
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
          <p>© {ano}</p>
        </div>
      </div>
    </footer>
  )
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}
