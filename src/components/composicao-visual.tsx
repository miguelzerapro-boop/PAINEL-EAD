import Image from 'next/image'

/**
 * COMPOSIÇÃO VISUAL DA LANDING
 *
 * O site precisa mostrar o universo da manicure antes da primeira palavra ser
 * lida. Mas a regra do projeto continua valendo: NÃO se inventa pessoa, não se
 * apresenta rosto gerado como instrutora ou aluna, não se enche espaço com
 * banco de imagem passado por conteúdo próprio.
 *
 * A saída é esta: enquanto não houver ensaio fotográfico, a vaga é ocupada por
 * uma ARTE EDITORIAL declaradamente temporária — ilustração de unhas,
 * esmaltação e ferramenta, sem pessoa identificável. Quando a foto real
 * existir, ela entra pelo CMS e a arte sai. Sem tocar em código.
 *
 *   mediaPath preenchido  →  fotografia real
 *   mediaPath vazio       →  arte temporária de /public/arte
 *
 * O caminho da foto vem de `image_slots` / `media_assets`, como todo o resto
 * da mídia do projeto. Nenhuma URL de imagem é escrita no JSX das páginas.
 */

const STORAGE_PUBLIC = '/storage/v1/object/public/'

export type VagaVisual = {
  /** Chave em `image_slots`. É por aqui que a foto da responsável entra. */
  chave: string
  /**
   * Imagem TEMPORÁRIA de demonstração, caminho absoluto sob /public.
   *
   * Procedência: Unsplash (licença livre para uso comercial). Baixadas por
   * `node scripts/baixar-fotos-demo.mjs` e conferidas uma a uma — id de banco
   * de imagem não garante o assunto.
   *
   * NÃO são conteúdo da escola. Nenhuma delas mostra rosto, e nenhuma pode ser
   * apresentada como a instrutora, como aluna ou como resultado de trabalho da
   * escola. Existem só para a composição ser avaliada antes do ensaio próprio.
   */
  demo: string
  alt: string
  largura: number
  altura: number
}

export function ComposicaoVisual({
  vaga,
  mediaPath,
  mediaBucket = 'cms-media',
  alt,
  prioridade = false,
  sizes = '100vw',
  className,
}: {
  vaga: VagaVisual
  /** Caminho no Storage quando a foto real já existe. */
  mediaPath?: string | null
  mediaBucket?: string
  alt?: string | null
  prioridade?: boolean
  sizes?: string
  className?: string
}) {
  const temFotoReal = Boolean(mediaPath)

  const src = temFotoReal
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}${STORAGE_PUBLIC}${mediaBucket}/${mediaPath}`
    : vaga.demo

  return (
    <Image
      className={className}
      src={src}
      alt={alt ?? vaga.alt}
      width={vaga.largura}
      height={vaga.altura}
      sizes={sizes}
      priority={prioridade}
      /*
       * `data-temporaria` não muda a aparência: serve para a auditoria visual
       * e para o painel saberem, sem adivinhação, o que ainda é arte de
       * demonstração e o que já é foto da responsável.
       */
      data-temporaria={temFotoReal ? undefined : 'true'}
      data-vaga={vaga.chave}
    />
  )
}

/**
 * As vagas visuais da landing.
 *
 * Ficam aqui, e não espalhadas pelo JSX, para que a lista do que precisa ser
 * fotografado seja legível num lugar só — é ela que vira briefing de ensaio.
 */
export const VAGAS = {
  heroPrincipal: {
    chave: 'landing.hero',
    demo: '/fotos/demo/unhas-a.jpg',
    alt: 'Mão com as unhas esmaltadas em esmalte escuro brilhante',
    largura: 1600,
    altura: 2400,
  },
  detalheAcabamento: {
    chave: 'landing.acabamento',
    demo: '/fotos/demo/unhas-c.jpg',
    alt: 'Close das unhas prontas, mostrando o acabamento do esmalte',
    largura: 1600,
    altura: 1067,
  },
  bancada: {
    chave: 'landing.bancada',
    demo: '/fotos/demo/unhas-f.jpg',
    alt: 'Mão com unhas esmaltadas em tons claros sobre tricô',
    largura: 1600,
    altura: 1600,
  },
} satisfies Record<string, VagaVisual>
