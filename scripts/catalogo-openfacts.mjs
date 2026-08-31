#!/usr/bin/env node
/**
 * Monta a planilha do catálogo a partir dos acervos abertos Open Food /
 * Beauty / Products Facts, para ser subida na importação do admin.
 *
 * Por que existe: as fotos do catálogo hoje são ilustrativas — o café
 * mostra um pacote holandês de museu. Para entrar em produção a foto tem
 * de ser a do produto que o navio recebe, e a única forma confiável de
 * casar foto com produto é pelo CÓDIGO DE BARRAS. Busca por nome erra:
 * "amendoim dori" devolveu pasta de amendoim, "sabonete dove" devolveu
 * Huggies. Busca por marca e casamento por EAN não erram.
 *
 * Dois modos:
 *
 *   node scripts/catalogo-openfacts.mjs eans 7896089011982 789...
 *     O modo de produção. Os EANs saem da NF-e do fornecedor — o XML
 *     traz o cEAN de cada item, então a nota fiscal já É a lista.
 *
 *   node scripts/catalogo-openfacts.mjs marcas
 *     Descobre os produtos brasileiros das marcas listadas em MARCAS,
 *     para levantar um catálogo inicial sem ter a nota em mãos.
 *
 * A saída é CSV no formato que app/admin/catalog/import já aceita, em
 * stdout. O preço sai zerado de propósito: preço é decisão de negócio,
 * não de script. Preencha a coluna price antes de subir.
 *
 *   node scripts/catalogo-openfacts.mjs marcas > catalogo.csv
 */

const UA = "VesselSupplier/1.0 (ahoy@marinerssupplyco.com) - catalogo de bordo";

/** Os três acervos, em ordem de tentativa. Mesma API, acervos diferentes. */
const ACERVOS = [
  { tag: "off", api: "https://world.openfoodfacts.org", img: "https://images.openfoodfacts.org" },
  { tag: "obf", api: "https://world.openbeautyfacts.org", img: "https://images.openbeautyfacts.org" },
  { tag: "opf", api: "https://world.openproductsfacts.org", img: "https://images.openproductsfacts.org" },
];

/**
 * Marcas que um distribuidor de Santos entrega. TODAS brasileiras ou
 * importadas e vendidas aqui — o chandler compra no Brasil, e produto
 * que só existe no exterior não entra no estoque por mais que a
 * tripulação queira.
 *
 * Isso custou uma rodada: a versão anterior buscava Indomie, Lucky Me e
 * Nongshim pelo código do país de origem. São de fato o que a tripulação
 * filipina e indonésia procura, mas o acervo registra ZERO Indomie
 * vendido no Brasil. Comida asiática aqui vem por importador nacional —
 * Sakura, Hikari, Ajinomoto — e é essa a que dá para entregar.
 */
