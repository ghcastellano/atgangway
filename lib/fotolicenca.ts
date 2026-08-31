/**
 * De onde veio a foto, e sob qual licença.
 *
 * Existe porque a importação por URL gravava a imagem sem gravar o
 * crédito. CC BY-SA EXIGE crédito publicado e link para a licença — um
 * crédito que mora só no commit não cumpre a licença. Como a origem é
 * dedutível do host da imagem, o crédito sai de graça: quem cola uma URL
 * do Open Food Facts no admin já vira uma linha em /attributions.
 *
 * Função pura, sem rede e sem banco, para poder ser testada.
 */

export type FotoCredito = {
  license: string;
  attribution: string;
  sourceUrl: string;
  sourceTitle: string;
};

/**
 * Os três bancos abertos do projeto Open Food Facts. Mesma API, mesma
 * licença de imagem (CC BY-SA 3.0), acervos diferentes: comida, beleza
 * e o resto.
 */
const OPENFACTS: Record<string, { site: string; nome: string }> = {
  "images.openfoodfacts.org": { site: "https://world.openfoodfacts.org", nome: "Open Food Facts" },
  "images.openbeautyfacts.org": { site: "https://world.openbeautyfacts.org", nome: "Open Beauty Facts" },
  "images.openproductsfacts.org": { site: "https://world.openproductsfacts.org", nome: "Open Products Facts" },
};

/**
 * O caminho da imagem carrega o código de barras fatiado de três em
 * três: /images/products/789/608/901/1982/front_pt.3.full.jpg. Remontar
 * o EAN é o que permite apontar o crédito para a ficha do produto, e
 * não para a imagem solta.
 */
export function eanFromOpenFactsPath(pathname: string): string | null {
  const m = pathname.match(/\/images\/products\/([0-9/]+)\/[^/]+$/);
  if (!m) return null;
  const ean = m[1].replace(/\//g, "");
  return /^\d{8,14}$/.test(ean) ? ean : null;
}

/**
 * Crédito para uma URL de imagem, ou null quando a origem não é um
 * acervo aberto conhecido — foto do fornecedor não entra na página de
 * créditos, e não deve mesmo.
 */
export function creditoDaFoto(url: string): FotoCredito | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const acervo = OPENFACTS[u.hostname];
  if (!acervo) return null;

  const ean = eanFromOpenFactsPath(u.pathname);
  return {
    license: "CC BY-SA 3.0",
    attribution: `${acervo.nome} contributors · CC BY-SA 3.0`,
    sourceUrl: ean ? `${acervo.site}/product/${ean}` : acervo.site,
    sourceTitle: acervo.nome,
  };
}
