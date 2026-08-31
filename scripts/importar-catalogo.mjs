#!/usr/bin/env node
/**
 * Sobe uma planilha de catálogo — com as fotos — de linha de comando.
 *
 * A importação do admin (/admin/catalog/import) faz o mesmo e é a via
 * normal. Este script existe para o carregamento inicial, que são
 * dezenas de fotos baixadas de fora: numa Server Action isso estoura o
 * tempo da requisição, e no terminal não.
 *
 * Precisa de uma sessão de admin, porque é `is_admin()` que libera o
 * bucket das fotos e a escrita no catálogo. Não existe chave
 * service_role no projeto, de propósito.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *     node --experimental-strip-types scripts/importar-catalogo.mjs catalogo.csv [flags]
 *
 *   --seco             mostra o que faria e não grava nada
 *   --refoto           refaz a foto mesmo de quem já tem capa
 *   --desativar-fora   desativa o que não está no arquivo
 *
 * `--experimental-strip-types` porque a normalização das fotos mora em
 * lib/fotonormaliza.ts, que é TypeScript e é o mesmo módulo que o app
 * usa — foto do catálogo e foto do admin saem do mesmo molde ou o
 * padrão dura até o primeiro upload manual.
 *
 * Idempotente: casa por SKU. Rodar de novo atualiza, não duplica.
 *
 * TODA foto passa pelo mesmo molde antes de subir: 1000x1000, fundo
 * branco, 6% de folga. Sem isso a grade fica com uma foto recortada em
 * estúdio ao lado de outra tirada no corredor do mercado com o chão
 * aparecendo, e a loja inteira lê como improviso — que foi exatamente o
 * que aconteceu na primeira carga.
 */

import { readFileSync, existsSync } from "node:fs";

/**
 * Lê .env.local sem depender de `set -a && . ./.env.local` na frente do
 * comando: comando composto não casa com a regra de permissão, e o
 * script que precisa da variável é quem deve saber onde ela mora.
 */
