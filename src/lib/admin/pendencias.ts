import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PENDÊNCIAS DE PUBLICAÇÃO
 *
 * Antes o painel mostrava "14 configurações vazias" e "20 fotos não
 * produzidas" como contadores soltos — números que não diziam o que fazer.
 *
 * Aqui cada pendência é um item acionável: o que falta, onde isso quebra,
 * qual a prioridade e o link que resolve.
 */

export type Prioridade = 'bloqueia' | 'importante' | 'quando_puder'

export type Pendencia = {
  id: string
  titulo: string
  descricao: string
  /** O que quebra enquanto isso não for resolvido. */
  afeta: string
  prioridade: Prioridade
  href: string
  acao: string
  responsavel?: string
}

export const PESO: Record<Prioridade, number> = {
  bloqueia: 0,
  importante: 1,
  quando_puder: 2,
}

export const ROTULO_PRIORIDADE: Record<Prioridade, { texto: string; tom: string }> = {
  bloqueia: { texto: 'Bloqueia a publicação', tom: 'erro' },
  importante: { texto: 'Importante', tom: 'atencao' },
  quando_puder: { texto: 'Quando puder', tom: 'ok' },
}

export async function listarPendencias(): Promise<Pendencia[]> {
  const db = createAdminClient()
  const pendencias: Pendencia[] = []

  const [ajustes, blocos, fotos, cursos, demo, ofertas, denuncias, mensagens] = await Promise.all([
    db.from('settings').select('key, label, group_key').is('value', null).eq('is_required', true),
    db
      .from('cms_sections')
      .select('id, block_type, missing_fields, page:cms_pages (key, name)')
      .not('missing_fields', 'eq', '{}'),
    db
      .from('image_slots')
      .select('key, name, group_key, purpose')
      .eq('status', 'pending')
      .eq('is_required', true),
    db.from('courses').select('id, name, status, is_demo'),
    db.rpc('demo_content_exists'),
    db.from('offers').select('id, name, slug, price_cents, status'),
    db.from('community_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'waiting']),
  ])

  // --- Bloqueia a publicação -------------------------------------------------

  if (demo.data) {
    pendencias.push({
      id: 'demo',
      titulo: 'Conteúdo de demonstração ainda no banco',
      descricao:
        'O curso de teste criado para validar a plataforma continua cadastrado. Ele existe só para exercitar as telas.',
      afeta: 'Todo o site — o risco é ele aparecer para uma visitante real.',
      prioridade: 'bloqueia',
      href: '/admin',
      acao: 'Remover conteúdo de teste',
    })
  }

  for (const ajuste of ajustes.data ?? []) {
    const critico = ['contact.whatsapp', 'legal.company_name', 'legal.privacy', 'legal.terms'].includes(
      ajuste.key,
    )
    pendencias.push({
      id: `ajuste:${ajuste.key}`,
      titulo: ajuste.label,
      /*
       * A DESCRIÇÃO FALA COM A RESPONSÁVEL, NÃO COM O PROGRAMADOR.
       *
       * Antes dizia: "A configuração `contact.whatsapp` está vazia." Quem lê
       * isso precisa saber o que é uma "configuração", decorar o nome interno
       * e adivinhar onde ele mora. O nome do campo já está no título logo
       * acima — a descrição só precisa dizer o que fazer.
       */
      descricao: "Ainda não foi preenchido. Clique em Preencher para informar agora.",
      afeta:
        ajuste.key === 'contact.whatsapp'
          ? 'Todo botão de WhatsApp some do site enquanto isso.'
          : ajuste.group_key === 'legal'
            ? 'A página legal correspondente mostra "documento não publicado".'
            : 'Blocos que dependem desta informação não vão ao ar.',
      prioridade: critico ? 'bloqueia' : 'importante',
      href: '/admin/ajustes',
      acao: 'Preencher',
    })
  }

  const semCurso = (cursos.data ?? []).filter((c) => c.status === 'published' && !c.is_demo)
  if (semCurso.length === 0) {
    pendencias.push({
      id: 'sem-curso',
      titulo: 'Nenhum curso publicado',
      descricao: 'Não existe curso real publicado no catálogo.',
      afeta: 'O catálogo e a vitrine da landing ficam ocultos. O diagnóstico cai no WhatsApp.',
      prioridade: 'bloqueia',
      href: '/admin/cursos',
      acao: 'Cadastrar curso',
    })
  }

  // --- Importante -------------------------------------------------------------

  for (const bloco of blocos.data ?? []) {
    const pagina = Array.isArray(bloco.page) ? bloco.page[0] : bloco.page
    const faltando = (bloco.missing_fields ?? []) as string[]
    pendencias.push({
      id: `bloco:${bloco.id}`,
      titulo: `Bloco "${bloco.block_type}" incompleto`,
      descricao: `Faltam os campos: ${faltando.join(', ')}.`,
      afeta: `A página "${pagina?.name ?? '—'}" não exibe este bloco.`,
      prioridade: 'importante',
      href: `/admin/paginas/${pagina?.key ?? ''}`,
      acao: 'Completar bloco',
    })
  }

  const semPreco = (ofertas.data ?? []).filter((o) => o.price_cents === null)
  for (const oferta of semPreco) {
    pendencias.push({
      id: `oferta:${oferta.id}`,
      titulo: `Oferta "${oferta.name}" sem preço`,
      descricao: 'O banco recusa publicar oferta sem valor definido.',
      afeta: 'O checkout desta oferta não abre e o botão de compra não aparece.',
      prioridade: 'importante',
      href: `/admin/ofertas/${oferta.id}`,
      acao: 'Definir preço',
    })
  }

  if ((denuncias.count ?? 0) > 0) {
    pendencias.push({
      id: 'denuncias',
      titulo: `${denuncias.count} denúncia(s) na comunidade`,
      descricao: 'Alunas sinalizaram publicações que precisam de análise.',
      afeta: 'Conteúdo denunciado continua visível até alguém avaliar.',
      prioridade: 'importante',
      href: '/admin/comunidade',
      acao: 'Analisar',
      responsavel: 'moderação',
    })
  }

  if ((mensagens.count ?? 0) > 0) {
    pendencias.push({
      id: 'mensagens',
      titulo: `${mensagens.count} conversa(s) em aberto`,
      descricao: 'Alunas aguardando resposta do suporte ou da instrutora.',
      afeta: 'Tempo de resposta ao aluno.',
      prioridade: 'importante',
      href: '/admin/mensagens',
      acao: 'Responder',
      responsavel: 'atendimento',
    })
  }

  // --- Quando puder ------------------------------------------------------------

  const porGrupo = new Map<string, { nomes: string[]; total: number }>()
  for (const foto of fotos.data ?? []) {
    const atual = porGrupo.get(foto.group_key) ?? { nomes: [], total: 0 }
    if (atual.nomes.length < 3) atual.nomes.push(foto.name)
    atual.total += 1
    porGrupo.set(foto.group_key, atual)
  }

  for (const [grupo, info] of porGrupo) {
    pendencias.push({
      id: `fotos:${grupo}`,
      titulo: `${info.total} foto(s) de "${grupo}" não produzidas`,
      descricao: info.nomes.join(' · ') + (info.total > 3 ? ` e mais ${info.total - 3}` : ''),
      afeta: 'As telas mostram um espaço reservado com as dimensões, em vez da imagem.',
      prioridade: 'quando_puder',
      href: '/admin/midia',
      acao: 'Ver a lista de produção',
      responsavel: 'ensaio fotográfico',
    })
  }

  return pendencias.sort((a, b) => PESO[a.prioridade] - PESO[b.prioridade])
}
