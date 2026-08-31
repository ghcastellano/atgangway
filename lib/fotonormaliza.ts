import sharp from "sharp";

/**
 * Deixa toda foto do catálogo com a mesma cara.
 *
 * As fotos de acervo aberto são tiradas por voluntários: uma no chão de
 * cozinha, outra segurada na mão, outra sobre mesa escura, cada uma com
 * um enquadramento. Lado a lado na grade, isso lê como loja improvisada
 * — e a foto é o que vende, porque a tripulação não pode pegar o produto.
 *
 * Quatro passos, nesta ordem, e a ordem importa:
 *
 *   1. `trim` corta a moldura de cor uniforme que sobra em foto de
 *      estúdio. Vem antes de tudo para o produto passar a definir o
 *      enquadramento em vez do fundo.
 *   2. `flatten` sobre branco resolve PNG com transparência, que sem isso
 *      ganharia fundo preto ao virar JPEG.
 *   3. `contain` num quadrado com o mesmo branco: nenhum produto é
 *      cortado, e garrafa alta e lata baixa passam a ocupar a mesma
 *      caixa.
 *   4. `extend` acrescenta a folga. Produto colado na borda parece
 *      recorte apertado; a folga é o que faz parecer catálogo.
 *
 * Não tenta remover fundo colorido: fundo cinza de foto de gôndola
 * continua cinza. Recorte automático de fundo erra em embalagem clara e
 * come pedaço do produto — pior que fundo irregular.
 */

/** Lado do quadrado. 1000px cobre o zoom da ficha sem pesar na grade. */
export const LADO = 1000;

/** Folga interna, em fração do lado. 6% é o respiro de catálogo. */
const FOLGA = 0.06;

/** Branco puro: é o fundo de e-commerce, e o que a maioria das fotos já tem. */
const BRANCO = { r: 255, g: 255, b: 255, alpha: 1 };

export type FotoNormalizada = {
  buffer: Buffer;
  /** Sempre "image/jpeg" — o formato que todo navegador e e-mail abre. */
  contentType: string;
  largura: number;
  altura: number;
};

export async function normalizarFoto(entrada: Buffer | Uint8Array): Promise<FotoNormalizada> {
  const miolo = Math.round(LADO * (1 - FOLGA * 2));
  const borda = Math.round((LADO - miolo) / 2);

  const buffer = await sharp(Buffer.from(entrada), { failOn: "none" })
    // Tolerância alta: fundo de estúdio raramente é branco exato, e um
    // corte tímido deixa a moldura que o passo existe para tirar.
    .trim({ threshold: 12 })
    .flatten({ background: BRANCO })
    .resize(miolo, miolo, { fit: "contain", background: BRANCO, withoutEnlargement: false })
    .extend({ top: borda, bottom: borda, left: borda, right: borda, background: BRANCO })
    .jpeg({ quality: 86, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: "image/jpeg", largura: LADO, altura: LADO };
}
