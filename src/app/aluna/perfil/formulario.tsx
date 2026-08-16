'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'

const UF = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

type Dados = {
  display_name: string
  full_name: string
  phone: string
  city: string
  state: string
  marketing_opt_in: boolean
}

/**
 * Edição do perfil.
 *
 * Escreve direto na tabela: a policy `profiles_update_own` limita à própria
 * linha, e o trigger `profiles_guard_role` impede mudança de papel. Não há
 * campo sensível a proteger além disso.
 */
export function FormularioPerfil({ inicial, email }: { inicial: Dados; email: string }) {
  const router = useRouter()
  const [dados, setDados] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    setMensagem(null)

    const db = getBrowserClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      setErro('Sua sessão expirou. Entre de novo.')
      setSalvando(false)
      return
    }

    const { error } = await db
      .from('profiles')
      .update({
        display_name: dados.display_name.trim() || null,
        full_name: dados.full_name.trim() || null,
        phone: dados.phone.trim() || null,
        city: dados.city.trim() || null,
        state: dados.state || null,
        marketing_opt_in: dados.marketing_opt_in,
      })
      .eq('id', user.id)

    setSalvando(false)

    if (error) {
      setErro('Não foi possível salvar agora. Tente de novo.')
      return
    }

    setMensagem('Perfil atualizado.')
    router.refresh()
  }

  return (
    <form className="cartao" onSubmit={salvar}>
      <p className="titulo-apoio">Seus dados</p>

      <div className="pilha pilha--junta" style={{ marginBlockStart: 'var(--space-4)' }}>
        <label className="campo">
          <span className="campo__rotulo">Nome de exibição</span>
          <input
            className="entrada"
            value={dados.display_name}
            onChange={(e) => setDados({ ...dados, display_name: e.target.value })}
          />
          <span className="campo__dica">É este nome que outras alunas veem na comunidade.</span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">Nome completo</span>
          <input
            className="entrada"
            value={dados.full_name}
            onChange={(e) => setDados({ ...dados, full_name: e.target.value })}
          />
          <span className="campo__dica">Usado no certificado. Não aparece na comunidade.</span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">E-mail</span>
          <input className="entrada" value={email} disabled />
          <span className="campo__dica">
            É a sua chave de acesso. Para trocar, fale com o suporte.
          </span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">WhatsApp</span>
          <input
            className="entrada"
            type="tel"
            inputMode="tel"
            value={dados.phone}
            onChange={(e) => setDados({ ...dados, phone: e.target.value })}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 6rem', gap: 'var(--space-3)' }}>
          <label className="campo">
            <span className="campo__rotulo">Cidade</span>
            <input
              className="entrada"
              value={dados.city}
              onChange={(e) => setDados({ ...dados, city: e.target.value })}
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">UF</span>
            <select
              className="entrada"
              value={dados.state}
              onChange={(e) => setDados({ ...dados, state: e.target.value })}
            >
              <option value="">—</option>
              {UF.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="consentimento">
          <input
            type="checkbox"
            checked={dados.marketing_opt_in}
            onChange={(e) => setDados({ ...dados, marketing_opt_in: e.target.checked })}
          />
          <span>Quero receber avisos sobre novos cursos e materiais.</span>
        </label>

        {erro ? (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        ) : null}
        {mensagem ? <p style={{ color: 'var(--success)' }}>{mensagem}</p> : null}

        <div>
          <button className="botao botao--primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </form>
  )
}
