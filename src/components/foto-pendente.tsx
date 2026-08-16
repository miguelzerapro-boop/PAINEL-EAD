import Image from 'next/image'

/**
 * Placeholder honesto de imagem.
 *
 * Regra do escopo: enquanto nao existir ensaio fotografico proprio, o site NAO
 * preenche espaco com foto de banco. Este componente ocupa a vaga, informa as
 * dimensoes recomendadas e deixa claro que a foto ainda nao existe.
 *
 * Quando a vaga tiver `mediaPath`, a foto real e renderizada no lugar.
 */

const STORAGE_PUBLIC = '/storage/v1/object/public/media/'

type FotoSlot = {
  key: string
  name: string
  recommendedWidth?: number | null
  recommendedHeight?: number | null
  aspectRatio?: string | null
  /** Briefing de produção. Aparece só em modo de revisão (`?revisao=1`). */
  tipo?: string | null
  enquadramento?: string | null
  conteudo?: string | null
  luz?: string | null
}

export function Foto({
  slot,
  mediaPath,
  alt,
  priority = false,
  sizes = '100vw',
  revisao = false,
}: {
  slot: FotoSlot
  mediaPath?: string | null
  alt?: string | null
  priority?: boolean
  sizes?: string
  revisao?: boolean
}) {
  const ratio = slot.aspectRatio?.replace(':', ' / ') ?? '3 / 2'

  if (mediaPath) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    return (
      <Image
        src={`${base}${STORAGE_PUBLIC}${mediaPath}`}
        alt={alt ?? ''}
        width={slot.recommendedWidth ?? 1600}
        height={slot.recommendedHeight ?? 1067}
        sizes={sizes}
        priority={priority}
        style={{
          width: '100%',
          height: 'auto',
          aspectRatio: ratio,
          objectFit: 'cover',
          borderRadius: 'var(--radius-media)',
        }}
      />
    )
  }

  /*
   * Vaga de imagem. No site público NÃO pode parecer erro: é uma superfície
   * calma que segura a proporção e nomeia o que vai ali. O briefing de
   * produção só aparece em modo de revisão — quem visita não precisa dele.
   *
   * Continua valendo a regra do escopo: nada de foto de banco, nada de imagem
   * gerada por IA como aluna, instrutora ou resultado.
   */
  const briefing = [
    slot.tipo ? ['Tipo', slot.tipo] : null,
    slot.aspectRatio ? ['Proporção', slot.aspectRatio] : null,
    slot.recommendedWidth && slot.recommendedHeight
      ? ['Dimensão', `${slot.recommendedWidth} × ${slot.recommendedHeight} px`]
      : null,
    slot.enquadramento ? ['Enquadramento', slot.enquadramento] : null,
    slot.conteudo ? ['Conteúdo esperado', slot.conteudo] : null,
    slot.luz ? ['Luz', slot.luz] : null,
  ].filter((x): x is [string, string] => Boolean(x))

  return (
    <figure
      className="vaga-foto"
      style={{ ['--foto-ratio' as string]: ratio }}
      data-revisao={revisao ? '1' : undefined}
    >
      <div className="vaga-foto__area" aria-hidden="true">
        <span className="vaga-foto__marca" />
      </div>

      <figcaption className="vaga-foto__legenda">
        {slot.tipo ?? slot.name}
        {slot.aspectRatio ? <span className="vaga-foto__ratio mono">{slot.aspectRatio}</span> : null}
      </figcaption>

      {revisao && briefing.length > 0 ? (
        <dl className="vaga-foto__briefing">
          {briefing.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </figure>
  )
}
