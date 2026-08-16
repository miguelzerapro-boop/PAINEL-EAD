'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { getBrowserClient } from '@/lib/supabase/browser'

/**
 * Remove o pacote de demonstração inteiro.
 * Ação destrutiva: exige confirmação explícita antes de executar.
 */
export function BotaoRemoverDemo() {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'removendo' | 'erro'>('idle')

  async function remover() {
    setEstado('removendo')
    const { error } = await getBrowserClient().rpc('remove_demo_content')
    if (error) {
      setEstado('erro')
      return
    }
    router.refresh()
  }

  if (!confirmando) {
    return (
      <button className="botao botao--secundario" onClick={() => setConfirmando(true)}>
        Remover conteúdo de teste
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <p>
        Isso apaga <strong>permanentemente</strong> o curso, módulo, aula, material, atividade e
        avaliação de demonstração. Conteúdo real não é afetado.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="botao botao--primario" onClick={remover} disabled={estado === 'removendo'}>
          {estado === 'removendo' ? 'Removendo…' : 'Sim, remover'}
        </button>
        <button className="botao botao--discreto" onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
      </div>
      {estado === 'erro' ? (
        <p className="campo__erro" role="alert">
          Não foi possível remover. Confirme que você está logada como administradora.
        </p>
      ) : null}
    </div>
  )
}
