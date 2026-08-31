#!/usr/bin/env node
/**
 * Preenche a coluna `photo` da curadoria com a imagem oficial do
 * fabricante buscada por CÓDIGO DE BARRAS na Cosmos (Bluesoft) —
 * https://cosmos.bluesoft.com.br. É a camada PAGA, usada só para tapar
 * o buraco que a Open Food Facts (colher-fotos-off.mjs) deixa: EAN sem
 * foto, ou foto amadora que o portão de qualidade reprovou.
 *
 * Por que a Cosmos e não raspar site de fabricante: a imagem da Cosmos
 * vem do cadastro do fabricante/distribuidor, então costuma ser
 * packshot (fundo branco, sem mão), e o uso é licenciado pela própria
 * assinatura da API — raspar o site da marca é direito autoral alheio.
 *
 *   ─── A REGRA DE OURO: 1 CONSULTA POR EAN, NUNCA MAIS QUE ISSO ───
 *
 * A API é paga por cota de chamadas/dia. Então cada EAN é consultado no
 * MÁXIMO UMA VEZ NA VIDA. O resultado — deu imagem ou não — é gravado
 * em docs/cosmos-cache.json (o livro-razão) e a partir daí é SEMPRE
 * reusado dali. Re-rodar o script não reconsulta nada que já está no
 * livro-razão, inclusive os que voltaram vazios. O livro-razão é
 * versionado no git de propósito: é o que faz a garantia "nunca mais de
 * uma" sobreviver a outra máquina, outra sessão, outro dia.
 *
 * O livro-razão é gravado em disco DEPOIS DE CADA chamada, não só no
 * fim: chamada paga cujo resultado se perde num crash é dinheiro
 * jogado fora.
 *
 * Este script só PREENCHE a planilha e o livro-razão. Quem baixa, mede
 * a resolução, reprova foto ruim e põe no molde de 1000px continua
 * sendo o normalizar-fotos.mjs; quem GRAVA NO BANCO continua sendo o
 * importar-catalogo.mjs. A origem da foto troca sem tocar no resto.
 *
 * Fluxo completo depois de colher:
 *   node --experimental-strip-types scripts/normalizar-fotos.mjs
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *     node --experimental-strip-types scripts/importar-catalogo.mjs docs/curadoria.csv
 *
 * Uso:
 *   COSMOS_TOKEN=... node scripts/colher-fotos-cosmos.mjs [flags]
 *
 *   --seco         não consulta nada; só mostra quantos EANs consultaria
 *   --limite N     teto de consultas NOVAS nesta rodada (padrão: sem teto).
 *                  Use --limite 1 para provar com uma única chamada.
 *   --refoto       usa a imagem da Cosmos mesmo em quem já tem foto da OFF
 *                  (ainda assim: só 1 consulta por EAN na vida)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CURADORIA = "docs/curadoria.csv";
const LIVRO = "docs/cosmos-cache.json";
const API = "https://cosmos.bluesoft.com.br/api/gtins";
const UA = "VesselSupplier/1.0 (ahoy@marinerssupplyco.com; catalog product images)";

const SECO = process.argv.includes("--seco");
const REFOTO = process.argv.includes("--refoto");
const LIMITE = (() => {
  const i = process.argv.indexOf("--limite");
  if (i === -1) return Infinity;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 0 ? n : Infinity;
})();

/** Lê .env.local sem depender de `set -a` na frente do comando —
 *  mesmo padrão do importar-catalogo.mjs. */
