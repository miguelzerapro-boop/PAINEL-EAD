'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Favoritar material.
 * Escreve direto na tabela — a RLS de `material_favorites` limita ao próprio
 * usuário, então não há rota de servidor a inventar aqui.
 */
export function BotaoFavorito({ materialId, inicial }: { materialId: string; inicial: boolean }) {
  const router = useRouter()
  const [favorito, setFavorito] = useState(inicial)
  const [pendente, iniciar] = useTransition()

  async function alternar() {
    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return

    const proximo = !favorito
    setFavorito(proximo) // otimista: o clique responde na hora

    const { error } = proximo
      ? await db.from('material_favorites').insert({ user_id: user.id, material_id: materialId })
      : await db
          .from('material_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('material_id', materialId)

    if (error) {
      setFavorito(!proximo) // desfaz se o banco recusou
      return
    }
    iniciar(() => router.refresh())
  }

  return (
    <button
      type="button"
      className="botao botao--secundario"
      onClick={alternar}
      disabled={pendente}
      aria-pressed={favorito}
    >
      {favorito ? '★ Favorito' : '☆ Favoritar'}
    </button>
  )
}
