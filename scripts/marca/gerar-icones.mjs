/**
 * ÍCONES DO NAVEGADOR A PARTIR DA LOGO REAL
 *
 * A logo enviada é um PNG quadrado de 1232px com o selo circular no meio e
 * uma faixa branca em volta. Usar o arquivo cru como favicon deixaria o selo
 * minúsculo no centro de um quadrado vazio — em 16px, ilegível.
 *
 * O QUE ESTE SCRIPT FAZ:
 *
 *   1. `trim()` corta a moldura branca até a borda do selo. É o passo que faz
 *      o desenho ocupar o ícone inteiro em vez de flutuar no meio dele.
 *   2. Redimensiona com `fit: contain` e fundo transparente, para o selo nunca
 *      esticar nem deformar.
 *   3. Grava nos caminhos que o App Router do Next reconhece sozinho:
 *      `src/app/icon.png` e `src/app/apple-icon.png`.
 *
 * Nenhum símbolo novo é inventado: tudo sai da logo que a responsável enviou.
 *
 *   node scripts/marca/gerar-icones.mjs
 */

import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ORIGEM = 'public/marca/katia-franck-nails-studio.png'

/*
 * `icon.png` e `apple-icon.png` são convenções do App Router: o Next os serve
 * e escreve as tags <link> sozinho. `public/marca/icone-*.png` servem para o
 * manifest e para qualquer uso avulso.
 */
const SAIDAS = [
  { arquivo: 'src/app/icon.png', lado: 512 },
  { arquivo: 'src/app/apple-icon.png', lado: 180 },
  { arquivo: 'public/marca/icone-16.png', lado: 16 },
  { arquivo: 'public/marca/icone-32.png', lado: 32 },
  { arquivo: 'public/marca/icone-48.png', lado: 48 },
  { arquivo: 'public/marca/icone-192.png', lado: 192 },
  { arquivo: 'public/marca/icone-512.png', lado: 512 },
]

await mkdir('public/marca', { recursive: true })

const original = sharp(ORIGEM)
const antes = await original.metadata()

/*
 * O corte é feito UMA vez e reaproveitado. `threshold` alto porque o fundo
 * não é branco puro (#fdfdfd): com o padrão, o trim não encostava no selo e
 * sobrava moldura.
 */
const recortado = await sharp(ORIGEM).trim({ threshold: 12 }).png().toBuffer()
const depois = await sharp(recortado).metadata()

console.log(`\n  Original: ${antes.width}×${antes.height}`)
console.log(`  Depois do corte da moldura: ${depois.width}×${depois.height}`)

for (const { arquivo, lado } of SAIDAS) {
  await sharp(recortado)
    .resize(lado, lado, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(arquivo)

  console.log(`  ${String(lado).padStart(3)}px  ${arquivo}`)
}

console.log('\n  Ícones gerados a partir da logo oficial.\n')
