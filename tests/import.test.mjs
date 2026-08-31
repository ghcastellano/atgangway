// Importação de catálogo. Os casos aqui são os do arquivo real que o
// fornecedor manda — que nunca é o CSV limpo do exemplo.
import { test } from "node:test";
import assert from "node:assert/strict";

const { parseCsv, parseCsvRows, sniffDelimiter, normalizeHeader } = await import("../lib/csv.ts");
const { normalizeRow, buildImportPlan, diffAgainstExisting, slugifyValue } =
  await import("../lib/import.ts");

test("vírgula dentro de campo entre aspas não divide a coluna", () => {
  const m = parseCsv('sku,name,price\nA1,"Cabo USB-C, 2 metros",15.90');
  assert.deepEqual(m[1], ["A1", "Cabo USB-C, 2 metros", "15.90"]);
});

test("aspas escapadas por duplicação", () => {
  const m = parseCsv('sku,name\nA1,"Monitor 27"" 4K"');
  assert.equal(m[1][1], 'Monitor 27" 4K');
});

test("quebra de linha DENTRO do campo não vira registro novo", () => {
  const m = parseCsv('sku,description\nA1,"linha 1\nlinha 2"\nA2,simples');
  assert.equal(m.length, 3);
  assert.equal(m[1][1], "linha 1\nlinha 2");
  assert.equal(m[2][0], "A2");
});

test("CRLF do Excel do Windows", () => {
  const m = parseCsv("sku,name\r\nA1,Powerbank\r\nA2,Cabo\r\n");
  assert.equal(m.length, 3);
  assert.equal(m[1][1], "Powerbank");
});

test("BOM não gruda no primeiro cabeçalho", () => {
  const rows = parseCsvRows("﻿sku,name,price\nA1,Cabo,10");
  assert.equal(rows[0].sku, "A1", "BOM quebrou a coluna sku");
});

test("Excel brasileiro salva com ponto e vírgula", () => {
  assert.equal(sniffDelimiter("sku;nome;preco"), ";");
  assert.equal(sniffDelimiter("sku,name,price"), ",");
  const rows = parseCsvRows("sku;nome;preco\nA1;Cabo;10,50");
  assert.equal(rows[0].nome, "Cabo");
});

test("cabeçalho com acento e espaço vira chave utilizável", () => {
  assert.equal(normalizeHeader("  Preço de Venda "), "preco_de_venda");
  assert.equal(normalizeHeader("SKU"), "sku");
  assert.equal(normalizeHeader("Código de Barras"), "codigo_de_barras");
});

test("linha em branco no meio do arquivo é ignorada", () => {
  const rows = parseCsvRows("sku,name\nA1,Cabo\n\nA2,Fone\n");
  assert.equal(rows.length, 2);
});

test("aceita cabeçalho em português ou inglês", () => {
  const pt = normalizeRow({ codigo: "A1", produto: "Cabo", preco: "15,90", estoque: "40" }, 2);
  const en = normalizeRow({ sku: "A1", name: "Cabo", price: "15.90", stock: "40" }, 2);
  assert.equal(pt.product.priceCents, 1590);
  assert.equal(en.product.priceCents, 1590);
  assert.equal(pt.product.stockQty, 40);
});

test("linha sem SKU, nome ou preço não entra", () => {
  for (const row of [
    { name: "Cabo", price: "10" },
    { sku: "A1", price: "10" },
    { sku: "A1", name: "Cabo" },
    { sku: "A1", name: "Cabo", price: "abc" },
  ]) {
    const r = normalizeRow(row, 5);
    assert.equal(r.product, null, JSON.stringify(row));
    assert.ok(r.issues.length > 0);
    assert.equal(r.issues[0].line, 5, "a linha do erro tem que ser localizável");
  }
});

test("preço anterior menor que o atual é descartado, não trava a linha", () => {
  const r = normalizeRow({ sku: "A1", name: "Cabo", price: "20", compare_at: "15" }, 3);
  assert.ok(r.product, "produto deveria entrar mesmo assim");
  assert.equal(r.product.compareAtCents, null);
  assert.ok(r.issues.some((i) => i.field === "compare_at"));
});

test("preço anterior válido vira desconto", () => {
  const r = normalizeRow({ sku: "A1", name: "Cabo", price: "15", preco_anterior: "20" }, 3);
  assert.equal(r.product.compareAtCents, 2000);
  assert.equal(r.product.priceCents, 1500);
});

test("imagem só entra se for https", () => {
  const ok = normalizeRow({ sku: "A", name: "X", price: "1", image: "https://cdn/x.jpg" }, 2);
  const bad = normalizeRow({ sku: "A", name: "X", price: "1", image: "http://cdn/x.jpg" }, 2);
  const file = normalizeRow({ sku: "A", name: "X", price: "1", image: "file:///etc/passwd" }, 2);
  assert.equal(ok.product.imageUrl, "https://cdn/x.jpg");
  assert.equal(bad.product.imageUrl, null);
  assert.equal(file.product.imageUrl, null);
  assert.ok(bad.issues.some((i) => i.field === "image"));
});