const MARCAS = [
  // Café e chá
  { marca: "pilao", categoria: "coffee-tea" },
  { marca: "melitta", categoria: "coffee-tea" },
  { marca: "3 coracoes", categoria: "coffee-tea" },
  { marca: "nescafe", categoria: "coffee-tea" },
  { marca: "leao", categoria: "coffee-tea" },
  { marca: "nescau", categoria: "coffee-tea" },

  // Bebida
  { marca: "guarana antarctica", categoria: "soft-drinks" },
  { marca: "coca-cola", categoria: "soft-drinks" },
  { marca: "do bem", categoria: "soft-drinks" },
  { marca: "gatorade", categoria: "soft-drinks" },
  { marca: "red bull", categoria: "soft-drinks" },
  { marca: "monster", categoria: "soft-drinks" },

  // Snack
  { marca: "bauducco", categoria: "snacks" },
  { marca: "dori", categoria: "snacks" },
  { marca: "elma chips", categoria: "snacks" },
  { marca: "garoto", categoria: "snacks" },
  { marca: "lacta", categoria: "snacks" },
  { marca: "nestle", categoria: "snacks" },
  { marca: "yoki", categoria: "snacks" },

  // Taste of home — o que o importador nacional traz
  { marca: "sakura", categoria: "taste-of-home" },
  { marca: "hikari", categoria: "taste-of-home" },
  { marca: "ajinomoto", categoria: "taste-of-home" },
  { marca: "nissin", categoria: "taste-of-home" },
  { marca: "gomes da costa", categoria: "taste-of-home" },
  { marca: "coqueiro", categoria: "taste-of-home" },
  { marca: "tio joao", categoria: "taste-of-home" },
  { marca: "camil", categoria: "taste-of-home" },

  // Higiene e sol. O slop chest vende pasta de dente, escova, xampu,
  // desodorante e lâmina — é a lista clássica, e o convés a 30 graus
  // faz do protetor solar item de primeira necessidade, não de luxo.
  { marca: "dove", categoria: "personal-care" },
  { marca: "rexona", categoria: "personal-care" },
  { marca: "colgate", categoria: "personal-care" },
  { marca: "nivea", categoria: "personal-care" },
  { marca: "gillette", categoria: "personal-care" },
  { marca: "protex", categoria: "personal-care" },
  { marca: "palmolive", categoria: "personal-care" },
  { marca: "seda", categoria: "personal-care" },
  { marca: "pantene", categoria: "personal-care" },
  { marca: "head shoulders", categoria: "personal-care" },
  { marca: "close up", categoria: "personal-care" },
  { marca: "sorriso", categoria: "personal-care" },
  { marca: "oral-b", categoria: "personal-care" },
  { marca: "lux", categoria: "personal-care" },
  { marca: "johnson", categoria: "personal-care" },
  { marca: "sundown", categoria: "sun-protection" },
  { marca: "nivea sun", categoria: "sun-protection" },
  { marca: "banana boat", categoria: "sun-protection" },
  { marca: "australian gold", categoria: "sun-protection" },
  { marca: "neutrogena", categoria: "sun-protection" },
  { marca: "cenoura bronze", categoria: "sun-protection" },
  { marca: "episol", categoria: "sun-protection" },
];

/**
 * Descoberta por categoria, que acha o que a busca por marca não acha:
 * ninguém lembra do nome do importador de shoyu. Cada linha é uma
 * categoria do acervo, cruzada com "vendido no Brasil", e cai numa
 * categoria da loja.
 */
const CATEGORIAS = [
  // Café e chá
  { cat: "coffees", categoria: "coffee-tea", limite: 6 },
  { cat: "instant-coffees", categoria: "coffee-tea", limite: 5 },
  { cat: "teas", categoria: "coffee-tea", limite: 6 },
  { cat: "chocolate-powders", categoria: "coffee-tea", limite: 4 },

  // Bebida
  { cat: "sodas", categoria: "soft-drinks", limite: 8 },
  { cat: "waters", categoria: "soft-drinks", limite: 5 },
  { cat: "energy-drinks", categoria: "soft-drinks", limite: 5 },
  { cat: "fruit-juices", categoria: "soft-drinks", limite: 6 },
  { cat: "iced-teas", categoria: "soft-drinks", limite: 4 },

  // Snack
  { cat: "biscuits", categoria: "snacks", limite: 8 },
  { cat: "chocolates", categoria: "snacks", limite: 8 },
  { cat: "chips-and-fries", categoria: "snacks", limite: 6 },
  { cat: "candies", categoria: "snacks", limite: 5 },
  { cat: "peanuts", categoria: "snacks", limite: 4 },

  // Taste of home
  { cat: "instant-noodles", categoria: "taste-of-home", limite: 8 },
  { cat: "rices", categoria: "taste-of-home", limite: 6 },
  { cat: "soy-sauces", categoria: "taste-of-home", limite: 5 },
  { cat: "hot-sauces", categoria: "taste-of-home", limite: 5 },
  { cat: "canned-fishes", categoria: "taste-of-home", limite: 6 },
  { cat: "pastas", categoria: "taste-of-home", limite: 4 },
];

