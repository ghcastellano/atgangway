#!/usr/bin/env node
/**
 * docs/curadoria.csv → docs/catalogo-santos.csv, pronto para importar.
 *
 * A curadoria carrega o CUSTO em real; o preço de venda em dólar sai
 * daqui. Separado de propósito: preço é a única coluna do catálogo que
 * muda por decisão de negócio e não por dado do produto, e ela estava
 * ad-hoc — Pilão de 1 kg a 1,4x o varejo ao lado de chá gelado a 8x, sem
 * ninguém ter decidido nenhum dos dois. Com o custo na planilha e a
 * margem numa constante, corrigir um número corrige a loja inteira, e dá
 * para conferir a margem de qualquer item sem abrir uma calculadora.
 *
 *   node scripts/montar-catalogo.mjs [multiplicador] [cambio]
 *
 * Padrão: 4,5x sobre o custo no Brasil, PTAX do dia da última carga.
 * O câmbio aqui NÃO é o do checkout: aquele é ao vivo, do Banco Central
 * (lib/fx.ts), e serve para a referência em real de quem paga por PIX.
 * Este é o que congela a tabela de preço — tabela que muda sozinha todo
 * dia é tabela que ninguém consegue conferir.
 */

import { readFileSync, writeFileSync } from "node:fs";

/** Quanto o preço de bordo é sobre o custo no Brasil. */
const MULTIPLICADOR = Number(process.argv[2] ?? 4.5);
/** PTAX de venda em 26/08/2026. Refaça a carga quando andar de verdade. */
const USD_BRL = Number(process.argv[3] ?? 5.16);

/**
 * Marca vem do acervo como o voluntário digitou: "MELITTA", "3
 * CORACOES", "colgate". Na vitrine a marca é o menor texto do card, em
 * caixa alta com entreletra — e "MELITTA" ali vira uma fileira de
 * letras larga que rouba a atenção do nome do produto.
 */
const MARCAS = {
  "3 CORACOES": "3 Corações", "3 Corações": "3 Corações",
  MELITTA: "Melitta", NESCAFE: "Nescafé", "MATTE LEAO": "Leão",
  "LEAO FUZE": "Leão", "Leão Fuze": "Leão", Nescau: "Nescau",
  "COCA-COLA": "Coca-Cola", "COCA COLA": "Coca-Cola",
  "COCA COLA MENOS AÇÚCAR": "Coca-Cola", SPRITE: "Sprite", FANTA: "Fanta",
  PORTINARI: "Sprite", ANTARCTICA: "Antarctica", PEPSI: "Pepsi",
  GATORADE: "Gatorade", "Do bem": "Do Bem", "Monster Energy": "Monster",
  HERSHEYS: "Hershey's", "Hershey's": "Hershey's", GAROTO: "Garoto",
  Baton: "Garoto", AMARGO: "Lacta", LACTA: "Lacta", BIS: "Lacta",
  SUFLAIR: "Nestlé", CLASSIC: "Nestlé", NESTLE: "Nestlé", LOLO: "Nestlé",
  "ELMA CHIPS": "Elma Chips", DORITOS: "Doritos", PRINGLES: "Pringles",
  LAYS: "Lay's", YOKI: "Yoki", Dori: "Dori", AJINOMOTO: "Nissin",
  "TIO JOAO": "Tio João", "BROTO LEGAL": "Broto Legal",
  "PRATO FINO": "Prato Fino", CAMIL: "Camil", "LA PASTINA": "La Pastina",
  VITARELLA: "Vitarella", "Gomes da Costa": "Gomes da Costa",
  Colgate: "Colgate", colgate: "Colgate", nivea: "Nivea",
  "Nivea sun": "Nivea Sun", "Nivea Sun": "Nivea Sun",
};

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

/**
 * Preço redondo, arredondando para CIMA no meio dólar.
 *
 * Nada de 19,99: quem paga no portaló paga em nota, muitas vezes em
 * dinheiro, e troco de centavo numa prancha às três da manhã é atrito de
 * verdade — não é preferência de design. Para cima porque o meio dólar
 * que sobra cobre o câmbio andar entre a carga e a escala.
 */
function preco(custoBrl) {
  const bruto = (custoBrl * MULTIPLICADOR) / USD_BRL;
  return Math.max(1.5, Math.ceil(bruto * 2) / 2).toFixed(2);
}

const cur = lerCsv(readFileSync("docs/curadoria.csv", "utf-8"));
const campo = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const saida = [["sku", "name", "brand", "category", "price", "stock", "ean",
                "image_url", "short_description", "active"]];
const porCat = {};

for (const p of cur) {
  porCat[p.category] = (porCat[p.category] ?? 0) + 1;
  // O tamanho vai no FIM do nome porque é de lá que packSize() o tira
  // para a linha própria do card. Nome sem tamanho no fim perde a linha.
  const nome = p.size ? `${p.name} ${p.size}` : p.name;
  saida.push([
    p.sku, nome, MARCAS[p.brand] ?? p.brand, p.category, preco(Number(p.cost_brl)),
    0, p.ean, p.photo, "", "true",
  ]);
}

writeFileSync("docs/catalogo-santos.csv", saida.map((l) => l.map(campo).join(",")).join("\n") + "\n");

const margem = `${MULTIPLICADOR}x sobre o custo no Brasil, a USD/BRL ${USD_BRL}`;
console.error(`docs/catalogo-santos.csv — ${cur.length} produtos, ${margem}`);
for (const [c, n] of Object.entries(porCat).sort()) {
  const aviso = n < 10 ? "  ← abaixo de 10" : n > 15 ? "  ← acima de 15" : "";
  console.error(`  ${c.padEnd(16)} ${String(n).padStart(3)}${aviso}`);
}
const estrangeiras = cur.filter((p) => p.photo_ref).length;
if (estrangeiras) {
  console.error(`\n${estrangeiras} com foto de acervo estrangeiro (coluna photo_ref):`);
  console.error("o produto se compra no Brasil, a embalagem da foto é de outro");
  console.error("mercado. São as primeiras a trocar quando a foto do fornecedor chegar.");
}
