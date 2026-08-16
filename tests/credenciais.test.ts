import { describe, expect, it } from 'vitest'

import {
  avaliarUrl,
  credenciaisReais,
  descreverFormato,
  diagnosticarCredenciais,
} from '@/lib/supabase/credenciais'

/**
 * DETECÇÃO DE CREDENCIAIS
 *
 * Corrige um erro da etapa anterior: comprimento de chave NÃO decide validade.
 * Uma `sb_secret_…` legítima tem menos de 60 caracteres e não é JWT; reprovar
 * por tamanho rejeitaria projeto novo e válido.
 *
 * O que se detecta é PLACEHOLDER (por conteúdo) e URL implausível.
 */

const CHAVE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMH0.assinatura-de-teste'

function ambiente(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...extra } as NodeJS.ProcessEnv
}

describe('URL do projeto', () => {
  it('aceita projeto hospedado', () => {
    const r = avaliarUrl('https://abcdefghijklmnop.supabase.co')
    expect(r.plausivel).toBe(true)
    expect(r.tipo).toBe('hospedado')
    expect(r.placeholder).toBe(false)
  })

  it('aceita instância local do supabase start', () => {
    const r = avaliarUrl('http://127.0.0.1:54321')
    expect(r.plausivel).toBe(true)
    expect(r.tipo).toBe('local')
  })

  it('aceita domínio próprio em self-host', () => {
    const r = avaliarUrl('https://supabase.escola.com.br')
    expect(r.plausivel).toBe(true)
    expect(r.tipo).toBe('proprio')
  })

  it('detecta o placeholder que estava no .env.local', () => {
    const r = avaliarUrl('https://placeholder.supabase.co')
    expect(r.placeholder).toBe(true)
    expect(r.plausivel).toBe(false)
  })

  it('recusa URL vazia e malformada', () => {
    expect(avaliarUrl('').presente).toBe(false)
    expect(avaliarUrl(undefined).presente).toBe(false)
    expect(avaliarUrl('nem-url').plausivel).toBe(false)
  })

  it('recusa http em projeto hospedado', () => {
    expect(avaliarUrl('http://abcdefghijklmnop.supabase.co').plausivel).toBe(false)
  })

  it('recusa referência de projeto curta demais', () => {
    expect(avaliarUrl('https://abc.supabase.co').plausivel).toBe(false)
  })
})

describe('formatos de chave — sem julgar por tamanho', () => {
  it('aceita a chave nova sb_publishable, que é curta', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
        SUPABASE_SECRET_KEY: 'sb_secret_xyz789',
      }),
    )
    expect(d.pronto).toBe(true)
    expect(d.chavePublica.formato).toBe('sb_publishable')
    expect(d.chaveBackend.formato).toBe('sb_secret')
    expect(d.chaveBackend.origem).toBe('novo')
  })

  it('aceita as chaves legadas em JWT', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE_JWT,
        SUPABASE_SERVICE_ROLE_KEY: CHAVE_JWT,
      }),
    )
    expect(d.pronto).toBe(true)
    expect(d.chavePublica.formato).toBe('jwt')
    expect(d.chavePublica.origem).toBe('legado')
  })

  it('uma sb_secret curta NÃO é reprovada por tamanho', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a',
        SUPABASE_SECRET_KEY: 'sb_secret_b',
      }),
    )
    expect(d.pronto).toBe(true)
    expect(d.pendencias).toHaveLength(0)
  })

  it('prefere o nome novo quando os dois existem', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_novo',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE_JWT,
        SUPABASE_SECRET_KEY: 'sb_secret_novo',
        SUPABASE_SERVICE_ROLE_KEY: CHAVE_JWT,
      }),
    )
    expect(d.chavePublica.variavel).toBe('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect(d.chaveBackend.variavel).toBe('SUPABASE_SECRET_KEY')
  })
})

describe('placeholders', () => {
  it('reprova o estado atual do projeto', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'coloque_sua_anon_key',
        SUPABASE_SERVICE_ROLE_KEY: 'troque_por_32_bytes_aleatorios_em_hex',
      }),
    )
    expect(d.pronto).toBe(false)
    expect(d.pendencias.length).toBeGreaterThanOrEqual(3)
  })

  it('detecta as marcas usuais de exemplo', () => {
    for (const marca of ['your-key-here', 'CHANGEME', 'seu_token', '<preencher>', 'exemplo123']) {
      const d = diagnosticarCredenciais(
        ambiente({
          NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: marca,
          SUPABASE_SECRET_KEY: 'sb_secret_ok',
        }),
      )
      expect(d.chavePublica.placeholder, `"${marca}" deveria ser placeholder`).toBe(true)
      expect(d.pronto).toBe(false)
    }
  })

  it('reporta ausência de cada chave separadamente', () => {
    const d = diagnosticarCredenciais(
      ambiente({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co' }),
    )
    expect(d.chavePublica.presente).toBe(false)
    expect(d.chaveBackend.presente).toBe(false)
    expect(d.pendencias.some((p) => p.includes('chave pública'))).toBe(true)
    expect(d.pendencias.some((p) => p.includes('chave de backend'))).toBe(true)
  })
})

describe('nada vaza', () => {
  it('o diagnóstico não contém nenhum caractere das chaves', () => {
    const segredo = 'sb_secret_valor_ultrassecreto_que_nao_pode_vazar'
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_tambem_secreto',
        SUPABASE_SECRET_KEY: segredo,
      }),
    )
    const serializado = JSON.stringify(d)
    expect(serializado).not.toContain(segredo)
    expect(serializado).not.toContain('ultrassecreto')
    expect(serializado).not.toContain('tambem_secreto')
  })

  it('descreverFormato devolve só a família da chave', () => {
    const d = diagnosticarCredenciais(
      ambiente({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_valor_secreto',
      }),
    )
    const texto = descreverFormato(d.chaveBackend)
    expect(texto).toBe('chave de backend nova (sb_secret_)')
    expect(texto).not.toContain('valor_secreto')
  })
})

describe('atalho credenciaisReais', () => {
  it('false com placeholder, true com valores plausíveis', () => {
    expect(
      credenciaisReais(
        ambiente({
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x',
          SUPABASE_SERVICE_ROLE_KEY: 'y',
        }),
      ),
    ).toBe(false)

    expect(
      credenciaisReais(
        ambiente({
          NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ok',
          SUPABASE_SECRET_KEY: 'sb_secret_ok',
        }),
      ),
    ).toBe(true)
  })
})