/**
 * Higiene e cosmético vivem no Open Beauty Facts, que tem busca por
 * categoria própria e filtro de país nativo. É de lá que sai o que a
 * loja precisa em personal-care e sun-protection — o Open Food Facts
 * não indexa sabonete nem protetor solar.
 */
const CATEGORIAS_BELEZA = [
  { cat: "deodorants", categoria: "personal-care", limite: 6 },
  { cat: "toothpastes", categoria: "personal-care", limite: 6 },
  { cat: "shampoos", categoria: "personal-care", limite: 6 },
  { cat: "soaps", categoria: "personal-care", limite: 6 },
  { cat: "shower-gels", categoria: "personal-care", limite: 4 },
  { cat: "shaving-creams", categoria: "personal-care", limite: 3 },
  { cat: "sunscreens", categoria: "sun-protection", limite: 8 },
  { cat: "sun-protection", categoria: "sun-protection", limite: 8 },
  { cat: "after-sun", categoria: "sun-protection", limite: 3 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET com repetição: o Open Food Facts devolve 503 em HTML quando aperta. */
async function json(url, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
      if ((r.headers.get("content-type") || "").includes("json")) return await r.json();
    } catch {
      /* rede oscilando conta como tentativa */
    }
    await sleep(1500 * (i + 1));
  }
  return null;
}

/**
 * EAN brasileiro. A faixa da GS1 Brasil é 789–790: sem esse filtro,
 * "pilao" traz também um Café Pilao com código dos Estados Unidos, que
 * é outro produto, com outra embalagem.
 */
const brasileiro = (ean) => /^7(89|90)\d{10}$/.test(ean);

/**
 * Vendido no Brasil. Duas evidências valem, e uma basta:
 *
 * - EAN da faixa GS1 Brasil, que só sai para quem registra produto aqui;
 * - o acervo listando `en:brazil` entre os países, que é como aparece o
 *   importado que tem distribuidor nacional — shoyu Sakura, Monster,
 *   Tabasco — e cujo código continua sendo o do país de origem.
 */
const vendidoNoBrasil = (ean, paises) =>
  brasileiro(ean) || (Array.isArray(paises) && paises.includes("en:brazil"));

/** Ficha completa de um EAN, no primeiro acervo que o conhecer. */
async function ficha(ean) {
  const campos =
    "code,product_name,product_name_pt,generic_name,brands,quantity,images,countries_tags";
  for (const a of ACERVOS) {
    const j = await json(`${a.api}/api/v2/product/${ean}.json?fields=${campos}`);
    await sleep(700);
    const p = j?.product;
    if (!p) continue;

    // Só a foto de frente serve de capa, e só num idioma que a gente
    // consiga ler para conferir. Sem foto, o produto não entra: entrar
    // sem foto é o problema que este script veio resolver.
    // O corte que importa: o chandler compra de distribuidor em Santos.
    // Produto que o acervo não registra como vendido aqui não entra, por
    // mais que a tripulação queira — não há como colocá-lo na lancha.
    if (!vendidoNoBrasil(ean, p.countries_tags)) continue;

    const idioma = ["pt", "en", "fr"].find((l) => p.images?.[`front_${l}`]);
    if (!idioma) continue;
    const rev = p.images[`front_${idioma}`].rev;
    const dir = ean.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, "$1/$2/$3/$4");
    const foto = `${a.img}/images/products/${dir}/front_${idioma}.${rev}.full.jpg`;

    // Confere que a imagem existe e não é miniatura: o acervo às vezes
    // guarda a revisão sem o arquivo grande.
    const h = await fetch(foto, { method: "HEAD", headers: { "User-Agent": UA } }).catch(() => null);
    const bytes = h?.ok ? Number(h.headers.get("content-length") || 0) : 0;
    if (bytes < 15000) continue;

    const nome = (p.product_name_pt || p.product_name || "").trim();
    if (!nome) continue;

    return {
      ean,
      nome,
      resumo: (p.generic_name || "").trim(),
      marca: (p.brands || "").split(",")[0].trim(),
      quantidade: (p.quantity || "").trim(),
      foto,
      bytes,
      acervo: a.tag,
    };
  }
  return null;
}

