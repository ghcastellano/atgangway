#!/usr/bin/env node
/**
 * Garimpa candidatos de primeira necessidade nos acervos abertos — e
 * já reprova quem não tem foto de estúdio, na hora da busca.
 *
 * A ordem importa e é o oposto da que o catálogo usou até aqui. Antes:
 * escolher o produto, depois procurar foto, depois descobrir que a foto
 * é de alguém segurando a embalagem no corredor do mercado. Agora a
 * foto é PRÉ-REQUISITO — um produto sem pack shot não entra na lista de
 * candidatos, porque a tripulação não pode pegar o produto na mão e a
 * foto é tudo o que ela tem para decidir.
 *
 * A régua é a mesma de melhor-foto.mjs, aplicada às imagens ORIGINAIS
 * (não às já recortadas): quatro cantos claros (>=240) e parecidos
 * entre si (<12 de diferença). Ela funciona aqui porque a original
 * ainda tem fundo de verdade nas bordas.
 *
 * Só EAN brasileiro (prefixo GS1 789/790): o navio atraca em Santos e
 * quem compra é a nossa cadeia local. Produto europeu com foto linda
 * não adianta se ninguém aqui vende.
 *
 *   node --experimental-strip-types scripts/prospectar.mjs
 *
 * Sai um CSV em docs/prospeccao.csv no dialeto do importar-catalogo,
 * com a coluna `cost` vazia — preço é decisão de quem compra, não do
 * script.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const UA = "AtGangway/1.0 (help@atgangway.com; ship chandler catalog)";
const CACHE = "/tmp/prospeccao";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* O que a tripulação precisa ao atracar, por prateleira. Os termos são
   de busca livre porque as TAGS de categoria da Open Beauty Facts para
   o Brasil estão vazias (0 lâminas, 0 escovas de dente, 0 sabão em pó
   medidos em 01/09) — mas o produto pode existir sem estar etiquetado. */
const BUSCAS = [
  // barbear — o item que mais falta em contrato de 6 meses
  { q: "gillette", prateleira: "personal-care", base: "beauty" },
  { q: "prestobarba", prateleira: "personal-care", base: "beauty" },
  { q: "barbear", prateleira: "personal-care", base: "beauty" },
  { q: "bic aparelho", prateleira: "personal-care", base: "beauty" },
  // higiene bucal
  { q: "escova dental", prateleira: "personal-care", base: "beauty" },
  { q: "oral-b", prateleira: "personal-care", base: "beauty" },
  { q: "colgate", prateleira: "personal-care", base: "beauty" },
  { q: "enxaguante bucal", prateleira: "personal-care", base: "beauty" },
  // cabelo e corpo
  { q: "shampoo", prateleira: "personal-care", base: "beauty" },
  { q: "condicionador", prateleira: "personal-care", base: "beauty" },
  { q: "sabonete", prateleira: "personal-care", base: "beauty" },
  { q: "desodorante", prateleira: "personal-care", base: "beauty" },
  // lavanderia — roupa de trabalho suja a bordo
  { q: "sabao em po", prateleira: "personal-care", base: "food" },
  { q: "omo", prateleira: "personal-care", base: "food" },
  // sol e mosquito: convés equatorial e dengue
  { q: "repelente", prateleira: "sun-protection", base: "beauty" },
  { q: "protetor solar", prateleira: "sun-protection", base: "beauty" },
];

async function busca(termo, base) {
  const host = base === "beauty" ? "world.openbeautyfacts.org" : "world.openfoodfacts.org";
  const url =
    `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(termo)}` +
    `&search_simple=1&action=process&json=1&page_size=60` +
    `&fields=code,product_name,brands,quantity,images`;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 429) { await espera(6000 * (t + 1)); continue; }
      if (!r.ok) return { erro: `HTTP ${r.status}`, host, itens: [] };
      const d = await r.json();
      return { host, itens: d.products ?? [] };
    } catch (e) {
      await espera(2000);
    }
  }
  return { erro: "sem resposta", host, itens: [] };
}

