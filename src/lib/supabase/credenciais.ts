/**
 * CREDENCIAIS DO SUPABASE — o que está configurado, sem nunca revelar valor.
 *
 * CORREÇÃO IMPORTANTE sobre a etapa anterior: comprimento de chave NÃO serve
 * para decidir validade. O Supabase aceita hoje dois formatos:
 *
 *   legado   `eyJhbGciOi…`        JWT, ~200+ caracteres
 *   novo     `sb_publishable_…`   chave pública, curta
 *            `sb_secret_…`        chave de backend, curta e NÃO é JWT
 *
 * Uma `sb_secret_` legítima tem menos de 60 caracteres. Reprovar por tamanho
 * rejeitaria projeto novo e válido. O que se detecta aqui é PLACEHOLDER — por
 * conteúdo — e formato de URL implausível.
 *
 * REGRAS DESTE ARQUIVO
 *   1. nenhuma função devolve, imprime ou registra valor de chave;
 *   2. a chave de backend nunca é lida a partir de código de cliente — as
 *      funções que a tocam moram atrás de `apenasServidor()`;
 *   3. nomes legados continuam funcionando: nada quebra por não migrar.
 */

/* -------------------------------------------------------------------------- */
/* Nomes aceitos, em ordem de preferência                                      */
/* -------------------------------------------------------------------------- */

/**
 * Chave PÚBLICA (vai para o navegador; é isso mesmo, por desenho).
 * O nome novo é preferido; o legado segue aceito.
 */
const NOMES_CHAVE_PUBLICA = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

/**
 * Chave de BACKEND (nunca vai para o navegador).
 * `SUPABASE_SECRET_KEY` é o nome novo; `SUPABASE_SERVICE_ROLE_KEY`, o legado.
 */
const NOMES_CHAVE_BACKEND = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const

/**
 * Marcas de placeholder.
 *
 * Um valor que contenha qualquer uma destas sequências é tratado como "ainda
 * não configurado" — é assim que `.env.example` e os arquivos de exemplo
 * costumam vir preenchidos.
 */
const MARCAS_DE_PLACEHOLDER = [
  'placeholder',
  'troque',
  'troque_por',
  'exemplo',
  'example',
  'changeme',
  'change-me',
  'your-',
  'your_',
  'seu-',
  'seu_',
  'sua-',
  'sua_',
  'coloque',
  'preencha',
  'todo',
  'xxxx',
  'aaaa',
  '<',
  'dummy',
  'fake',
] as const

export type Origem = 'novo' | 'legado' | 'ausente'

export type EstadoDeChave = {
  /** Nome da variável que forneceu o valor. Nunca o valor. */
  variavel: string | null
  presente: boolean
  placeholder: boolean
  origem: Origem
  /** Formato reconhecido — só a família, nunca o conteúdo. */
  formato: 'jwt' | 'sb_publishable' | 'sb_secret' | 'desconhecido' | null
}

export type EstadoDaUrl = {
  variavel: string
  presente: boolean
  placeholder: boolean
  /** A URL tem cara de projeto Supabase real (ou instância local)? */
  plausivel: boolean
  /** `hospedado` = *.supabase.co · `local` = 127.0.0.1/localhost · `proprio` = domínio próprio */
  tipo: 'hospedado' | 'local' | 'proprio' | null
}

export type DiagnosticoDeCredenciais = {
  url: EstadoDaUrl
  chavePublica: EstadoDeChave
  chaveBackend: EstadoDeChave
  /** Tudo presente, nada placeholder, URL plausível. */
  pronto: boolean
  /** Motivos legíveis do que falta. Sem valores. */
  pendencias: string[]
}

/* -------------------------------------------------------------------------- */

function ehPlaceholder(valor: string): boolean {
  const v = valor.trim().toLowerCase()
  if (v === '') return true
  return MARCAS_DE_PLACEHOLDER.some((marca) => v.includes(marca))
}

function formatoDaChave(valor: string): EstadoDeChave['formato'] {
  const v = valor.trim()
  if (v.startsWith('sb_publishable_')) return 'sb_publishable'
  if (v.startsWith('sb_secret_')) return 'sb_secret'
  // JWT: três segmentos separados por ponto, começando por "eyJ".
  if (/^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(v)) return 'jwt'
  return 'desconhecido'
}

function lerPrimeira(
  nomes: readonly string[],
  ambiente: NodeJS.ProcessEnv,
): { variavel: string; valor: string } | null {
  for (const nome of nomes) {
    const valor = ambiente[nome]
    if (typeof valor === 'string' && valor.trim() !== '') {
      return { variavel: nome, valor: valor.trim() }
    }
  }
  return null
}

function avaliarChave(
  nomes: readonly string[],
  ambiente: NodeJS.ProcessEnv,
): EstadoDeChave {
  const achada = lerPrimeira(nomes, ambiente)
  if (!achada) {
    return { variavel: null, presente: false, placeholder: false, origem: 'ausente', formato: null }
  }

  return {
    variavel: achada.variavel,
    presente: true,
    placeholder: ehPlaceholder(achada.valor),
    origem: achada.variavel === nomes[0] ? 'novo' : 'legado',
    formato: formatoDaChave(achada.valor),
  }
}

/**
 * A URL parece um projeto Supabase de verdade?
 *
 * Aceita três formas legítimas:
 *   https://<ref>.supabase.co     projeto hospedado
 *   http://127.0.0.1:54321        `supabase start` local
 *   https://qualquer.dominio      domínio próprio (self-host)
 *
 * Reprova host de placeholder — que é exatamente o caso de
 * `https://placeholder.supabase.co`.
 */
