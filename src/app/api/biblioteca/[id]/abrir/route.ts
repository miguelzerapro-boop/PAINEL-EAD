import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Abre um material da biblioteca.
 *
 * O arquivo mora em bucket PRIVADO. Esta rota:
 *   1. identifica quem pede pela sessão — nunca por id no corpo;
 *   2. pergunta ao banco se essa pessoa tem direito (`material_is_available`),
 *      que por sua vez depende de matrícula ativa;
 *   3. registra a leitura;
 *   4. só então assina uma URL de 10 minutos e redireciona.
 *
 * A URL assinada nunca é gravada no banco nem devolvida em HTML.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const baixar = new URL(request.url).searchParams.get('baixar') === '1'

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  const { data: permitido, error: erroPermissao } = await db.rpc('material_is_available', {
    p_material_id: id,
    p_user_id: user.id,
  })

  if (erroPermissao) {
    console.error('[biblioteca] falha ao checar acesso', erroPermissao.message)
    return NextResponse.json({ message: 'Não foi possível abrir o material.' }, { status: 500 })
  }

  if (!permitido) {
    return NextResponse.json(
      { message: 'Você não tem acesso a este material.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const { data: material } = await admin
    .from('library_materials')
    .select('file_path, download_allowed, title')
    .eq('id', id)
    .maybeSingle()

  if (!material?.file_path) {
    return NextResponse.json({ message: 'Material sem arquivo.' }, { status: 404 })
  }

  if (baixar && !material.download_allowed) {
    return NextResponse.json({ message: 'Este material é somente leitura.' }, { status: 403 })
  }

  // Registra a leitura antes de entregar — alimenta "continuar lendo".
  await admin
    .from('material_progress')
    .upsert(
      { user_id: user.id, material_id: id, opened_at: new Date().toISOString() },
      { onConflict: 'user_id,material_id' },
    )

  const { data: assinada, error } = await admin.storage
    .from('lesson-assets')
    .createSignedUrl(material.file_path, 600, baixar ? { download: material.title } : undefined)

  if (error || !assinada?.signedUrl) {
    console.error('[biblioteca] falha ao assinar', error?.message)
    return NextResponse.json({ message: 'Não foi possível abrir o material.' }, { status: 502 })
  }

  return NextResponse.redirect(assinada.signedUrl)
}