function urlBruta(host, ean, n) {
  const cdn = host.includes("beauty") ? "images.openbeautyfacts.org" : "images.openfoodfacts.org";
  const c = ean.length === 13
    ? `${ean.slice(0, 3)}/${ean.slice(3, 6)}/${ean.slice(6, 9)}/${ean.slice(9)}`
    : ean;
  return `https://${cdn}/images/products/${c}/${n}.jpg`;
}

async function cantoMedio(buf, w, h, left, top, lado) {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .extract({ left, top, width: lado, height: lado }).raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) { s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  return s / n;
}

async function ehPackShot(buf) {
  const m = await sharp(buf, { failOn: "none" }).metadata();
  const w = m.width ?? 0, h = m.height ?? 0;
  if (w < 500 && h < 500) return { ok: false, w, h, motivo: "pequena" };
  const lado = Math.max(12, Math.round(Math.min(w, h) * 0.1));
  const cs = await Promise.all([
    cantoMedio(buf, w, h, 0, 0, lado),
    cantoMedio(buf, w, h, w - lado, 0, lado),
    cantoMedio(buf, w, h, 0, h - lado, lado),
    cantoMedio(buf, w, h, w - lado, h - lado, lado),
  ]);
  const min = Math.min(...cs), spread = Math.max(...cs) - min;
  return { ok: min >= 240 && spread < 12, w, h, min: Math.round(min), spread: Math.round(spread) };
}

async function baixa(url, chave) {
  const arq = `${CACHE}/${chave}`;
  if (existsSync(arq)) return readFileSync(arq);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    writeFileSync(arq, b);
    await espera(200);
    return b;
  } catch { return null; }
}

mkdirSync(CACHE, { recursive: true });

const aprovados = new Map();
const resumo = [];

for (const { q, prateleira, base } of BUSCAS) {
  const { host, itens, erro } = await busca(q, base);
  let brasileiros = 0, comFoto = 0, passaram = 0;

  for (const p of itens) {
    const ean = String(p.code ?? "");
    if (!/^(789|790)\d{10}$/.test(ean)) continue;
    brasileiros++;
    if (aprovados.has(ean)) continue;
    const nums = Object.keys(p.images ?? {}).filter((k) => /^\d+$/.test(k));
    if (!nums.length) continue;
    comFoto++;

    for (const n of nums.slice(0, 5)) {
      const buf = await baixa(urlBruta(host, ean, n), `${ean}-${n}.bin`);
      if (!buf) continue;
      let laudo;
      try { laudo = await ehPackShot(buf); } catch { continue; }
      if (laudo.ok) {
        aprovados.set(ean, {
          ean, nome: (p.product_name ?? "").trim(), marca: (p.brands ?? "").split(",")[0].trim(),
          tamanho: (p.quantity ?? "").trim(), prateleira, foto: urlBruta(host, ean, n),
          w: laudo.w, h: laudo.h, termo: q,
        });
        passaram++;
        break;
      }
    }
  }
  resumo.push(`${q.padEnd(18)} ${erro ?? ""} achados=${itens.length} BR=${brasileiros} c/foto=${comFoto} PASSARAM=${passaram}`);
  console.log(resumo.at(-1));
  await espera(6500); // a busca da OFF é limitada a ~10/min
}

const linhas = [...aprovados.values()].sort((a, b) => a.prateleira.localeCompare(b.prateleira) || a.nome.localeCompare(b.nome));
const csv = [
  "sku,name,brand,size,category,cost,photo,px",
  ...linhas.map((l) =>
    [`EAN-${l.ean}`, l.nome, l.marca, l.tamanho, l.prateleira, "", l.foto, `${l.w}x${l.h}`]
      .map((v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v))
      .join(",")
  ),
].join("\n");

mkdirSync("docs", { recursive: true });
writeFileSync("docs/prospeccao.csv", csv + "\n");
console.log(`\n${linhas.length} candidato(s) com pack shot em docs/prospeccao.csv`);
