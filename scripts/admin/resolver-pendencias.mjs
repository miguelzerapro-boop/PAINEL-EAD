/**
 * RESOLVE AS PENDÊNCIAS QUE JÁ SABEMOS RESPONDER
 *
 * O painel pedia 22 informações. Algumas delas o projeto JÁ tem — o nome da
 * marca, por exemplo, está definido em `src/lib/marca.ts` e estampado no
 * cabeçalho do site. Pedir de novo é fazer a responsável digitar o que o
 * sistema já sabe.
 *
 * A LINHA QUE ESTE SCRIPT NÃO CRUZA
 *
 * Só preenche o que é REAL ou derivável de algo real. Nunca inventa:
 * telefone, CNPJ, endereço, e-mail, texto jurídico, foto, preço, credencial.
 * Uma pendência a menos não vale um dado falso no ar — e texto jurídico
 * inventado é risco de verdade, não só de aparência.
 *
 * É idempotente e NÃO sobrescreve: se o campo já tem valor, passa direto.
 *
 *   node scripts/admin/resolver-pendencias.mjs
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const NOME = "Katia Franck Nail's Studio"

/** O que dá para preencher, e de onde a informação vem. */
const DERIVAVEIS = [
  {
    key: 'site.name',
    valor: NOME,
    origem: 'nome da empresa, informado pela responsável e já usado no cabeçalho do site',
  },
  {
    key: 'seo.default_title',
    valor: NOME,
    origem: 'mesmo nome da marca',
  },
  {
    key: 'seo.default_description',
    valor:
      'Formação em manicure e nail design com capítulos organizados por etapa. Comece pelo diagnóstico e escolha até onde quer evoluir.',
    origem: 'descrição já aprovada e usada na landing',
  },
]

/**
 * O que NÃO dá para preencher, e por quê. Vira o relatório do que ainda
 * depende de uma pessoa — que é justamente o que a responsável precisa saber.
 */
const DEPENDEM_DE_PESSOA = {
  'contact.whatsapp': 'só a responsável sabe o número de atendimento',
  'contact.email': 'só a responsável sabe o e-mail de contato',
  'legal.company_name': 'razão social é dado de registro da empresa',
  'legal.tax_id': 'CNPJ ou CPF é dado de registro',
  'legal.address': 'endereço é dado de registro',
  'legal.terms': 'texto jurídico — inventar termo de uso é risco real, não estético',
  'legal.privacy': 'texto jurídico — precisa refletir o que o site realmente coleta',
  'legal.refund': 'texto jurídico — define obrigação de reembolso',
  'legal.dpo_contact': 'a LGPD exige um contato humano responsável',
  'site.logo_media_id': 'a logo precisa ser enviada pelo painel para virar mídia do CMS',
  'seo.og_image_media_id': 'imagem de compartilhamento precisa ser produzida',
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

console.log('\nPENDÊNCIAS — o que dá para resolver sozinho\n')

let preenchidos = 0
let jaTinham = 0

for (const item of DERIVAVEIS) {
  const { data: atual } = await db
    .from('settings')
    .select('key, value')
    .eq('key', item.key)
    .maybeSingle()

  if (!atual) {
    console.log(`  ${item.key}: não existe nesta instalação, ignorado`)
    continue
  }

  // NÃO sobrescreve. Se a responsável já escreveu algo, é a palavra dela que
  // vale — mesmo que difira do que este script preencheria.
  if (atual.value !== null) {
    console.log(`  ${item.key}: já preenchido, mantido`)
    jaTinham++
    continue
  }

  const { error } = await db
    .from('settings')
    .update({ value: item.valor })
    .eq('key', item.key)

  if (error) {
    console.log(`  ${item.key}: não foi possível gravar — ${error.message}`)
    continue
  }

  console.log(`  ${item.key}: preenchido`)
  console.log(`      valor:  ${JSON.stringify(item.valor)}`)
  console.log(`      origem: ${item.origem}`)
  preenchidos++
}

/* --- O que sobra, e por quê ------------------------------------------------ */

const { data: restantes } = await db
  .from('settings')
  .select('key, label')
  .is('value', null)
  .eq('is_required', true)

console.log(`\n  Resolvido automaticamente: ${preenchidos} (e ${jaTinham} já estavam)`)
console.log(`\n  Ainda dependem de uma pessoa: ${restantes?.length ?? 0}\n`)

for (const r of restantes ?? []) {
  const motivo = DEPENDEM_DE_PESSOA[r.key] ?? 'informação que o sistema não tem como saber'
  console.log(`    · ${r.label} — ${motivo}`)
}

console.log('\n  Nenhum dado foi inventado.\n')
