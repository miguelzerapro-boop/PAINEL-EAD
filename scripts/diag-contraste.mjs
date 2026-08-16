/** Contraste dos pares reais da nova paleta. */
const PARES = [
  ['texto principal / creme', '#241b1e', '#f6f0e7'],
  ['texto secundário / creme', '#6f6266', '#f6f0e7'],
  ['texto secundário / branco quente', '#6f6266', '#fffaf4'],
  ['título vinho profundo / creme', '#421328', '#f6f0e7'],
  ['título vinho / creme', '#6d1737', '#f6f0e7'],
  ['branco / botão coral sólido', '#fffaf4', '#bd3542'],
  ['branco / botão coral hover', '#fffaf4', '#a12b37'],
  ['coral texto / creme', '#bd3542', '#f6f0e7'],
  ['champagne / faixa escura', '#c69a59', '#281b20'],
  ['champagne / faixa de marca', '#c69a59', '#54132f'],
  ['texto claro / faixa de marca', '#fffaf4', '#54132f'],
  ['texto claro / faixa escura', '#fffaf4', '#281b20'],
  ['sucesso / fundo sucesso', '#1f5c43', '#e4efe9'],
  ['alerta / fundo alerta', '#7f520a', '#f8eeda'],
  ['erro / fundo erro', '#b3261e', '#fae7e4'],
]

const canal = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * (n & 255 ? canal(n & 255) : canal(0))
  )
}
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

let reprovas = 0
for (const [nome, frente, fundo] of PARES) {
  const c = contraste(frente, fundo)
  const ok = c >= 4.5
  if (!ok) reprovas++
  console.log(`${ok ? 'ok  ' : 'BAIXO'} ${c.toFixed(2)}:1  ${nome}`)
}
console.log(reprovas === 0 ? '\nTodos os pares passam em 4,5:1.' : `\n${reprovas} par(es) abaixo de 4,5:1.`)