function carregarEnv(arquivo = ".env.local") {
  try {
    for (const linha of readFileSync(arquivo, "utf-8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const valor = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = valor;
    }
  } catch {
    /* sem arquivo: a variável pode já vir do ambiente */
  }
}
carregarEnv();
const TOKEN = process.env.COSMOS_TOKEN;

/* ---- CSV: mesmo dialeto do colher-fotos-off.mjs (array de arrays) ---- */
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
const celula = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/* ---- Livro-razão: EAN -> tudo que a Cosmos já respondeu ---- */
function lerLivro() {
  try { return JSON.parse(readFileSync(LIVRO, "utf-8")); }
  catch { return {}; }
}
function gravarLivro(livro) {
  writeFileSync(LIVRO, JSON.stringify(livro, null, 2) + "\n");
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A ÚNICA consulta que este arquivo faz por EAN. Devolve o registro
 * que vai pro livro-razão: { ok, at, photo, ref, description, brand,
 * ncm, avgPrice }. `ok:false` também é gravado — é o que impede a
 * reconsulta de um EAN que a Cosmos não conhece.
 * Lança { rateLimited:true } no 429 para o laço parar na hora e
 * preservar a cota.
 */
async function consultarCosmos(ean) {
  const r = await fetch(`${API}/${ean}.json`, {
    headers: { "X-Cosmos-Token": TOKEN, "User-Agent": UA, "Content-Type": "application/json" },
  });
  if (r.status === 429) throw { rateLimited: true };
  const at = new Date().toISOString();
  if (r.status === 404) return { ok: false, at, motivo: "nao encontrado" };
  if (!r.ok) return { ok: false, at, motivo: `HTTP ${r.status}` };
  const d = await r.json();
  const thumb = d.thumbnail || d.avg_thumbnail || null;
  return {
    ok: Boolean(thumb),
    at,
    photo: thumb,
    ref: `https://cosmos.bluesoft.com.br/produtos/${ean}`,
    description: d.description ?? null,
    brand: d.brand?.name ?? null,
    ncm: d.ncm?.code ?? null,
    avgPrice: d.avg_price ?? null,
    motivo: thumb ? null : "sem imagem no cadastro",
  };
}

/* ------------------------------------------------------------------ */

const linhas = lerCsv(readFileSync(CURADORIA, "utf-8"));
const cab = linhas[0];
const iEan = cab.indexOf("ean");
const iNome = cab.indexOf("name");
const iPhoto = cab.indexOf("photo");
const iRef = cab.indexOf("photo_ref");
if (iEan === -1 || iPhoto === -1) {
  console.error("curadoria.csv sem coluna ean/photo — abortei sem tocar em nada");
  process.exit(1);
}

const livro = lerLivro();

let doCache = 0;   // preenchidos a partir do livro-razão (0 consultas)
let novas = 0;     // consultas novas feitas nesta rodada
let comImagem = 0; // consultas novas que trouxeram imagem
let semImagem = 0; // consultas novas sem imagem
let pulados = 0;   // já tinham foto e não é --refoto
let cortadoPorLimite = 0;

if (!SECO && !TOKEN) {
  console.error(
    "falta COSMOS_TOKEN (conta paga da Cosmos). Rode com --seco para ver\n" +
    "quantos EANs seriam consultados sem gastar cota."
  );
  process.exit(1);
}

/** Aplica um registro do livro-razão na linha do CSV, se ele tem
 *  imagem e a linha ainda não tem foto (ou é --refoto). */
function aplicar(row, reg) {
  if (!reg.ok || !reg.photo) return false;
  const jaTemFoto = Boolean((row[iPhoto] ?? "").trim());
  if (jaTemFoto && !REFOTO) return false;
  row[iPhoto] = reg.photo;
  if (iRef !== -1) row[iRef] = reg.ref;
  return true;
}

let rateLimited = false;

for (let n = 1; n < linhas.length && !rateLimited; n++) {
  const row = linhas[n];
  const ean = (row[iEan] ?? "").trim();
  const nome = row[iNome] ?? "";
  if (!ean) continue;

  // 1) Já está no livro-razão? Usa dali. NUNCA reconsulta.
  if (livro[ean]) {
    if (aplicar(row, livro[ean])) doCache++;
    continue;
  }

  // 2) Já tem foto (da OFF) e não é --refoto? Não gasta chamada paga.
  const jaTemFoto = Boolean((row[iPhoto] ?? "").trim());
  if (jaTemFoto && !REFOTO) { pulados++; continue; }

  // 3) EAN inédito e sem foto boa: candidato a consulta.
  if (novas >= LIMITE) { cortadoPorLimite++; continue; }
  if (SECO) { novas++; continue; }

  try {
    const reg = await consultarCosmos(ean);
    livro[ean] = reg;      // grava ANTES de qualquer coisa poder falhar
    gravarLivro(livro);    // persiste cada chamada paga na hora
    novas++;
    if (reg.ok) { comImagem++; aplicar(row, reg); }
    else semImagem++;
    process.stdout.write(`\r${novas} consulta(s), ${comImagem} com imagem  `);
    await espera(400);
  } catch (e) {
    if (e && e.rateLimited) {
      rateLimited = true;
      break;
    }
    throw e;
  }
}

if (!SECO) {
  writeFileSync(CURADORIA, linhas.map((l) => l.map(celula).join(",")).join("\n") + "\n");
}

console.log("\n");
if (SECO) {
  console.log(`[--seco] consultaria ${novas} EAN(s) novo(s) na Cosmos.`);
  console.log(`${doCache} sairiam do cache, ${pulados} já têm foto da OFF.`);
} else {
  console.log(`${comImagem} imagem(ns) nova(s) da Cosmos na planilha`);
  console.log(`${doCache} preenchidas do cache (0 consultas), ${pulados} já tinham foto`);
  console.log(`${novas} consulta(s) paga(s) nesta rodada (${semImagem} sem imagem no cadastro)`);
}
if (cortadoPorLimite) console.log(`${cortadoPorLimite} deixados para depois (--limite ${LIMITE})`);
if (rateLimited) {
  console.log("\n⚠ 429 da Cosmos: cota do dia esgotada. Parei para não insistir.");
  console.log("  O que já veio está salvo no livro-razão e na planilha. Rode de novo amanhã;");
  console.log("  o que já foi consultado NÃO será consultado outra vez.");
}
console.log("\nAgora: normalizar-fotos.mjs (baixa+reprova ruim+molde) e importar-catalogo.mjs (grava no banco).");
