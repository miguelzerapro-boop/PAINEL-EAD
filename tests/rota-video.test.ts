import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ROTA DO VÍDEO DA AULA — /api/aulas/[id]/video
 *
 * Prova o comportamento da rota isolando as duas dependências: a leitura do
 * caminho no banco e a checagem de liberação. O que se verifica aqui é a
 * DECISÃO da rota — que código HTTP ela devolve, que mensagem, e se em algum
 * caso ela entrega o caminho do arquivo sem passar pela liberação.
 *
 * A regra de liberação em si (matrícula, prazo, turma, pré-requisito) NÃO é
 * testada aqui: ela é `lesson_is_released()` no banco, verificada contra
 * PostgreSQL real em scripts/homolog/10-formacao.mjs, seção C.
 */

const mockUrlDeMidia = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('@/lib/storage/assinado', () => ({
  urlDeMidiaDaAula: (...args: unknown[]) => mockUrlDeMidia(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  }),
}))

const { GET } = await import('@/app/api/aulas/[id]/video/route')

function pedido(id = 'aula-1') {
  return GET(new Request(`http://localhost/api/aulas/${id}/video`), {
    params: Promise.resolve({ id }),
  })
}

/** Aula com vídeo ligado no bucket certo. */
function aulaComVideo() {
  return {
    data: {
      id: 'aula-1',
      video_asset_id: 'midia-1',
      media_assets: { bucket: 'lesson-videos', path: 'curso-1/aula-1/video.mp4' },
    },
  }
}

beforeEach(() => {
  mockUrlDeMidia.mockReset()
  mockMaybeSingle.mockReset()
})

describe('aula sem vídeo', () => {
  it('devolve 404 e não chega a checar liberação', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'aula-1', video_asset_id: null } })

    const r = await pedido()
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toEqual({ message: 'Esta aula ainda não tem vídeo.' })
    expect(mockUrlDeMidia).not.toHaveBeenCalled()
  })

  it('aula inexistente também é 404', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })

    const r = await pedido('nao-existe')
    expect(r.status).toBe(404)
    expect(mockUrlDeMidia).not.toHaveBeenCalled()
  })
})

describe('mídia em bucket inesperado', () => {
  it('recusa com 400 sem assinar nada', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'aula-1',
        video_asset_id: 'midia-1',
        media_assets: { bucket: 'cms-media', path: 'qualquer/coisa.mp4' },
      },
    })

    const r = await pedido()
    expect(r.status).toBe(400)
    expect(mockUrlDeMidia).not.toHaveBeenCalled()
  })
})

describe('autorização — quem assiste', () => {
  it('sem sessão devolve 401', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: false, motivo: 'sem_sessao' })

    const r = await pedido()
    expect(r.status).toBe(401)
    await expect(r.json()).resolves.toEqual({ message: 'Entre na sua conta para assistir.' })
  })

  it('aula não liberada devolve 403 — é o caso da aluna sem matrícula', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })

    const r = await pedido()
    expect(r.status).toBe(403)
    await expect(r.json()).resolves.toEqual({
      message: 'Esta aula ainda não está liberada para você.',
    })
  })

  it('falha ao assinar devolve 502, sem detalhe técnico', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: false, motivo: 'falha' })

    const r = await pedido()
    expect(r.status).toBe(502)
    const corpo = await r.json()
    expect(corpo.message).toBe('Não foi possível abrir o vídeo agora.')
    expect(JSON.stringify(corpo)).not.toMatch(/lesson-videos|\.mp4|select |curso-1/)
  })

  it('aluna autorizada é redirecionada para a URL assinada', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({
      ok: true,
      url: 'https://projeto.supabase.co/storage/v1/object/sign/lesson-videos/x?token=abc',
      expiraEm: 900,
    })

    const r = await pedido()
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toContain('token=abc')
  })
})

describe('a liberação é sempre perguntada ao banco', () => {
  it('a rota passa lessonId e caminho para a checagem, e não decide sozinha', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: true, url: 'https://x/y', expiraEm: 900 })

    await pedido('aula-1')

    expect(mockUrlDeMidia).toHaveBeenCalledTimes(1)
    expect(mockUrlDeMidia).toHaveBeenCalledWith({
      lessonId: 'aula-1',
      bucket: 'lesson-videos',
      caminho: 'curso-1/aula-1/video.mp4',
    })
  })

  it('nenhum caminho vem do cliente: o id pedido é o usado na checagem', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: true, url: 'https://x/y', expiraEm: 900 })

    await pedido('outra-aula')

    expect(mockUrlDeMidia.mock.calls[0]?.[0]).toMatchObject({ lessonId: 'outra-aula' })
  })
})

describe('o link assinado não é cacheável', () => {
  it('a resposta autorizada manda no-store', async () => {
    mockMaybeSingle.mockResolvedValue(aulaComVideo())
    mockUrlDeMidia.mockResolvedValue({ ok: true, url: 'https://x/y', expiraEm: 900 })

    const r = await pedido()
    expect(r.headers.get('cache-control')).toContain('no-store')
    expect(r.headers.get('cache-control')).toContain('private')
  })
})
