#!/usr/bin/env node
/**
 * Repovoa a coluna `photo` da curadoria com a foto oficial de cada
 * produto, buscada por CÓDIGO DE BARRAS na Open Food Facts / Open
 * Beauty Facts.
 *
 * Por que esta fonte, e não raspar o site do fabricante: OFF é a base
 * aberta que os apps de scanner de produto usam de fato — a foto vem
 * etiquetada como "frente da embalagem" por quem cadastrou, é
 * Creative Commons (uso comercial permitido COM atribuição, que a
 * página /attributions passa a dar), e a chave é o mesmo EAN que já
 * temos. Foto de fabricante é direito autoral; OFF é o caminho legal
 * e é o que o mercado usa.
 *
 * Este script só PREENCHE a planilha. Quem baixa, mede a resolução e
 * põe no molde de 1000px continua sendo o normalizar-fotos.mjs — o
 * portão de qualidade e o molde não mudam. Assim a origem troca sem
 * tocar no resto.
 *
 *   node scripts/colher-fotos-off.mjs
 *   node scripts/normalizar-fotos.mjs   # baixa e normaliza
 */

import { readFileSync, writeFileSync } from "node:fs";

const CURADORIA = "docs/curadoria.csv";
const UA = "VesselSupplier/1.0 (ahoy@marinerssupplyco.com; catalog product images)";
const FOOD = "world.openfoodfacts.org";
const BEAUTY = "world.openbeautyfacts.org";

/** CSV com aspas, no mesmo dialeto do normalizar-fotos.mjs. */
function lerCsv(texto) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((v) => v !== ""));
}

function celula(v) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function jsonOff(host, ean) {
  const url = `https://${host}/api/v2/product/${ean}.json?fields=code,image_front_url`;
  for (let tent = 0; tent < 3; tent++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429) { await espera(1500 * (tent + 1)); continue; }
    if (!r.ok) return null;
    const d = await r.json();
    return d.status === 1 ? d.product : null;
  }
  return null;
}

/** A foto oficial, em resolução cheia. OFF entrega a versão de exibição
 *  (.400.jpg); troco por .full.jpg, que é a original que o
 *  normalizar-fotos vai medir e cortar. */
async function fotoDe(ean, prefereBeauty) {
  const ordem = prefereBeauty ? [BEAUTY, FOOD] : [FOOD, BEAUTY];
  for (const host of ordem) {
    const p = await jsonOff(host, ean);
    await espera(300);
    const front = p?.image_front_url;
    if (front) {
      return {
        photo: front.replace(/\.\d+\.jpg$/, ".full.jpg"),
        ref: `https://${host}/product/${ean}`,
      };
    }
  }
  return null;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Categorias que moram na Open BEAUTY Facts — tenta lá primeiro.
const BEAUTY_HINT = /nivea|dove|rexona|colgate|sorriso|banana boat|desodor|deodor|shampoo|soap|sabonete|creme dental|toothpaste|sunscreen|protetor/i;

const linhas = lerCsv(readFileSync(CURADORIA, "utf-8"));
const cab = linhas[0];
const iEan = cab.indexOf("ean");
const iNome = cab.indexOf("name");
const iPhoto = cab.indexOf("photo");
const iRef = cab.indexOf("photo_ref");

let achou = 0, semEan = 0, semFoto = 0;
const faltando = [];

for (let n = 1; n < linhas.length; n++) {
  const row = linhas[n];
  const ean = (row[iEan] ?? "").trim();
  const nome = row[iNome] ?? "";
  if (!ean) { semEan++; continue; }

  const r = await fotoDe(ean, BEAUTY_HINT.test(nome));
  if (!r) { semFoto++; faltando.push(`${ean}  ${nome}`); continue; }
  row[iPhoto] = r.photo;
  row[iRef] = r.ref;
  achou++;
  process.stdout.write(`\r${achou} achadas, ${semFoto} sem foto  `);
}

writeFileSync(CURADORIA, linhas.map((l) => l.map(celula).join(",")).join("\n") + "\n");

console.log(`\n\n${achou} fotos da OFF/OBF na planilha`);
console.log(`${semEan} sem EAN (SIM cards — mantêm a arte atual)`);
if (faltando.length) {
  console.log(`\n${faltando.length} sem foto na OFF (revisar à mão):`);
  for (const f of faltando) console.log(`  ${f}`);
}
