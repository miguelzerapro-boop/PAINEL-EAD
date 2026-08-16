import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { urlDeMidiaDaAula } from '@/lib/storage/assinado'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * ENTREGA DO VÍDEO DA AULA
 *
 * Conteúdo pago. O arquivo está em bucket privado e nunca tem URL pública
 * permanente — esta rota devolve um link assinado de 15 minutos, gerado na
 * hora e jamais gravado em lugar nenhum.
 *
 * A pergunta "essa pessoa pode assistir?" é feita ao BANCO, por
 * `lesson_is_released(lesson_id, user_id)`, dentro de `urlDeMidiaDaAula`. A
 * regra de liberação — matrícula ativa, prazo, turma, pré-requisito, aula
 * publicada, curso publicado — não é reimplementada aqui em TypeScript. Existe
 * uma fonte da verdade e ela é a função do banco.
 *
 * O caminho do arquivo também não vem do cliente: é lido do `media_assets`
 * ligado à aula. Conhecer o id de uma aula não dá acesso ao vídeo dela.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params

  // O caminho sai do banco, com a service role, DEPOIS de a permissão ser
  // checada abaixo — aqui só se descobre qual arquivo a aula aponta.
  const admin = createAdminClient()
  const { data: aula } = await admin
    .from('lessons')
    .select('id, video_asset_id, media_assets:video_asset_id (bucket, path)')
    .eq('id', lessonId)
    .maybeSingle()

  const midia = aula?.media_assets as { bucket?: string; path?: string } | null

  if (!aula || !midia?.path) {
    return NextResponse.json({ message: 'Esta aula ainda não tem vídeo.' }, { status: 404 })
  }

  if (midia.bucket !== 'lesson-videos') {
    return NextResponse.json({ message: 'Mídia inválida.' }, { status: 400 })
  }

  const resultado = await urlDeMidiaDaAula({
    lessonId,
    bucket: 'lesson-videos',
    caminho: midia.path,
  })

  if (!resultado.ok) {
    const status =
      resultado.motivo === 'sem_sessao' ? 401 : resultado.motivo === 'sem_permissao' ? 403 : 502

    return NextResponse.json({ message: mensagem(resultado.motivo) }, { status })
  }

  // 302 para o link assinado: o navegador passa a falar direto com o Storage e
  // o vídeo nunca atravessa o servidor Next.js.
  const resposta = NextResponse.redirect(resultado.url, 302)
  resposta.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return resposta
}

function mensagem(motivo: 'sem_sessao' | 'sem_permissao' | 'nao_encontrado' | 'falha') {
  switch (motivo) {
    case 'sem_sessao':
      return 'Entre na sua conta para assistir.'
    case 'sem_permissao':
      return 'Esta aula ainda não está liberada para você.'
    case 'nao_encontrado':
      return 'Esta aula ainda não tem vídeo.'
    default:
      return 'Não foi possível abrir o vídeo agora.'
  }
}
