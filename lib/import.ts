/**
 * Uma linha de CSV → um produto pronto para gravar.
 *
 * A regra que faz a importação ser usável: ela é IDEMPOTENTE por SKU.
 * Rodar o mesmo arquivo duas vezes atualiza, não duplica. Sem isso, a
 * primeira carga de dois mil itens vira faxina manual — e vai haver
 * uma segunda carga, porque a primeira sempre tem preço errado.
 *
 * Tudo aqui é puro: valida e normaliza, não grava. Assim o "dry run"
 * do painel — que mostra o que vai mudar antes de aplicar — usa
 * exatamente o mesmo código que a aplicação, e não uma aproximação.
 */

import { toCents } from "./money.ts";
import type { CsvRow } from "./csv.ts";

export type ImportProduct = {
  sku: string;
  name: string;
  brand: string | null;
  categorySlug: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number;
  shortDescription: string | null;
  description: string | null;
  specs: string[] | null;
  imageUrl: string | null;
  ean: string | null;
  /** Controla saldo? Falso por padrão: chandler compra contra o pedido. */
  trackStock: boolean;
  optionLabel: string | null;
  badge: "promo" | "new" | "outlet" | null;
  taxClass: "bonded" | "domestic" | "digital";
  active: boolean;
};

export type ImportIssue = { line: number; field: string; message: string };

export type ImportPlan = {
  valid: ImportProduct[];
  issues: ImportIssue[];
  /** SKUs repetidos dentro do próprio arquivo — o último vence. */
  duplicates: string[];
};

/** Aceita variações de cabeçalho que aparecem em planilha de fornecedor. */
const ALIASES: Record<keyof ImportProduct | "ignore", string[]> = {
  sku: ["sku", "codigo", "cod", "ref", "referencia", "item"],
  name: ["name", "nome", "produto", "descricao_curta", "title"],
  brand: ["brand", "marca", "fabricante"],
  categorySlug: ["category", "categoria", "cat", "category_slug"],
  priceCents: ["price", "preco", "preco_venda", "valor", "price_usd", "unit_price"],
  compareAtCents: ["compare_at", "preco_anterior", "de", "list_price", "was", "old_price"],
  stockQty: ["stock", "estoque", "qty", "quantidade", "saldo"],
  shortDescription: ["short_description", "resumo", "subtitulo", "subtitle"],
  description: ["description", "descricao", "detalhes", "long_description"],
  specs: ["specs", "especificacoes", "ficha", "bullets", "features"],
  imageUrl: ["image", "image_url", "imagem", "foto", "photo", "img"],
  ean: ["ean", "gtin", "barcode", "codigo_barras"],
  trackStock: ["track_stock", "controla_estoque", "estoque_controlado"],
  optionLabel: ["option", "variacao", "variante", "option_label"],
  badge: ["badge", "selo", "tag"],
  taxClass: ["tax_class", "regime", "fiscal"],
  active: ["active", "ativo", "status", "publicado"],
  ignore: [],
};