test("specs aceita separador de barra, ponto e vírgula ou quebra", () => {
  const r = normalizeRow(
    { sku: "A", name: "X", price: "1", specs: "Bluetooth 5.4 | GPS | AMOLED" }, 2);
  assert.deepEqual(r.product.specs, ["Bluetooth 5.4", "GPS", "AMOLED"]);
  const r2 = normalizeRow({ sku: "A", name: "X", price: "1", ficha: "a;b;c" }, 2);
  assert.deepEqual(r2.product.specs, ["a", "b", "c"]);
});

test("ativo aceita as palavras que aparecem em planilha de verdade", () => {
  const on = ["1", "sim", "TRUE", "ativo", "yes", ""];
  const off = ["0", "nao", "false", "inativo", "N"];
  for (const v of on)
    assert.equal(normalizeRow({ sku: "A", name: "X", price: "1", ativo: v }, 2).product.active, true, v);
  for (const v of off)
    assert.equal(normalizeRow({ sku: "A", name: "X", price: "1", ativo: v }, 2).product.active, false, v);
});

test("SKU repetido no mesmo arquivo: o último vence e é sinalizado", () => {
  const plan = buildImportPlan([
    { sku: "A1", name: "Cabo v1", price: "10" },
    { sku: "A1", name: "Cabo v2", price: "12" },
    { sku: "B2", name: "Fone", price: "30" },
  ]);
  assert.equal(plan.valid.length, 2);
  assert.equal(plan.valid.find((p) => p.sku === "A1").name, "Cabo v2");
  assert.deepEqual(plan.duplicates, ["A1"]);
});

test("importar o mesmo arquivo duas vezes não cria nada de novo", () => {
  const plan = buildImportPlan([
    { sku: "A1", name: "Cabo", price: "10", stock: "5" },
    { sku: "B2", name: "Fone", price: "30", stock: "2" },
  ]);
  const existing = new Map([
    ["A1", { name: "Cabo", price_cents: 1000, stock_qty: 5 }],
    ["B2", { name: "Fone", price_cents: 3000, stock_qty: 2 }],
  ]);
  const diff = diffAgainstExisting(plan.valid, existing);
  assert.equal(diff.create.length, 0, "reimportação não pode duplicar");
  assert.equal(diff.update.length, 0);
  assert.equal(diff.unchanged.length, 2);
});

test("mudança de preço aparece como atualização, não como criação", () => {
  const plan = buildImportPlan([{ sku: "A1", name: "Cabo", price: "12", stock: "5" }]);
  const diff = diffAgainstExisting(
    plan.valid,
    new Map([["A1", { name: "Cabo", price_cents: 1000, stock_qty: 5 }]])
  );
  assert.equal(diff.update.length, 1);
  assert.equal(diff.create.length, 0);
});

test("SKU é normalizado para maiúscula — 'a1' e 'A1' são o mesmo item", () => {
  const plan = buildImportPlan([
    { sku: "a1", name: "Cabo", price: "10" },
    { sku: "A1", name: "Cabo", price: "10" },
  ]);
  assert.equal(plan.valid.length, 1);
});

test("categoria com acento vira slug", () => {
  assert.equal(slugifyValue("Eletrônicos & Áudio"), "eletronicos-audio");
  const r = normalizeRow({ sku: "A", name: "X", price: "1", categoria: "Food & Drinks" }, 2);
  assert.equal(r.product.categorySlug, "food-drinks");
});

test("arquivo real do fornecedor: tudo junto", () => {
  const csv = [
    "﻿SKU;Produto;Marca;Categoria;Preço;Preço Anterior;Estoque;Ficha;Imagem;Ativo",
    'A1;"Fone Marshall Minor IV";Marshall;Eletrônicos;64,90;105,00;12;"Bluetooth 5.3|30h de bateria";https://cdn/x.jpg;sim',
    'B2;"Cabo USB-C, 2m";Xtorm;Eletrônicos;15,90;;40;;;sim',
    ";;;;;;;;;",
    'C3;"Powerbank 20.000";Xtorm;Eletrônicos;abc;;5;;;sim',
  ].join("\r\n");

  const plan = buildImportPlan(parseCsvRows(csv));
  assert.equal(plan.valid.length, 2, "duas linhas boas");
  const fone = plan.valid.find((p) => p.sku === "A1");
  assert.equal(fone.priceCents, 6490);
  assert.equal(fone.compareAtCents, 10500);
  assert.equal(fone.brand, "Marshall");
  assert.equal(fone.categorySlug, "eletronicos");
  assert.deepEqual(fone.specs, ["Bluetooth 5.3", "30h de bateria"]);
  assert.equal(fone.stockQty, 12);
  const cabo = plan.valid.find((p) => p.sku === "B2");
  assert.equal(cabo.name, "Cabo USB-C, 2m");
  assert.equal(cabo.compareAtCents, null);
  assert.ok(plan.issues.some((i) => i.field === "price"), "linha C3 com preço inválido reportada");
});
