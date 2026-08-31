#!/usr/bin/env node
/**
 * Baixa os candidatos e monta uma folha de contato por categoria.
 *
 * É o passo que o filtro automático não conseguiu substituir. Tentei
 * detectar pack shot medindo a borda da imagem; contra 55 fotos que eu
 * já tinha classificado no olho, acertou 40%, e o motivo está escrito em
 * lib/fotoqualidade.ts — as fotos BOAS são recortadas justas, então a
 * borda medida é o próprio produto.
 *
 * O que resta é olhar. Uma folha com cem miniaturas numeradas, e dois
 * minutos de olho separam pack shot de foto de gôndola sem errar. O
 * script existe para tornar isso barato, não para automatizar o juízo.
 *
 * Aplica só o corte que se mede sem ambiguidade — resolução — e a
 * normalização, para as miniaturas saírem comparáveis entre si: foto
 * escura ao lado de foto clara engana o olho tanto quanto o algoritmo.
 *
 *   node scripts/folha-de-contato.mjs candidatos.csv /tmp/folhas
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import sharp from "sharp";
import { avaliarFoto } from "../lib/fotoqualidade.ts";
import { normalizarFoto } from "../lib/fotonormaliza.ts";

const CSV = process.argv[2];
const SAIDA = process.argv[3] ?? "/tmp/folhas";
if (!CSV) {
  console.error("uso: folha-de-contato.mjs <candidatos.csv> [pasta]");
  process.exit(1);
}

/** Miniatura de 190px: cabe oito por linha e ainda dá para julgar. */
const MINI = 190;
const COLUNAS = 8;
/** Teto por categoria — mais que isso a folha vira parede. */
const TETO = 96;

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
  const [cab, ...resto] = linhas.filter((l) => l.some((v) => v !== ""));
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k.trim(), (l[i] ?? "").trim()])));
}

const cands = lerCsv(readFileSync(CSV, "utf-8"));
mkdirSync(SAIDA, { recursive: true });
mkdirSync(`${SAIDA}/cache`, { recursive: true });

const porLoja = new Map();
for (const c of cands) {
  if (!porLoja.has(c.loja)) porLoja.set(c.loja, []);
  porLoja.get(c.loja).push(c);
}

for (const [loja, itens] of porLoja) {
  const bons = [];
  for (const it of itens) {
    if (bons.length >= TETO) break;
    const cache = `${SAIDA}/cache/${it.ean}.jpg`;
    try {
      let bruto;
      if (existsSync(cache)) bruto = readFileSync(cache);
      else {
        const r = await fetch(it.foto, { headers: { "User-Agent": "VesselSupplier/1.0" } });
        if (!r.ok) continue;
        bruto = Buffer.from(await r.arrayBuffer());
        writeFileSync(cache, bruto);
        await new Promise((x) => setTimeout(x, 180));
      }
      const laudo = await avaliarFoto(bruto);
      if (!laudo.aprovada) continue;
      const n = await normalizarFoto(bruto);
      bons.push({ ...it, mini: await sharp(n.buffer).resize(MINI, MINI).toBuffer() });
    } catch {
      // Arquivo torto no acervo não derruba a colheita inteira.
    }
  }

  if (bons.length === 0) { console.log(`${loja}: nenhum candidato com foto utilizável`); continue; }

  const linhas = Math.ceil(bons.length / COLUNAS);
  const alt = MINI + 20;
  const folha = sharp({
    create: { width: COLUNAS * MINI, height: linhas * alt, channels: 3, background: "#ffffff" },
  });
  const composicao = bons.map((b, i) => ({
    input: b.mini,
    left: (i % COLUNAS) * MINI,
    top: Math.floor(i / COLUNAS) * alt,
  }));
  await folha.composite(composicao).png().toFile(`${SAIDA}/${loja}.png`);

  // O índice casa a posição na folha com o EAN — é por ele que a escolha
  // volta para o CSV.
  writeFileSync(
    `${SAIDA}/${loja}.txt`,
    bons.map((b, i) => `${String(i + 1).padStart(3)} ${b.ean} ${b.marca} — ${b.nome}`).join("\n")
  );
  console.log(`${loja}: ${bons.length} na folha (de ${itens.length} candidatos)`);
}
