/**
 * A MARCA
 *
 * Nome e logo em um lugar só. Antes, "Escola de unhas" estava escrito à mão em
 * quatro arquivos — era assim que o site aparecia com um nome que não é o da
 * empresa.
 *
 * `site.name` no CMS continua vencendo: se a responsável escrever outro nome
 * lá, é ele que aparece. Estas constantes são o padrão de fábrica, não uma
 * trava.
 */

export const MARCA = {
  /** Nome completo, como deve aparecer em título de navegador e rodapé. */
  nome: "Katia Franck Nail's Studio",

  /**
   * O nome quebrado em duas linhas para a assinatura ao lado da logo. A logo
   * já traz o nome escrito no anel; repetir tudo em corpo grande ao lado dela
   * fica redundante, então a assinatura usa dois pesos.
   */
  assinatura: { principal: 'Katia Franck', apoio: "Nail's Studio" },

  /**
   * Logo oficial enviada pela responsável.
   *
   * O arquivo é um PNG quadrado com fundo branco. Não há versão recortada, e
   * inventar uma é arriscar sujar a borda — por isso o CSS recorta em círculo
   * (`border-radius: 50%`). O selo é um círculo centrado que não encosta na
   * borda do quadrado, então o recorte remove só os cantos brancos e não toca
   * no anel roxo. É o que permite usar a mesma imagem sobre fundo escuro.
   */
  logo: {
    src: '/marca/katia-franck-nails-studio.png',
    largura: 1232,
    altura: 1232,
    alt: "Katia Franck Nail's Studio",
  },
} as const