function carregarEnv(arquivo = ".env.local") {
  try {
    for (const linha of readFileSync(arquivo, "utf-8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const valor = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = valor;
    }
  } catch {
    // sem arquivo: as variáveis podem já vir do ambiente
  }
}
carregarEnv();
import { createClient } from "@supabase/supabase-js";
import { normalizarFoto } from "../lib/fotonormaliza.ts";
import { avaliarFoto } from "../lib/fotoqualidade.ts";

const CSV = process.argv[2];
const SECO = process.argv.includes("--seco");
/** Refaz a capa de quem já tem. É como as fotos ruins da primeira carga saem. */
const REFOTO = process.argv.includes("--refoto");
/** Desativa o que não veio no arquivo — o arquivo passa a ser a verdade. */
const DESATIVAR_FORA = process.argv.includes("--desativar-fora");
/**
 * Credenciais: do ambiente, ou do arquivo que conta-servico.mjs deixou.
 * Pelo arquivo é melhor — senha em variável de ambiente aparece na linha
 * de comando e no histórico do shell.
 */
const ARQUIVO_CONTA = "/tmp/conta-servico.json";
let { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if ((!ADMIN_EMAIL || !ADMIN_PASSWORD) && existsSync(ARQUIVO_CONTA)) {
  const c = JSON.parse(readFileSync(ARQUIVO_CONTA, "utf-8"));
  ADMIN_EMAIL = c.email;
  ADMIN_PASSWORD = c.senha;
}

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = "product-images";

function morre(msg) {
  console.error(msg);
  process.exit(1);
}
if (!CSV) morre("uso: importar-catalogo.mjs <arquivo.csv> [--seco]");
if (!URL_SB || !ANON) morre("faltam NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY");
if (!SECO && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) morre("faltam ADMIN_EMAIL / ADMIN_PASSWORD");

/* ---- CSV: aspas duplas com escape doblado, que é o que o Excel gera ---- */
function lerCsv(texto) {
  const linhas = [];
  let campo = "";
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
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

const slug = (v) =>
  v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ---- Crédito de foto: espelha lib/fotolicenca.ts ---- */
const ACERVOS = {
  "images.openfoodfacts.org": ["https://world.openfoodfacts.org", "Open Food Facts"],
  "images.openbeautyfacts.org": ["https://world.openbeautyfacts.org", "Open Beauty Facts"],
  "images.openproductsfacts.org": ["https://world.openproductsfacts.org", "Open Products Facts"],
};
function credito(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const a = ACERVOS[u.hostname];
  if (!a) return null;
  const m = u.pathname.match(/\/images\/products\/([0-9/]+)\/[^/]+$/);
  const ean = m ? m[1].replace(/\//g, "") : null;
  return {
    license: "CC BY-SA 3.0",
    attribution: `${a[1]} contributors · CC BY-SA 3.0`,
    source_url: ean ? `${a[0]}/product/${ean}` : a[0],
    source_title: a[1],
  };
}

/* ------------------------------------------------------------------ */

const linhas = lerCsv(readFileSync(CSV, "utf-8"));
console.log(`${linhas.length} linha(s) em ${CSV}${SECO ? "  [ensaio]" : ""}`);
if (SECO) {
  for (const l of linhas) console.log(`  ${l.sku}  ${l.name}  $${l.price}  ${l.category}  foto:${l.image_url ? "sim" : "não"}`);
  process.exit(0);
}

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: erroLogin } = await db.auth.signInWithPassword({
  email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
});
if (erroLogin) morre(`login: ${erroLogin.message}`);

// Confere o papel antes de tentar gravar: erro de RLS no meio do laço é
// difícil de ler, e "não é admin" é a causa em nove de cada dez vezes.
const { data: eu } = await db.auth.getUser();
const { data: perfil } = await db.from("profiles").select("role").eq("id", eu.user.id).single();
if (perfil?.role !== "admin") morre(`${ADMIN_EMAIL} não é admin (role=${perfil?.role ?? "?"})`);

/**
 * Endereço público do produto.
 *
 * O admin monta `nome-sku`, o que numa planilha com SKU de código de
 * barras vira /p/cafe-pilao-tradicional-250-g-ean-7896089011982. O
 * código não ajuda ninguém a ler nem a achar; entra só quando dois
 * produtos disputam o mesmo endereço.
 *
 * Produto que já existe MANTÉM o endereço que tem: trocar slug de item
 * publicado quebra link que a tripulação já mandou por WhatsApp.
 */
async function enderecoDe(l, jaExiste) {
  if (jaExiste?.slug) return jaExiste.slug;
  const limpo = slug(l.name);
  const { data } = await db.from("products").select("id").eq("slug", limpo).maybeSingle();
  return data ? slug(`${l.name}-${l.sku}`) : limpo;
}

/* Categorias e marcas, resolvidas de uma vez. */
const { data: cats } = await db.from("categories").select("id, slug");
const catPorSlug = new Map((cats ?? []).map((c) => [c.slug, c.id]));

const marcas = [...new Set(linhas.map((l) => l.brand).filter(Boolean))];
if (marcas.length) {
  await db.from("brands").upsert(marcas.map((n) => ({ slug: slug(n), name: n })),
    { onConflict: "slug", ignoreDuplicates: true });
}
const { data: bs } = await db.from("brands").select("id, slug");
const marcaPorSlug = new Map((bs ?? []).map((b) => [b.slug, b.id]));

let gravados = 0, comFoto = 0, falhas = 0;

for (const l of linhas) {
  const catId = l.category ? catPorSlug.get(l.category) : null;
  if (l.category && !catId) { console.error(`  ✗ ${l.sku}: categoria "${l.category}" não existe`); falhas++; continue; }

  const { data: atual } = await db.from("products")
    .select("id, slug, primary_image_path").eq("sku", l.sku).maybeSingle();

  const { data: prod, error: e1 } = await db.from("products").upsert({
    sku: l.sku,
    slug: await enderecoDe(l, atual),
    name: l.name,
    short_description: l.short_description || null,
    brand_id: l.brand ? (marcaPorSlug.get(slug(l.brand)) ?? null) : null,
    primary_category_id: catId,
    tax_class: "bonded",
    active: l.active !== "false",
  }, { onConflict: "sku" }).select("id, primary_image_path").single();
  if (e1) { console.error(`  ✗ ${l.sku}: ${e1.message}`); falhas++; continue; }

  const cents = Math.round(Number(l.price) * 100);
  const { error: e2 } = await db.from("product_variants").upsert({
    product_id: prod.id,
    sku: l.sku,
    ean: l.ean || null,
    price_cents: cents,
    stock_qty: Number(l.stock || 0),
    track_stock: false, // o chandler repõe do fornecedor a cada escala
    active: l.active !== "false",
  }, { onConflict: "sku" });
  if (e2) { console.error(`  ✗ ${l.sku} variante: ${e2.message}`); falhas++; continue; }

  if (catId) {
    await db.from("product_categories").upsert(
      { product_id: prod.id, category_id: catId },
      { onConflict: "product_id,category_id", ignoreDuplicates: true }
    );
  }

  // Sem --refoto, reimportar não sobrescreve a capa que alguém já subiu
  // por cima da do acervo. Com --refoto, sobrescreve — que é como as
  // fotos ruins da primeira carga saem sem apagar produto.
  if (l.image_url && (REFOTO || !prod.primary_image_path)) {
    const ok = await subirFoto(prod.id, l.image_url, l.name);
    if (ok) comFoto++;
  }

  gravados++;
  console.log(`  ✓ ${l.sku}  ${l.name}  $${l.price}`);
}

/**
 * O arquivo passa a ser a verdade da vitrine — NAS CATEGORIAS QUE ELE
 * COBRE, e só nelas.
 *
 * Sem esse recorte, subir uma planilha de comida e higiene apagaria os
 * chips de celular, a caixa de som e o carregador, que vivem em
 * categorias que a planilha nem menciona. "Fora do arquivo" tem de
 * querer dizer "fora do arquivo naquilo que o arquivo trata".
 *
 * DESATIVA, não apaga. Produto apagado leva junto o histórico: item de
 * pedido antigo aponta para a variante, e o pedido de quem já comprou
 * passaria a mostrar linha vazia. Desativado some da loja e continua
 * existindo para quem já comprou.
 */
if (DESATIVAR_FORA) {
  const skus = new Set(linhas.map((l) => l.sku));
  const catsDoArquivo = new Set(
    linhas.map((l) => l.category).filter(Boolean).map((c) => catPorSlug.get(c)).filter(Boolean)
  );
  const { data: todos } = await db.from("products")
    .select("id, sku, name, primary_category_id").eq("active", true);
  const fora = (todos ?? []).filter(
    (p) => !skus.has(p.sku) && catsDoArquivo.has(p.primary_category_id)
  );
  if (fora.length === 0) {
    console.log("\nNada a desativar nas categorias do arquivo.");
  } else if (SECO) {
    console.log(`\n[seco] desativaria ${fora.length}:`);
    for (const p of fora) console.log(`  - ${p.sku}  ${p.name}`);
  } else {
    const ids = fora.map((p) => p.id);
    await db.from("products").update({ active: false }).in("id", ids);
    await db.from("product_variants").update({ active: false }).in("product_id", ids);
    console.log(`\n${fora.length} produto(s) fora do arquivo nas categorias dele, desativado(s).`);
  }
}

console.log(`\n${gravados} produto(s), ${comFoto} foto(s) nova(s), ${falhas} falha(s).`);
await db.auth.signOut();

async function subirFoto(produtoId, url, alt) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "VesselSupplier/1.0 (ahoy@marinerssupplyco.com)" } });
    if (!r.ok) { console.error(`    foto HTTP ${r.status}`); return false; }
    const bruto = new Uint8Array(await r.arrayBuffer());
    if (bruto.byteLength < 5000 || bruto.byteLength > 8 * 1024 * 1024) {
      console.error(`    foto de ${bruto.byteLength} bytes, fora da faixa`); return false;
    }

    // Resolução é o único corte que se mede sem ambiguidade. O resto —
    // "isto é pack shot ou foto de gôndola?" — foi tentado, medido
    // contra 55 fotos classificadas no olho, acertou 40%, e o motivo
    // está em lib/fotoqualidade.ts. Quem separa isso é a folha de
    // contato antes do CSV, não o importador.
    const laudo = await avaliarFoto(bruto);
    if (!laudo.aprovada) { console.error(`    foto reprovada: ${laudo.motivo}`); return false; }

    // O molde. Sempre, inclusive em foto que já parece boa: o valor
    // está em TODAS terem o mesmo enquadramento, não em cada uma ser
    // aceitável sozinha.
    const foto = await normalizarFoto(bruto);
    // Nome fixo e upsert: a capa de um produto é uma só, e cada carga
    // sobrescreve em vez de acumular arquivo órfão no bucket.
    const caminho = `products/${produtoId}/capa.jpg`;
    const { error } = await db.storage.from(BUCKET)
      .upload(caminho, foto.buffer, { contentType: foto.contentType, upsert: true });
    if (error) { console.error(`    upload: ${error.message}`); return false; }

    const c = credito(url);
    // Apaga a capa antiga e insere, em vez de upsert. O upsert precisaria
    // de índice ÚNICO em (product_id, sort_order), e o que existe é um
    // índice comum — o Postgres recusa ON CONFLICT contra índice não
    // único com 42P10, que é o mesmo erro que já custou uma rodada aqui
    // com o índice parcial de products.sku. Sem isto, reimportar com
    // --refoto deixaria duas capas na posição 0 disputando a vitrine.
    await db.from("product_images").delete().eq("product_id", produtoId).eq("sort_order", 0);
    const { error: e } = await db.from("product_images").insert({
      product_id: produtoId, path: caminho, alt, sort_order: 0, ...(c ?? {}),
    });
    if (e) { console.error(`    product_images: ${e.message}`); return false; }
    return true;
  } catch (err) {
    console.error(`    foto: ${err.message}`);
    return false;
  }
}
