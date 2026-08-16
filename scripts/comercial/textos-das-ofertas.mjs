/**
 * TEXTOS COMERCIAIS DAS TRÊS OFERTAS
 *
 * A responsável ditou a chamada e o rótulo de botão de cada plano. Eles
 * precisavam existir em UM lugar só — e esse lugar já é a tabela `offers`,
 * que a landing, a /planos e o checkout leem.
 *
 * A alternativa seria escrever as frases dentro do JSX. Aí o texto passaria a
 * viver em dois lugares: o do banco (que o checkout mostra) e o do código (que
 * a vitrine mostra). Divergir vira questão de tempo.
 *
 * O QUE ESTE SCRIPT MEXE: `headline` e `cta_label`. Só isso.
 *
 * O QUE ELE NÃO MEXE: preço, slug, status, produto, `offer_module_access`,
 * capítulos, RLS, nenhuma regra de acesso. Preço é conferido e o script ABORTA
 * se algum estiver diferente do combinado — mudar valor por acidente é o tipo
 * de erro que não pode acontecer em silêncio.
 *
 * É idempotente: rodar de novo não muda nada.
 *
 *   node scripts/comercial/textos-das-ofertas.mjs
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const linha of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !chave) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e a chave de serviço no .env.local.')
  process.exit(1)
}

/** Preço combinado, em centavos. Trava de segurança, não fonte de verdade. */
const TEXTOS = [
  {
    slug: 'iniciante',
    precoEsperado: 2990,
    headline: 'Para quem quer começar pelos fundamentos e ter acesso ao essencial.',
    cta_label: 'Escolher Iniciante',
  },
  {
    slug: 'profissional',
    precoEsperado: 3990,
    headline: 'Para quem quer ir além da base e ampliar o acesso às técnicas da formação.',
    cta_label: 'Escolher Profissional',
  },
  {
    slug: 'completo',
    precoEsperado: 5490,
    headline: 'Acesso completo a toda a formação disponível.',
    cta_label: 'Escolher Completo',
  },
]

const db = createClient(url, chave, { auth: { persistSession: false } })

let mudou = 0
let iguais = 0

for (const alvo of TEXTOS) {
  const { data: oferta, error } = await db
    .from('offers')
    .select('id, slug, name, price_cents, headline, cta_label')
    .eq('slug', alvo.slug)
    .maybeSingle()

  if (error) {
    console.error(`  ${alvo.slug}: erro ao ler —`, error.message)
    process.exit(1)
  }

  if (!oferta) {
    console.error(`  ${alvo.slug}: oferta não encontrada. Rode a migration 29 antes.`)
    process.exit(1)
  }

  // Trava: se o preço não é o combinado, alguma coisa está errada e este
  // script não é quem deve resolver.
  if (oferta.price_cents !== alvo.precoEsperado) {
    console.error(
      `  ${alvo.slug}: preço é ${oferta.price_cents}, esperado ${alvo.precoEsperado}. ABORTADO.`,
    )
    process.exit(1)
  }

  if (oferta.headline === alvo.headline && oferta.cta_label === alvo.cta_label) {
    console.log(`  ${alvo.slug}: já está como combinado`)
    iguais++
    continue
  }

  const { error: erroUpdate } = await db
    .from('offers')
    .update({ headline: alvo.headline, cta_label: alvo.cta_label })
    .eq('id', oferta.id)

  if (erroUpdate) {
    console.error(`  ${alvo.slug}: erro ao gravar —`, erroUpdate.message)
    process.exit(1)
  }

  console.log(`  ${alvo.slug}: atualizado`)
  console.log(`      antes: ${JSON.stringify(oferta.headline)} / ${JSON.stringify(oferta.cta_label)}`)
  console.log(`      agora: ${JSON.stringify(alvo.headline)} / ${JSON.stringify(alvo.cta_label)}`)
  mudou++
}

console.log(`\n  ${mudou} atualizada(s), ${iguais} já estava(m) certa(s).`)
console.log('  Preços conferidos e intactos: 2990 / 3990 / 5490.\n')