/**
 * EANs de uma marca. Dois caminhos, porque os acervos não são iguais.
 *
 * Comida e bebida: a busca dedicada não filtra por país, então o corte é
 * pelo prefixo do EAN — senão "pilao" traz junto um Café Pilao com
 * código dos Estados Unidos, que é outra embalagem.
 *
 * Higiene e cosmético: o Open Beauty Facts filtra por país nativamente, e
 * aí o prefixo ATRAPALHA — Nivea e Gillette vendidos no Brasil carregam
 * EAN alemão (4005…) legítimo. Quem corta é `countries_tags_en=brazil`.
 */
async function porMarca(marca, limite = 4) {
  // O filtro de país entra na própria consulta: pedir a marca e depois
  // descartar o que não é vendido aqui gastava as 25 vagas da página com
  // produto que nunca ia entrar.
  const q = encodeURIComponent(`brands:"${marca}" AND countries_tags:"en:brazil"`);
  const comida = await json(
    `https://search.openfoodfacts.org/search?q=${q}&page_size=25&fields=code,product_name,brands`
  );
  await sleep(700);
  const achados = (comida?.hits ?? []).map((h) => String(h.code)).filter((c) => /^\d{8,14}$/.test(c));
  if (achados.length >= limite) return achados.slice(0, limite);

  // Higiene e cosmético vivem no Open Beauty Facts, que filtra país
  // nativamente. Lá o EAN legítimo costuma ser alemão — Nivea e Gillette
  // vendidos aqui carregam código de origem — e quem corta é o país.
  const marcaTag = marca.replace(/\s+/g, "-").toLowerCase();
  const beleza = await json(
    "https://world.openbeautyfacts.org/api/v2/search" +
      `?brands_tags=${encodeURIComponent(marcaTag)}&countries_tags_en=brazil` +
      "&fields=code,product_name&page_size=25"
  );
  await sleep(700);
  for (const p of beleza?.products ?? []) {
    const c = String(p.code);
    if (c.length >= 8 && !achados.includes(c)) achados.push(c);
  }
  return achados.slice(0, limite);
}

/** EANs de uma categoria do acervo, restrita ao que se vende no Brasil. */
async function porCategoria(cat, limite = 6) {
  const q = encodeURIComponent(`categories_tags:"en:${cat}" AND countries_tags:"en:brazil"`);
  const j = await json(
    `https://search.openfoodfacts.org/search?q=${q}&page_size=40&fields=code,product_name`
  );
  await sleep(700);
  return (j?.hits ?? [])
    .filter((h) => (h.product_name ?? "").trim().length > 3)
    .map((h) => String(h.code))
    .filter((c) => /^\d{8,14}$/.test(c))
    .slice(0, limite);
}


/** EANs de uma categoria do Open Beauty Facts, vendidos no Brasil. */
async function porCategoriaBeleza(cat, limite = 6) {
  const j = await json(
    "https://world.openbeautyfacts.org/api/v2/search" +
      `?categories_tags_en=${encodeURIComponent(cat)}&countries_tags_en=brazil` +
      "&fields=code,product_name&page_size=40"
  );
  await sleep(700);
  return (j?.products ?? [])
    .filter((p) => (p.product_name ?? "").trim().length > 3)
    .map((p) => String(p.code))
    .filter((c) => /^\d{8,14}$/.test(c))
    .slice(0, limite);
}

/* ------------------------------------------------------------------ */

/**
 * O acervo guarda a marca como quem digitou escreveu: "PILAO", "melitta",
 * "GUARANA ANTARCTICA". Na vitrine isso vira grito e acento faltando, e o
 * filtro de marcas fica com "Do bem" e "DO BEM" como duas marcas.
 */
const MARCA_BONITA = {
  "3-coracoes": "3 Corações",
  "do-bem": "Do Bem",
  dori: "Dori",
  "elma-chips": "Elma Chips",
  "guarana-antarctica": "Guaraná Antarctica",
  leao: "Leão",
  melitta: "Melitta",
  nescau: "Nescau",
  nestle: "Nestlé",
  pilao: "Pilão",
};

