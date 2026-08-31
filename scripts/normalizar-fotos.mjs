#!/usr/bin/env node
/**
 * Baixa as fotos da curadoria e grava TODAS no mesmo molde, em
 * public/produtos/.
 *
 * Por que em public/ e não no Storage: o Supabase Storage autoriza por
 * sessão de usuário — para subir foto é preciso estar logado como
 * admin, e o projeto não tem chave service_role de propósito. Isso
 * significa que a padronização das fotos dependeria de alguém abrir o
 * terminal com a senha na mão. Foto de catálogo inicial é BUILD, não
 * upload: fica no repositório, o Vercel serve pelo CDN, e o molde é
 * garantido por `npm run fotos` em vez de por disciplina humana.
 *
 * Foto de fornecedor que chegar depois continua indo pelo admin, para o
 * Storage — aquele é conteúdo que muda sem deploy.
 *
 *   node --experimental-strip-types scripts/normalizar-fotos.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { normalizarFoto } from "../lib/fotonormaliza.ts";
import { avaliarFoto } from "../lib/fotoqualidade.ts";

const CURADORIA = "docs/curadoria.csv";
const DESTINO = "public/produtos";
const CACHE = "/tmp/fotos-cache";

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

mkdirSync(DESTINO, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const itens = lerCsv(readFileSync(CURADORIA, "utf-8"));
let ok = 0, pulou = 0;
const reprovadas = [];

for (const it of itens) {
  if (!it.photo) { pulou++; continue; }
  const cache = `${CACHE}/${it.sku}.bin`;
  try {
    let bruto;
    if (existsSync(cache)) {
      bruto = readFileSync(cache);
    } else {
      const r = await fetch(it.photo, { headers: { "User-Agent": "VesselSupplier/1.0 (ahoy@marinerssupplyco.com)" } });
      if (!r.ok) { reprovadas.push(`${it.sku} HTTP ${r.status}`); continue; }
      bruto = Buffer.from(await r.arrayBuffer());
      writeFileSync(cache, bruto);
      await new Promise((x) => setTimeout(x, 150));
    }
    const laudo = await avaliarFoto(bruto);
    if (!laudo.aprovada) { reprovadas.push(`${it.sku} ${laudo.motivo}`); continue; }
    const foto = await normalizarFoto(bruto);
    writeFileSync(`${DESTINO}/${it.sku}.jpg`, foto.buffer);
    ok++;
  } catch (e) {
    reprovadas.push(`${it.sku} ${e.message}`);
  }
}

console.log(`${ok} foto(s) em ${DESTINO}/, ${pulou} sem origem`);
if (reprovadas.length) {
  console.log(`\n${reprovadas.length} reprovada(s):`);
  for (const r of reprovadas) console.log(`  ${r}`);
}