function pick(row: CsvRow, key: keyof ImportProduct): string {
  for (const alias of ALIASES[key]) {
    const v = row[alias];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

const TRUTHY = new Set(["1", "true", "yes", "y", "sim", "s", "ativo", "active", "published"]);
const FALSY = new Set(["0", "false", "no", "n", "nao", "não", "inativo", "inactive", "draft"]);

function parseBool(v: string, fallback = true): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return fallback;
  if (TRUTHY.has(s)) return true;
  if (FALSY.has(s)) return false;
  return fallback;
}

export function slugifyValue(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BADGES = new Set(["promo", "new", "outlet"]);
const TAX = new Set(["bonded", "domestic", "digital"]);

/** Uma linha. `line` é o número no arquivo, para o erro ser localizável. */
export function normalizeRow(
  row: CsvRow,
  line: number
): { product: ImportProduct | null; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const sku = pick(row, "sku").trim().toUpperCase();
  const name = pick(row, "name").trim();

  if (!sku) issues.push({ line, field: "sku", message: "SKU em branco — é a chave da importação" });
  if (!name) issues.push({ line, field: "name", message: "nome em branco" });
  if (name.length > 200) issues.push({ line, field: "name", message: "nome acima de 200 caracteres" });

  const priceRaw = pick(row, "priceCents");
  const priceCents = toCents(priceRaw);
  if (!priceRaw) issues.push({ line, field: "price", message: "preço em branco" });
  else if (priceCents <= 0)
    issues.push({ line, field: "price", message: `preço inválido: "${priceRaw}"` });

  const compareRaw = pick(row, "compareAtCents");
  let compareAtCents: number | null = compareRaw ? toCents(compareRaw) : null;
  if (compareAtCents !== null && compareAtCents <= priceCents) {
    // Não é erro que trave a linha: é dado sujo comum. Descarta o
    // "de" e importa o produto — melhor sem desconto que sem produto.
    issues.push({
      line,
      field: "compare_at",
      message: `preço anterior (${compareRaw}) não é maior que o atual — ignorado`,
    });
    compareAtCents = null;
  }

  const stockRaw = pick(row, "stockQty");
  const stockQty = stockRaw ? Math.max(0, Math.trunc(Number(stockRaw.replace(/[^\d-]/g, "")) || 0)) : 0;

  const imageUrl = pick(row, "imageUrl").trim() || null;
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    issues.push({ line, field: "image", message: "imagem precisa ser URL https — ignorada" });
  }

  const badgeRaw = pick(row, "badge").trim().toLowerCase();
  const badge = BADGES.has(badgeRaw) ? (badgeRaw as ImportProduct["badge"]) : null;
  if (badgeRaw && !badge)
    issues.push({ line, field: "badge", message: `selo desconhecido "${badgeRaw}" — ignorado` });

  const taxRaw = pick(row, "taxClass").trim().toLowerCase();
  const taxClass = TAX.has(taxRaw) ? (taxRaw as ImportProduct["taxClass"]) : "bonded";

  const specsRaw = pick(row, "specs");
  const specs = specsRaw
    ? specsRaw
        .split(/\s*(?:\||\n|;)\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const blocking = issues.some((i) => ["sku", "name", "price"].includes(i.field));
  if (blocking) return { product: null, issues };

  return {
    product: {
      sku,
      name,
      brand: pick(row, "brand").trim() || null,
      categorySlug: pick(row, "categorySlug") ? slugifyValue(pick(row, "categorySlug")) : null,
      priceCents,
      compareAtCents,
      stockQty,
      shortDescription: pick(row, "shortDescription").trim() || null,
      description: pick(row, "description").trim() || null,
      specs: specs && specs.length ? specs : null,
      imageUrl: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null,
      ean: pick(row, "ean").replace(/\D/g, "") || null,
      // Falso por padrão, ao contrário de `active`: item sem controle de
      // saldo aparece disponível, e é assim que a operação funciona.
      trackStock: parseBool(pick(row, "trackStock"), false),
      optionLabel: pick(row, "optionLabel").trim() || null,
      badge,
      taxClass,
      active: parseBool(pick(row, "active"), true),
    },
    issues,
  };
}

/** Arquivo inteiro → plano. Linha 1 é o cabeçalho, então soma 2. */
export function buildImportPlan(rows: CsvRow[]): ImportPlan {
  const issues: ImportIssue[] = [];
  const bySku = new Map<string, ImportProduct>();
  const duplicates: string[] = [];

  rows.forEach((row, idx) => {
    const { product, issues: rowIssues } = normalizeRow(row, idx + 2);
    issues.push(...rowIssues);
    if (!product) return;
    if (bySku.has(product.sku) && !duplicates.includes(product.sku)) {
      duplicates.push(product.sku);
    }
    bySku.set(product.sku, product); // o último vence
  });

  return { valid: [...bySku.values()], issues, duplicates };
}

export type ImportDiff = {
  create: ImportProduct[];
  update: ImportProduct[];
  unchanged: ImportProduct[];
};

/**
 * Compara o plano com o que já existe. É isto que o painel mostra
 * antes de aplicar: "42 novos, 310 atualizados, 1.648 iguais".
 */
export function diffAgainstExisting(
  plan: ImportProduct[],
  existing: Map<string, { price_cents: number; name: string; stock_qty: number }>
): ImportDiff {
  const create: ImportProduct[] = [];
  const update: ImportProduct[] = [];
  const unchanged: ImportProduct[] = [];

  for (const p of plan) {
    const cur = existing.get(p.sku);
    if (!cur) create.push(p);
    else if (
      cur.name !== p.name ||
      cur.price_cents !== p.priceCents ||
      cur.stock_qty !== p.stockQty
    )
      update.push(p);
    else unchanged.push(p);
  }
  return { create, update, unchanged };
}
