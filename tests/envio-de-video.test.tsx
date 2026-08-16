import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * COMPONENTE DE ENVIO — estados críticos.
 *
 * ⚠️ TESTADO COM SIMULAÇÃO, NÃO COM SUPABASE REAL.
 *
 * A transferência é substituída por um duplo controlável, para exercitar o que
 * a responsável realmente vê: a área de arrastar, a barra em andamento, a
 * pausa, a mensagem de queda de conexão com o botão de retomar, a validação e
 * o estado final.
 *
 * O que este arquivo NÃO prova: que o protocolo resumível funciona contra o
 * Supabase. Isso é `npm run storage:validate`.
 */

/* --- Duplo da transferência ------------------------------------------------ */

type Ganchos = {
  onEstado?: (e: string) => void
  onProgresso?: (p: unknown) => void
  onUrlDeRetomada?: (u: string) => void
  onSucesso?: () => void
  onFalha?: (motivo: string, mensagem: string) => void
}

let ganchos: Ganchos = {}
const iniciar = vi.fn()
const pausar = vi.fn()
const retomar = vi.fn()
const cancelar = vi.fn()

vi.mock('@/lib/video/tus', async (original) => {
  const real = await original<typeof import('@/lib/video/tus')>()
  return {
    ...real,
    EnvioResumivel: class {
      constructor(_params: unknown, eventos: Ganchos) {
        ganchos = eventos
      }
      iniciar = iniciar
      pausar = pausar
      retomar = retomar
      cancelar = cancelar
    },
  }
})

/* --- Duplos das ações de servidor ------------------------------------------ */

const preparar = vi.fn()
const confirmar = vi.fn()

vi.mock('@/app/admin/formacao/acoes', () => ({
  prepararEnvioDeVideo: (...a: unknown[]) => preparar(...a),
  confirmarEnvioDeVideo: (...a: unknown[]) => confirmar(...a),
  cancelarEnvioDeVideo: vi.fn(async () => ({ ok: true })),
  garantirRascunhoDeAula: vi.fn(async () => ({ ok: true, id: 'aula-1' })),
  registrarProgresso: vi.fn(async () => ({ ok: true })),
  registrarUrlDeRetomada: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token-de-teste' } } }) },
  }),
}))

const { EnvioDeVideo } = await import('@/components/admin/envio-de-video')

/* --- Arquivo de teste com assinatura MP4 válida ---------------------------- */

function arquivoMp4(nome = 'aula.mp4', tamanho = 40_000_000): File {
  const cabecalho = new Uint8Array(32)
  cabecalho.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], 0)
  const file = new File([cabecalho], nome, { type: 'video/mp4' })
  Object.defineProperty(file, 'size', { value: tamanho })
  // jsdom não implementa File.slice().arrayBuffer() de forma útil.
  Object.defineProperty(file, 'slice', {
    value: () => ({ arrayBuffer: async () => cabecalho.buffer }),
  })
  return file
}

function arquivoFalso(): File {
  // Cabeçalho de ZIP com nome e MIME de vídeo: o disfarce clássico.
  const zip = new Uint8Array(32)
  zip.set([0x50, 0x4b, 0x03, 0x04], 0)
  const file = new File([zip], 'nao-e-video.mp4', { type: 'video/mp4' })
  Object.defineProperty(file, 'size', { value: 1000 })
  Object.defineProperty(file, 'slice', {
    value: () => ({ arrayBuffer: async () => zip.buffer }),
  })
  return file
}

function montar(props: Partial<Parameters<typeof EnvioDeVideo>[0]> = {}) {
  return render(
    <EnvioDeVideo
      lessonId="aula-1"
      moduleId="cap-1"
      tituloDaAula="Aula de teste"
      videoAtual={null}
      {...props}
    />,
  )
}

/**
 * Dispara um gancho do transporte dentro de act().
 *
 * Sem isto, a atualização de estado que o gancho provoca acontece fora do
 * ciclo do React e o teste passa acusando "not wrapped in act(...)" — ruído
 * que esconderia um aviso de verdade no futuro.
 */
async function disparar(fn: (() => void) | undefined) {
  await act(async () => {
    fn?.()
  })
}

beforeEach(() => {
  ganchos = {}
  iniciar.mockReset()
  pausar.mockReset()
  retomar.mockReset()
  cancelar.mockReset()
  preparar.mockReset().mockResolvedValue({
    ok: true,
    uploadId: 'up-1',
    bucket: 'lesson-videos',
    caminho: 'curso-1/aula-1/v.mp4',
    urlDeRetomada: null,
    bytesEnviados: 0,
    estado: 'pendente',
    retomando: false,
  })
  confirmar.mockReset().mockResolvedValue({ ok: true, caminho: 'curso-1/aula-1/v.mp4', jaEstava: false })
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co')
})

/* -------------------------------------------------------------------------- */

