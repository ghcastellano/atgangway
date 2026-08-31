#!/usr/bin/env node
/**
 * Colhe candidatos a produto, fundo, no acervo do Open Food Facts.
 *
 * A primeira versão puxava 4 a 8 por categoria e parava. Só que a busca
 * pagina, e o Brasil tem milhares de produtos lá — o catálogo saía magro
 * por limite meu, não por falta de acervo. Esta versão pagina fundo.
 *
 * Duas descobertas que mudam o desenho:
 *
 *   A busca devolve `image_front_url` direto no resultado. Antes eu
 *   fazia uma chamada por produto só para pegar a foto; agora vêm 25 por
 *   requisição, e a colheita fica cem vezes mais rápida.
 *
 *   A URL vem na variante `.400.jpg`. Trocar por `.full.jpg` dá o
 *   original, que é o que serve para o catálogo.
 *
 * Sai um CSV de CANDIDATOS, não de catálogo: a escolha final é visual.
 * Filtro automático de "isto é foto de produto?" foi tentado, medido
 * contra 55 fotos classificadas no olho, e acertou 40% — o motivo está
 * em lib/fotoqualidade.ts. Folha de contato e dois minutos de olho
 * resolvem melhor.
 *
 *   node scripts/colher-fotos.mjs > candidatos.csv
 */

const UA = "VesselSupplier/1.0 (ahoy@marinerssupplyco.com) - catalogo de bordo";
const BUSCA = "https://search.openfoodfacts.org/search";

/**
 * Categorias do acervo por categoria da loja. O que a tripulação de um
 * porta-contêiner compra: café, bebida, snack, comida de casa e higiene.
 */
const MAPA = [
  ["coffee-tea", ["coffees", "ground-coffees", "instant-coffees", "teas", "black-teas",
                  "chocolate-powders", "cappuccinos"]],
  ["soft-drinks", ["sodas", "colas", "waters", "mineral-waters", "energy-drinks",
                   "fruit-juices", "orange-juices", "iced-teas", "sports-drinks"]],
  // A primeira lista de snacks devolveu 343 candidatos e QUASE TODOS
  // biscoito: o acervo brasileiro é fundo em "biscuits" e raso nas
  // tags genéricas "chocolates"/"candies". Uma categoria de snack com
  // doze marcas de bolacha não é loja — tripulação compra barra de
  // chocolate, batata frita e castanha. As tags abaixo são as que de
  // fato têm produto brasileiro dentro.
  ["snacks", ["biscuits", "crackers", "wafers", "chocolates", "chocolate-bars",
              "milk-chocolates", "dark-chocolates", "filled-chocolates",
              "chocolate-candies", "bonbons", "chips-and-fries", "potato-crisps",
              "salty-snacks", "extruded-snacks", "popcorn", "candies",
              "gummy-candies", "chewing-gum", "peanuts", "nuts", "cashew-nuts",
              "roasted-peanuts", "cereal-bars", "bars"]],
  ["taste-of-home", ["instant-noodles", "rices", "soy-sauces", "hot-sauces", "canned-fishes",
                     "sardines", "tunas", "pastas", "instant-soups", "condiments"]],
  ["personal-care", ["deodorants", "toothpastes", "shampoos", "soaps", "shower-gels"]],
];

/** Quantas páginas por categoria do acervo. 25 por página. */
const PAGINAS = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
      if ((r.headers.get("content-type") ?? "").includes("json")) return await r.json();
    } catch {
      /* rede oscilando conta como tentativa */
    }
    await sleep(1200 * (i + 1));
  }
  return null;
}

/** `.400.jpg` é a miniatura; `.full.jpg` é o original. */
const original = (u) => u.replace(/\.(\d+)\.400\.jpg$/, ".$1.full.jpg");

const campo = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Nome que serve de vitrine — o acervo aceita o que o voluntário digitou. */
function nomeUtil(n) {
  const t = (n ?? "").trim();
  if (t.length < 8 || !/[a-zA-ZÀ-ÿ]{3}/.test(t)) return null;
  const pal = t.split(/\s+/).filter((p) => /[a-zA-ZÀ-ÿ]/.test(p));
  if (pal.length < 2) return null;
  // "BISC CEREALE CACAU 170G" — abreviação de etiqueta de gôndola.
  if (pal.filter((p) => p === p.toUpperCase() && p.length <= 4).length >= 2) return null;
  return t;
}

const vistos = new Set();
const linhas = [];

for (const [loja, categorias] of MAPA) {
  let achados = 0;
  for (const cat of categorias) {
    for (let pag = 1; pag <= PAGINAS; pag++) {
      const q = encodeURIComponent(`categories_tags:"en:${cat}" AND countries_tags:"en:brazil"`);
      const j = await json(
        `${BUSCA}?q=${q}&page=${pag}&page_size=25` +
          "&fields=code,product_name,brands,quantity,image_front_url"
      );
      await sleep(450);
      const hits = j?.hits ?? [];
      if (hits.length === 0) break;

      for (const h of hits) {
        const ean = String(h.code ?? "");
        if (!ean || vistos.has(ean)) continue;
        if (!h.image_front_url) continue;
        const nome = nomeUtil(h.product_name);
        if (!nome) continue;
        const marca = String(h.brands ?? "").split(",")[0].trim();
        if (!marca) continue;
        vistos.add(ean);
        achados++;
        linhas.push([ean, loja, cat, marca, nome, String(h.quantity ?? "").trim(),
                     original(h.image_front_url)]);
      }
    }
  }
  process.stderr.write(`${loja}: ${achados} candidatos\n`);
}

process.stdout.write("ean,loja,acervo,marca,nome,quantidade,foto\n");
for (const l of linhas) process.stdout.write(l.map(campo).join(",") + "\n");
process.stderr.write(`\ntotal ${linhas.length}\n`);