export function avaliarUrl(bruta: string | undefined): EstadoDaUrl {
  const variavel = 'NEXT_PUBLIC_SUPABASE_URL'

  if (!bruta || bruta.trim() === '') {
    return { variavel, presente: false, placeholder: false, plausivel: false, tipo: null }
  }

  const valor = bruta.trim()
  if (ehPlaceholder(valor)) {
    return { variavel, presente: true, placeholder: true, plausivel: false, tipo: null }
  }

  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return { variavel, presente: true, placeholder: false, plausivel: false, tipo: null }
  }

  const host = url.hostname.toLowerCase()

  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return {
      variavel,
      presente: true,
      placeholder: false,
      plausivel: url.protocol === 'http:' || url.protocol === 'https:',
      tipo: 'local',
    }
  }

  if (url.protocol !== 'https:') {
    return { variavel, presente: true, placeholder: false, plausivel: false, tipo: null }
  }

  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) {
    // O sub-domínio é a referência do projeto: minúsculas e dígitos, sem ponto.
    const ref = host.split('.')[0] ?? ''
    const refPlausivel = /^[a-z0-9]{8,}$/.test(ref)
    return {
      variavel,
      presente: true,
      placeholder: false,
      plausivel: refPlausivel,
      tipo: 'hospedado',
    }
  }

  // Domínio próprio: exige pelo menos um ponto, para não aceitar "https://x".
  return {
    variavel,
    presente: true,
    placeholder: false,
    plausivel: host.includes('.'),
    tipo: 'proprio',
  }
}

/**
 * Retrato do que está configurado. NÃO devolve nenhum valor de chave.
 *
 * Aceita o ambiente por parâmetro para ser testável sem mexer em process.env.
 */
export function diagnosticarCredenciais(
  ambiente: NodeJS.ProcessEnv = process.env,
): DiagnosticoDeCredenciais {
  const url = avaliarUrl(ambiente.NEXT_PUBLIC_SUPABASE_URL)
  const chavePublica = avaliarChave(NOMES_CHAVE_PUBLICA, ambiente)
  const chaveBackend = avaliarChave(NOMES_CHAVE_BACKEND, ambiente)

  const pendencias: string[] = []

  if (!url.presente) pendencias.push('NEXT_PUBLIC_SUPABASE_URL não está definida.')
  else if (url.placeholder) pendencias.push('NEXT_PUBLIC_SUPABASE_URL ainda é um valor de exemplo.')
  else if (!url.plausivel) pendencias.push('NEXT_PUBLIC_SUPABASE_URL não tem formato de projeto Supabase.')

  if (!chavePublica.presente) {
    pendencias.push(
      `Falta a chave pública (${NOMES_CHAVE_PUBLICA[0]} ou ${NOMES_CHAVE_PUBLICA[1]}).`,
    )
  } else if (chavePublica.placeholder) {
    pendencias.push(`${chavePublica.variavel} ainda é um valor de exemplo.`)
  }

  if (!chaveBackend.presente) {
    pendencias.push(
      `Falta a chave de backend (${NOMES_CHAVE_BACKEND[0]} ou ${NOMES_CHAVE_BACKEND[1]}).`,
    )
  } else if (chaveBackend.placeholder) {
    pendencias.push(`${chaveBackend.variavel} ainda é um valor de exemplo.`)
  }

  return {
    url,
    chavePublica,
    chaveBackend,
    pronto: pendencias.length === 0,
    pendencias,
  }
}

/** Atalho: dá para falar com um Supabase de verdade? */
export function credenciaisReais(ambiente: NodeJS.ProcessEnv = process.env): boolean {
  return diagnosticarCredenciais(ambiente).pronto
}

/* -------------------------------------------------------------------------- */
/* Leitura de valor — só no servidor                                           */
/* -------------------------------------------------------------------------- */

function apenasServidor(nomeDaFuncao: string) {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${nomeDaFuncao} é de servidor. A chave de backend nunca pode chegar ao navegador.`,
    )
  }
}

/**
 * A chave de backend em uso. Somente servidor.
 *
 * Aceita o nome novo e o legado — o projeto continua funcionando sem migrar
 * nenhuma variável.
 */
export function chaveDeBackend(ambiente: NodeJS.ProcessEnv = process.env): string | null {
  apenasServidor('chaveDeBackend()')
  return lerPrimeira(NOMES_CHAVE_BACKEND, ambiente)?.valor ?? null
}

/** A chave pública em uso. Pode ser lida no navegador — é para isso que serve. */
export function chavePublica(ambiente: NodeJS.ProcessEnv = process.env): string | null {
  return lerPrimeira(NOMES_CHAVE_PUBLICA, ambiente)?.valor ?? null
}

export function urlDoSupabase(ambiente: NodeJS.ProcessEnv = process.env): string | null {
  const valor = ambiente.NEXT_PUBLIC_SUPABASE_URL
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

/**
 * Rótulo seguro para relatório: diz o FORMATO e nada mais.
 * Nunca devolve caractere algum do valor real.
 */
export function descreverFormato(estado: EstadoDeChave): string {
  if (!estado.presente) return 'ausente'
  if (estado.placeholder) return 'valor de exemplo'
  switch (estado.formato) {
    case 'jwt':
      return 'chave legada (JWT)'
    case 'sb_publishable':
      return 'chave pública nova (sb_publishable_)'
    case 'sb_secret':
      return 'chave de backend nova (sb_secret_)'
    default:
      return 'formato não reconhecido'
  }
}