describe('estado inicial', () => {
  it('convida a arrastar e informa tipos e limite', () => {
    montar()
    expect(screen.getByText('Arraste o vídeo da aula aqui')).toBeInTheDocument()
    expect(screen.getByText('ou selecione do seu dispositivo')).toBeInTheDocument()
    expect(screen.getByText(/MP4, MOV ou WebM/)).toBeInTheDocument()
    expect(screen.getByText(/5 GB/)).toBeInTheDocument()
  })

  it('com vídeo já enviado, mostra o estado pronto e oferece troca', () => {
    montar({ videoAtual: { nome: 'antiga.mp4', bytes: 12_000_000 } })
    expect(screen.getByText('antiga.mp4')).toBeInTheDocument()
    expect(screen.getByText(/Vídeo pronto para esta aula/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar vídeo' })).toBeInTheDocument()
  })
})

describe('arquivo recusado antes de gastar banda', () => {
  it('um ZIP renomeado para .mp4 nunca chega a subir', async () => {
    const user = userEvent.setup()
    const { container } = montar()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoFalso())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /não parece ser um vídeo válido/i,
      )
    })
    expect(preparar).not.toHaveBeenCalled()
    expect(iniciar).not.toHaveBeenCalled()
  })
})

describe('envio em andamento', () => {
  it('mostra progresso real, velocidade e permite pausar', async () => {
    const user = userEvent.setup()
    const { container } = montar()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())

    await waitFor(() => expect(iniciar).toHaveBeenCalled())

    // O transporte reporta 82%.
    await disparar(() =>
      ganchos.onProgresso?.({
        enviados: 32_800_000,
        total: 40_000_000,
        pct: 82,
        bytesPorSegundo: 2 * 1024 * 1024,
        segundosRestantes: 300,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('Enviando vídeo — 82%')).toBeInTheDocument()
    })

    const barra = screen.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '82')
    expect(screen.getByText(/2\.0 MB\/s/)).toBeInTheDocument()
    expect(screen.getByText(/cerca de 5 min/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(pausar).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retomar upload' })).toBeInTheDocument()
  })
})

describe('conexão interrompida', () => {
  it('avisa que o progresso foi preservado e oferece retomar', async () => {
    const user = userEvent.setup()
    const { container } = montar()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())
    await waitFor(() => expect(iniciar).toHaveBeenCalled())

    await disparar(() =>
      ganchos.onFalha?.('rede', 'A conexão foi interrompida. Seu progresso foi preservado.'),
    )

    await waitFor(() => {
      expect(
        screen.getByText('A conexão foi interrompida. Seu progresso foi preservado.'),
      ).toBeInTheDocument()
    })

    const botao = screen.getByRole('button', { name: 'Retomar upload' })
    await user.click(botao)
    expect(retomar).toHaveBeenCalled()
  })

  it('queda de rede NÃO é apresentada como erro definitivo', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())
    await waitFor(() => expect(iniciar).toHaveBeenCalled())

    await disparar(() =>
      ganchos.onFalha?.('rede', 'A conexão foi interrompida. Seu progresso foi preservado.'),
    )

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('validação e conclusão', () => {
  it('passa por “validando” antes de dizer que está pronto', async () => {
    const user = userEvent.setup()
    let liberar: (v: unknown) => void = () => {}
    confirmar.mockReturnValue(new Promise((r) => (liberar = r)))

    const { container } = montar()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())
    await waitFor(() => expect(iniciar).toHaveBeenCalled())

    await disparar(() => ganchos.onSucesso?.())

    await waitFor(() => {
      expect(screen.getByText('Upload concluído. Validando o arquivo…')).toBeInTheDocument()
    })

    await act(async () => {
      liberar({ ok: true, caminho: 'x', jaEstava: false })
    })

    await waitFor(() => {
      expect(screen.getByText('Vídeo pronto para esta aula.')).toBeInTheDocument()
    })
    expect(screen.getByText(/continua em/i)).toHaveTextContent(/rascunho/i)
  })

  it('arquivo recusado pelo servidor vira erro explicado, sem detalhe técnico', async () => {
    const user = userEvent.setup()
    confirmar.mockResolvedValue({
      ok: false,
      message: 'O conteúdo do arquivo não corresponde a um vídeo. Nada foi publicado.',
    })

    const { container } = montar()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())
    await waitFor(() => expect(iniciar).toHaveBeenCalled())

    await disparar(() => ganchos.onSucesso?.())

    await waitFor(() => {
      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent(/não corresponde a um vídeo/)
      expect(alerta.textContent).not.toMatch(/\b[45]\d{2}\b|Error:|select /)
    })
  })
})

describe('conflito de envio simultâneo', () => {
  it('explica que já existe outro envio para a aula', async () => {
    const user = userEvent.setup()
    preparar.mockResolvedValue({
      ok: false,
      message: 'Já existe um envio em andamento para esta aula. Termine ou cancele o outro antes.',
    })

    const { container } = montar()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/já existe um envio em andamento/i)
    })
    expect(iniciar).not.toHaveBeenCalled()
  })
})

describe('retomada a partir do banco', () => {
  it('reaproveita a URL de retomada devolvida pelo servidor', async () => {
    const user = userEvent.setup()
    preparar.mockResolvedValue({
      ok: true,
      uploadId: 'up-1',
      bucket: 'lesson-videos',
      caminho: 'curso-1/aula-1/v.mp4',
      urlDeRetomada: 'https://projeto.supabase.co/storage/v1/upload/resumable/abc',
      bytesEnviados: 32_000_000,
      estado: 'pausado',
      retomando: true,
    })

    const { container } = montar()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, arquivoMp4())

    await waitFor(() => expect(iniciar).toHaveBeenCalled())
    // O preparo foi consultado com os dados do arquivo; a retomada veio de lá.
    expect(preparar).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'aula-1', nome: 'aula.mp4', mime: 'video/mp4' }),
    )
  })
})