const slugDaMarca = (v) =>
  v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Nome de exibição da marca: da tabela quando houver, Capitalizado quando não. */
export function marcaBonita(bruta) {
  const s = slugDaMarca(bruta);
  if (MARCA_BONITA[s]) return MARCA_BONITA[s];
  if (!/[a-z]/.test(bruta)) {
    // TUDO EM MAIÚSCULA vira Capitalizado; marca com maiúscula no meio
    // ("JBL", "NIVEA MEN") o autor escreveu de propósito.
    return bruta.toLowerCase().replace(/(^|\s|-)([a-z])/g, (_, a, b) => a + b.toUpperCase());
  }
  return bruta;
}

const campo = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CABECALHO = [
  "sku", "name", "brand", "category", "price", "stock",
  "ean", "image_url", "short_description", "active",
];

function linha(f, categoria) {
  // Nome com a gramatura: "Café Pilão" e "Café Pilão" de 250 e 500 g são
  // dois itens, e a tripulação escolhe pelo tamanho.
  const cru = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const repetida = f.quantidade && cru(f.nome).includes(cru(f.quantidade));
  const nome = f.quantidade && !repetida ? `${f.nome} ${f.quantidade}` : f.nome;
  return [
    `EAN-${f.ean}`, // SKU casado com o EAN: reimportar atualiza, não duplica
    nome,
    marcaBonita(f.marca),
    categoria,
    "0.00", // preço é decisão de negócio — preencher antes de subir
    "0",
    f.ean,
    f.foto,
    f.resumo,
    "false", // entra desativado: ninguém vende a preço zero por engano
  ].map(campo).join(",");
}

async function main() {
  const [modo, ...resto] = process.argv.slice(2);
  const erro = (m) => { process.stderr.write(m + "\n"); process.exit(1); };

  let alvos = [];
  if (modo === "eans") {
    const eans = resto.flatMap((a) => a.split(/[\s,;]+/)).filter(Boolean);
    if (!eans.length) erro("uso: catalogo-openfacts.mjs eans 7896089011982 [...]");
    alvos = eans.map((ean) => ({ ean, categoria: "" }));
  } else if (modo === "marcas") {
    for (const m of MARCAS) {
      const eans = await porMarca(m.marca);
      process.stderr.write(`${m.marca}: ${eans.length} código(s)\n`);
      alvos.push(...eans.map((ean) => ({ ean, categoria: m.categoria })));
    }
  } else if (modo === "categorias") {
    for (const c of CATEGORIAS) {
      const eans = await porCategoria(c.cat, c.limite);
      process.stderr.write(`${c.cat}: ${eans.length} código(s)\n`);
      alvos.push(...eans.map((ean) => ({ ean, categoria: c.categoria })));
    }
    for (const c of CATEGORIAS_BELEZA) {
      const eans = await porCategoriaBeleza(c.cat, c.limite);
      process.stderr.write(`${c.cat} (beleza): ${eans.length} código(s)\n`);
      alvos.push(...eans.map((ean) => ({ ean, categoria: c.categoria })));
    }
  } else {
    erro("uso: catalogo-openfacts.mjs [eans <lista> | marcas | categorias]");
  }

  // Um EAN pode aparecer em duas marcas parecidas.
  const vistos = new Set();
  process.stdout.write(CABECALHO.join(",") + "\n");
  let achados = 0;
  for (const alvo of alvos) {
    if (vistos.has(alvo.ean)) continue;
    vistos.add(alvo.ean);
    const f = await ficha(alvo.ean);
    if (!f) { process.stderr.write(`  ✗ ${alvo.ean} sem ficha ou sem foto\n`); continue; }
    process.stdout.write(linha(f, alvo.categoria) + "\n");
    process.stderr.write(`  ✓ ${alvo.ean} ${f.nome} (${Math.round(f.bytes / 1024)} kB)\n`);
    achados++;
  }
  process.stderr.write(`\n${achados} de ${vistos.size} com foto conferida.\n`);
}

await main();
