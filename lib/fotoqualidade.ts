import sharp from "sharp";

/**
 * Tamanho mínimo de foto de produto.
 *
 * Este arquivo já foi maior. A ideia era detectar sozinho o que é foto
 * de produto e o que é foto de alguém segurando o produto no corredor do
 * mercado, medindo a borda: foto de estúdio teria moldura de fundo liso
 * e claro, foto de gôndola teria prateleira e dedo.
 *
 * A hipótese foi testada contra 55 fotos que eu já tinha classificado
 * olhando uma folha de contato. Concordou em 40%. O motivo é instrutivo
 * e vale ficar escrito para ninguém reconstruir a mesma coisa:
 *
 *   As fotos BOAS são recortadas justas — a embalagem preenche o
 *   quadro e não sobra borda. Então a "borda" que o teste media era o
 *   PRÓPRIO PRODUTO. Um pacote de Pilão, que é vermelho escuro, dava
 *   107 de 255 e era reprovado como "fundo escuro". Ao mesmo tempo,
 *   foto de gôndola com parede clara ao fundo passava.
 *
 *   O sinal está invertido justamente nos melhores casos.
 *
 * O que sobrou é o que se mede sem ambiguidade: resolução. Abaixo disto
 * o produto não sobrevive ao zoom da ficha, e isso independe de
 * enquadramento.
 *
 * Para separar pack shot de foto de corredor, o que funciona é olhar:
 * montar uma folha de contato com a leva inteira e cortar as ruins leva
 * dois minutos e não erra. É barato o bastante para não valer a pena
 * automatizar mal.
 */

export type Laudo = {
  aprovada: boolean;
  largura: number;
  altura: number;
  motivo: string | null;
};

/**
 * Medido no lado MAIOR e na área, nunca nos dois lados.
 *
 * Exigir 400px em largura E altura reprovava foto boa de garrafa:
 * 170×544 é um pack shot perfeito de garrafa alta e estreita. Produto
 * tem proporção, e exigir quadrado é exigir que a embalagem seja
 * quadrada.
 */
const MAIOR_MIN = 500;
const MENOR_MIN = 150;
const AREA_MIN = 85_000;

export async function avaliarFoto(entrada: Buffer | Uint8Array): Promise<Laudo> {
  const meta = await sharp(Buffer.from(entrada), { failOn: "none" }).metadata();
  const largura = meta.width ?? 0;
  const altura = meta.height ?? 0;

  const maior = Math.max(largura, altura);
  const menor = Math.min(largura, altura);
  if (maior < MAIOR_MIN || menor < MENOR_MIN || largura * altura < AREA_MIN) {
    return { aprovada: false, largura, altura, motivo: `pequena demais (${largura}×${altura})` };
  }
  return { aprovada: true, largura, altura, motivo: null };
}
