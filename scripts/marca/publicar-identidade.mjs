/**
 * LEVA A IDENTIDADE QUE JÁ EXISTE PARA DENTRO DO CMS
 *
 * Duas pendências apareciam como "depende da cliente" sem depender:
 *
 *   · LOGOTIPO — a logo real já está em `public/marca/` e já é usada no
 *     cabeçalho, no rodapé e no favicon. Pedir upload de novo é pedir que a
 *     responsável envie um arquivo que o sistema já tem na mão.
 *
 *   · IMAGEM DE COMPARTILHAMENTO — dá para compor a partir da identidade que
 *     existe: logo, nome e as cores da marca. Não precisa de fotografia nova
 *     nem de nada que só a responsável saiba.
 *
 * O QUE ESTE SCRIPT NÃO FAZ: inventar. A imagem social leva a logo oficial, o
 * nome da empresa e o fundo da marca. Nenhuma promessa, número, depoimento ou
 * fotografia de pessoa entra nela.
 *
 * É idempotente: rodar de novo reaproveita o que já foi publicado.
 *
 *   node scripts/marca/publicar-identidade.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

for (const l of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const LOGO = 'public/marca/katia-franck-nails-studio.png'
const NOME = "Katia Franck Nail's Studio"
const BUCKET = 'cms-media'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/**
 * Sobe um arquivo e registra em `media_assets`, reaproveitando o registro se
 * o mesmo caminho já existir. Devolve o id do asset.
 */
async function publicar({ caminho, buffer, mime, alt, largura, altura }) {
  const { data: existente } = await db
    .from('media_assets')
    .select('id')
    .eq('bucket', BUCKET)
    .eq('path', caminho)
    .maybeSingle()

  const { error: erroUpload } = await db.storage
    .from(BUCKET)
    .upload(caminho, buffer, { contentType: mime, upsert: true })

  if (erroUpload) throw new Error(`upload de ${caminho}: ${erroUpload.message}`)

  if (existente) return existente.id

  const { data, error } = await db
    .from('media_assets')
    .insert({
      bucket: BUCKET,
      path: caminho,
      kind: 'image',
      mime_type: mime,
      byte_size: buffer.length,
      width: largura,
      height: altura,
      alt,
    })
    .select('id')
    .single()

  if (error) throw new Error(`registro de ${caminho}: ${error.message}`)
  return data.id
}

/** Grava a configuração só se ela ainda estiver vazia. */
async function definir(chave, valor, rotulo) {
  const { data: atual } = await db
    .from('settings')
    .select('key, value')
    .eq('key', chave)
    .maybeSingle()

  if (!atual) {
    console.log(`  ${rotulo}: a configuração ${chave} não existe nesta instalação`)
    return false
  }
  if (atual.value !== null) {
    console.log(`  ${rotulo}: já estava preenchido, mantido`)
    return false
  }

  const { error } = await db.from('settings').update({ value: valor }).eq('key', chave)
  if (error) {
    console.log(`  ${rotulo}: não foi possível gravar — ${error.message}`)
    return false
  }

  console.log(`  ${rotulo}: resolvido`)
  return true
}

console.log('\nIDENTIDADE NO CMS\n')

/* --- 1. A logo ------------------------------------------------------------ */

const logoBruta = await readFile(LOGO)
const logoMeta = await sharp(logoBruta).metadata()

const idDaLogo = await publicar({
  caminho: 'marca/logo-katia-franck-nails-studio.png',
  buffer: logoBruta,
  mime: 'image/png',
  alt: NOME,
  largura: logoMeta.width,
  altura: logoMeta.height,
})

console.log(`  Logo publicada no CMS (asset ${idDaLogo.slice(0, 8)}…)`)
await definir('site.logo_media_id', idDaLogo, 'Logotipo')

/* --- 2. A imagem de compartilhamento -------------------------------------- */

/*
 * 1200x630 é a proporção que WhatsApp, Facebook e LinkedIn recortam sem
 * cortar nada importante.
 *
 * O fundo é desenhado como SVG e o SELO é composto por cima como imagem —
 * texto em SVG depende da fonte instalada na máquina que roda o script, e o
 * selo da logo é justamente a parte que não pode sair errada.
 */
const L = 1200
const A = 630

const fundo = Buffer.from(`
<svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#170524"/>
      <stop offset="55%" stop-color="#260638"/>
      <stop offset="100%" stop-color="#3b075a"/>
    </linearGradient>
    <radialGradient id="luz" cx="78%" cy="18%" r="60%">
      <stop offset="0%" stop-color="#c026d3" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#c026d3" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${L}" height="${A}" fill="url(#base)"/>
  <rect width="${L}" height="${A}" fill="url(#luz)"/>

  <!-- Fio de neon na base: a mesma assinatura do cabeçalho do site. -->
  <rect x="0" y="${A - 6}" width="${L}" height="6" fill="#ee5bff" opacity="0.85"/>

  <text x="470" y="285" font-family="Georgia, 'Times New Roman', serif"
        font-size="72" font-weight="600" fill="#ffffff">Katia Franck</text>
  <text x="474" y="345" font-family="'Courier New', monospace"
        font-size="30" letter-spacing="8" fill="#e879f9">NAIL'S STUDIO</text>
  <text x="474" y="415" font-family="Georgia, 'Times New Roman', serif"
        font-size="30" fill="#d8cbe2">Formação em manicure e nail design</text>
</svg>
`)

/* O selo entra recortado em círculo, como no site. */
const seloRedondo = await sharp(await sharp(logoBruta).trim({ threshold: 12 }).toBuffer())
  .resize(300, 300, { fit: 'cover' })
  .composite([
    {
      input: Buffer.from(
        `<svg width="300" height="300"><circle cx="150" cy="150" r="150" fill="#fff"/></svg>`,
      ),
      blend: 'dest-in',
    },
  ])
  .png()
  .toBuffer()

const og = await sharp(fundo)
  .composite([{ input: seloRedondo, top: 165, left: 120 }])
  .png({ compressionLevel: 9 })
  .toBuffer()

// Cópia local só para conferência visual; a que vale é a do Storage.
await writeFile('public/marca/compartilhamento.png', og)

const idDaOg = await publicar({
  caminho: 'marca/compartilhamento.png',
  buffer: og,
  mime: 'image/png',
  alt: `${NOME} — formação em manicure e nail design`,
  largura: L,
  altura: A,
})

console.log(`  Imagem de compartilhamento gerada ${L}×${A} (asset ${idDaOg.slice(0, 8)}…)`)
await definir('seo.og_image_media_id', idDaOg, 'Imagem de compartilhamento')

/* --- 3. Quanto sobrou ----------------------------------------------------- */

const { data: restantes } = await db
  .from('settings')
  .select('key, label')
  .is('value', null)
  .eq('is_required', true)

console.log(`\n  Pendências que ainda dependem de uma pessoa: ${restantes?.length ?? 0}\n`)
for (const r of restantes ?? []) console.log(`    · ${r.label}`)
console.log('')
