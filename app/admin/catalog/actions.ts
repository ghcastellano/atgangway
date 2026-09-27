"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { parseCsvRows } from "@/lib/csv";
import { buildImportPlan, diffAgainstExisting, type ImportProduct } from "@/lib/import";
import { toCents } from "@/lib/money";
import { PRODUCT_BUCKET } from "@/lib/catalog";
import { lookup } from "node:dns/promises";
import { creditoDaFoto } from "@/lib/fotolicenca";
import { normalizarFoto } from "@/lib/fotonormaliza";
import { sessionUser } from "@/lib/supabase/session";

const adminClient = requireAdmin;

type Db = NonNullable<Awaited<ReturnType<typeof adminClient>>>;

function slugify(v: string) {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function refresh() {
  revalidatePath("/admin/catalog");
  revalidatePath("/shop");
  revalidatePath("/", "layout");
  // A vitrine guarda as consultas públicas em unstable_cache com a tag
  // "catalog". Sem invalidar aqui, editar produto no painel levaria até
  // cinco minutos para aparecer na home — tempo suficiente para alguém
  // achar que o salvamento não funcionou e salvar de novo.
  // Next 16 exige o perfil de cache junto com a tag; "max" é o mesmo
  // comportamento de antes: invalida o que estiver guardado sob a tag.
  revalidateTag("catalog", "max");
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function saveCatalogProduct(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const priceCents = toCents(String(formData.get("price") ?? ""));
  if (!name || !sku || priceCents <= 0) return;

  const compareRaw = String(formData.get("compare_at") ?? "").trim();
  const compareCents = compareRaw ? toCents(compareRaw) : null;

  const specsRaw = String(formData.get("specs") ?? "");
  const specs = specsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const SELOS = ["halal", "vegetarian", "vegan", "gluten_free", "lactose_free", "contains_nuts"];
  const dietary = formData.getAll("dietary").map(String).filter((d) => SELOS.includes(d));

  const categoryId = String(formData.get("category_id") ?? "") || null;
  const badge = String(formData.get("badge") ?? "") || null;

  const row = {
    name,
    sku,
    slug: String(formData.get("slug") ?? "").trim() || slugify(name),
    short_description: String(formData.get("short_description") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    specs: specs.length ? specs : null,
    dietary,
    primary_category_id: categoryId,
    badge: ["promo", "new", "outlet"].includes(badge ?? "") ? badge : null,
    tax_class: String(formData.get("tax_class") ?? "bonded"),
    sort_order: Number(formData.get("sort_order") ?? 100) || 100,
    active: formData.get("active") === "on",
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return;
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error || !data) return;
    productId = data.id;
  }

  // Preço e estoque vivem na variante. Produto sem variante não tem
  // preço — por isso a padrão é criada junto, sempre.
  const stock = Math.max(0, Number(formData.get("stock") ?? 0) || 0);
  const { data: existing } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .order("sort_order")
    .limit(1)
    .maybeSingle();

  const variant = {
    product_id: productId,
    sku,
    price_cents: priceCents,
    compare_at_cents: compareCents && compareCents > priceCents ? compareCents : null,
    stock_qty: stock,
    track_stock: formData.get("track_stock") === "on",
    active: row.active,
  };

  if (existing) await supabase.from("product_variants").update(variant).eq("id", existing.id);
  else await supabase.from("product_variants").insert(variant);

  if (categoryId) {
    await supabase
      .from("product_categories")
      .upsert({ product_id: productId, category_id: categoryId }, { onConflict: "product_id,category_id" });
  }

  refresh();
  // A tela do produto recebe o aviso pela URL e o mostra como toast:
  // "salvou" precisa ser dito, não deduzido do formulário que não mudou.
  redirect(`/admin/catalog/${productId}?ok=${encodeURIComponent(id ? "Produto salvo" : "Produto criado")}`);
}

/**
 * Ações em massa. Excluir catálogo é irreversível, então a confirmação
 * escrita é exigida na tela — aqui só se confere que o alvo é
 * explícito: nunca "tudo" por omissão de filtro.
 */
export async function bulkCatalogAction(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const categoryPath = String(formData.get("category_path") ?? "");

  let targets = ids;

  if (targets.length === 0 && categoryPath) {
    const { data } = await supabase
      .from("product_categories")
      .select("product_id, categories!inner(path)")
      .like("categories.path", `${categoryPath}%`);
    targets = [...new Set((data ?? []).map((r) => (r as { product_id: string }).product_id))];
  }

  // Sem alvo explícito não faz nada. É a diferença entre "apagar a
  // seleção" e "apagar o catálogo porque o filtro veio vazio".
  if (targets.length === 0) return;

  if (action === "delete") {
    // As variantes, imagens e vínculos caem por cascata no banco.
    await supabase.from("products").delete().in("id", targets);
  } else if (action === "activate" || action === "deactivate") {
    const active = action === "activate";
    await supabase.from("products").update({ active }).in("id", targets);
    await supabase.from("product_variants").update({ active }).in("product_id", targets);
  } else if (action === "clear_badge") {
    await supabase.from("products").update({ badge: null }).in("id", targets);
  }

  refresh();
  const msg =
    action === "delete" ? `${targets.length} produto(s) excluído(s)` :
    action === "activate" ? `${targets.length} publicado(s)` :
    action === "deactivate" ? `${targets.length} despublicado(s)` : `Selo removido de ${targets.length}`;
  redirect(`/admin/catalog?ok=${encodeURIComponent(msg)}`);
}

export async function uploadProductImage(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const productId = String(formData.get("product_id") ?? "");
  const file = formData.get("image");
  if (!productId || !(file instanceof File) || file.size === 0) return;
  if (file.size > 5 * 1024 * 1024) return;

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `products/${productId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return;

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  await supabase.from("product_images").insert({
    product_id: productId,
    path,
    alt: String(formData.get("alt") ?? "") || null,
    sort_order: count ?? 0,
  });

  revalidatePath(`/admin/catalog/${productId}`);
  refresh();
  redirect(`/admin/catalog/${productId}?ok=${encodeURIComponent("Foto enviada")}`);
}

export async function deleteProductImage(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;
  const id = String(formData.get("image_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!id) return;

  const { data: img } = await supabase
    .from("product_images")
    .select("path")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("product_images").delete().eq("id", id);
  if (img?.path) await supabase.storage.from(PRODUCT_BUCKET).remove([img.path]);

  revalidatePath(`/admin/catalog/${productId}`);
  refresh();
  redirect(`/admin/catalog/${productId}?ok=${encodeURIComponent("Foto removida")}`);
}


/* ------------------------------------------------------------------ */
/* Imagem vinda da planilha                                            */
/* ------------------------------------------------------------------ */

/**
 * Endereço interno disfarçado de URL pública é o jeito clássico de
 * transformar "baixe esta imagem" em leitura da rede interna. A
 * planilha vem de fornecedor, então a URL é entrada de terceiro
 * mesmo passando por um admin: resolve o DNS e recusa faixa privada.
 */
const PRIVATE_V4 =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * Uma planilha traz dezenas de fotos do mesmo servidor. Resolver o mesmo
 * nome trinta vezes é latência à toa dentro de uma ação com prazo.
 * O mapa vive só enquanto o processo vive — não é cache de verdade, é
 * memória de uma importação.
 */
const hostConhecido = new Map<string, Promise<boolean>>();

function isPublicHost(hostname: string): Promise<boolean> {
  const visto = hostConhecido.get(hostname);
  if (visto) return visto;
  const p = resolvePublicHost(hostname);
  hostConhecido.set(hostname, p);
  return p;
}

async function resolvePublicHost(hostname: string): Promise<boolean> {
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => {
      if (a.family === 6) {
        const ip = a.address.toLowerCase();
        return !(ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80"));
      }
      return !PRIVATE_V4.test(a.address);
    });
  } catch {
    return false;
  }
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Baixa a foto e devolve o caminho no Storage, ou null se não deu. */
async function fetchImageToStorage(
  supabase: Db,
  productId: string,
  url: string
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!(await isPublicHost(parsed.hostname))) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: ctl.signal,
      // Sem redirect: um 302 para 127.0.0.1 fura a checagem de DNS
      // que acabou de ser feita no host original.
      redirect: "manual",
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;

    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = MIME_EXT[type];
    if (!ext) return null;

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > 5 * 1024 * 1024) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 5 * 1024 * 1024) return null;

    // Toda foto sai do mesmo molde: recortada, sobre branco, quadrada e
    // com a mesma folga. Foto de acervo vem tirada por voluntário, cada
    // uma num enquadramento — lado a lado na grade isso lê como loja
    // improvisada, e a foto é o que vende, porque a tripulação não pode
    // pegar o produto na mão.
    let corpo: Uint8Array;
    let tipoFinal: string;
    let extFinal: string;
    try {
      const n = await normalizarFoto(new Uint8Array(buf));
      corpo = n.buffer;
      tipoFinal = n.contentType;
      extFinal = "jpg";
    } catch {
      // Arquivo que o sharp não abre entra como veio: foto torta é
      // melhor que produto sem foto.
      corpo = new Uint8Array(buf);
      tipoFinal = type;
      extFinal = ext;
    }

    const path = `products/${productId}/import-${Date.now()}.${extFinal}`;
    const { error } = await supabase.storage
      .from(PRODUCT_BUCKET)
      .upload(path, corpo, { contentType: tipoFinal, upsert: false });
    if (error) return null;

    // Crédito junto com a foto, na mesma gravação: se a origem é um
    // acervo aberto, a licença exige crédito publicado, e crédito que
    // depende de alguém lembrar de preencher depois não é cumprido.
    const credito = creditoDaFoto(parsed.toString());
    await supabase.from("product_images").insert({
      product_id: productId,
      path,
      alt: null,
      sort_order: 0,
      license: credito?.license ?? null,
      attribution: credito?.attribution ?? null,
      source_url: credito?.sourceUrl ?? null,
      source_title: credito?.sourceTitle ?? null,
    });
    return path;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Importação                                                          */
/* ------------------------------------------------------------------ */

export type ImportReport = {
  ok: boolean;
  message?: string;
  applied?: boolean;
  totals?: { create: number; update: number; unchanged: number; invalid: number };
  duplicates?: string[];
  issues?: { line: number; field: string; message: string }[];
  sample?: { sku: string; name: string; price: number; kind: "create" | "update" }[];
};

/**
 * Lê o CSV e diz o que vai acontecer — sem gravar nada quando é
 * ensaio. É o passo que transforma "importei 2 mil linhas e agora não
 * sei o que mudou" em uma decisão informada.
 */
export async function runCatalogImport(
  _prev: ImportReport | null,
  formData: FormData
): Promise<ImportReport> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, message: "Sem permissão." };

  const file = formData.get("file");
  const apply = formData.get("apply") === "1";
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Escolha um arquivo CSV." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: "Arquivo acima de 8 MB — divida em partes." };
  }

  const text = await file.text();
  const plan = buildImportPlan(parseCsvRows(text));
  if (plan.valid.length === 0) {
    return {
      ok: false,
      message: "Nenhuma linha válida. Confira o cabeçalho (sku, name, price).",
      issues: plan.issues.slice(0, 40),
    };
  }

  const skus = plan.valid.map((p) => p.sku);
  const existing = new Map<string, { name: string; price_cents: number; stock_qty: number }>();
  // Em lotes: uma cláusula IN com 2 mil SKUs estoura o limite da URL.
  for (let i = 0; i < skus.length; i += 400) {
    const { data } = await supabase
      .from("products")
      .select("sku, name, price_cents, stock_qty")
      .in("sku", skus.slice(i, i + 400));
    for (const r of data ?? []) {
      existing.set(r.sku as string, {
        name: r.name as string,
        price_cents: r.price_cents as number,
        stock_qty: r.stock_qty as number,
      });
    }
  }

  const diff = diffAgainstExisting(plan.valid, existing);
  const invalidLines = new Set(
    plan.issues.filter((i) => ["sku", "name", "price"].includes(i.field)).map((i) => i.line)
  );

  const report: ImportReport = {
    ok: true,
    applied: false,
    totals: {
      create: diff.create.length,
      update: diff.update.length,
      unchanged: diff.unchanged.length,
      invalid: invalidLines.size,
    },
    duplicates: plan.duplicates,
    issues: plan.issues.slice(0, 40),
    sample: [
      ...diff.create.slice(0, 5).map((p) => ({
        sku: p.sku, name: p.name, price: p.priceCents, kind: "create" as const,
      })),
      ...diff.update.slice(0, 5).map((p) => ({
        sku: p.sku, name: p.name, price: p.priceCents, kind: "update" as const,
      })),
    ],
  };

  if (!apply) return report;

  const written = await applyPlan(supabase, [...diff.create, ...diff.update]);
  refresh();
  return {
    ...report,
    applied: true,
    message: `${written} produto(s) gravado(s).`,
  };
}

/** Grava o plano. Casado por SKU: reimportar atualiza, não duplica. */
async function applyPlan(supabase: Db, products: ImportProduct[]): Promise<number> {
  if (products.length === 0) return 0;

  // Categorias e marcas referenciadas, resolvidas de uma vez.
  const catSlugs = [...new Set(products.map((p) => p.categorySlug).filter(Boolean))] as string[];
  const catByslug = new Map<string, string>();
  if (catSlugs.length) {
    const { data } = await supabase.from("categories").select("id, slug").in("slug", catSlugs);
    for (const c of data ?? []) catByslug.set(c.slug as string, c.id as string);
  }

  const brandNames = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[];
  const brandByName = new Map<string, string>();
  if (brandNames.length) {
    // Marca que não existe é criada: barrar a importação porque falta
    // um cadastro de marca é atrito sem propósito.
    const rows = brandNames.map((n) => ({ slug: slugify(n), name: n }));
    await supabase.from("brands").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
    const { data } = await supabase
      .from("brands")
      .select("id, name, slug")
      .in("slug", rows.map((r) => r.slug));
    for (const b of data ?? []) brandByName.set((b.name as string).toLowerCase(), b.id as string);
  }

  let written = 0;
  for (let i = 0; i < products.length; i += 100) {
    const chunk = products.slice(i, i + 100);

    const productRows = chunk.map((p) => ({
      sku: p.sku,
      slug: slugify(`${p.name}-${p.sku}`),
      name: p.name,
      short_description: p.shortDescription,
      description: p.description,
      specs: p.specs,
      brand_id: p.brand ? (brandByName.get(p.brand.toLowerCase()) ?? null) : null,
      primary_category_id: p.categorySlug ? (catByslug.get(p.categorySlug) ?? null) : null,
      badge: p.badge,
      tax_class: p.taxClass,
      active: p.active,
    }));

    const { data: saved, error } = await supabase
      .from("products")
      .upsert(productRows, { onConflict: "sku" })
      .select("id, sku");
    if (error) continue;

    const idBySku = new Map((saved ?? []).map((r) => [r.sku as string, r.id as string]));

    const variantRows = chunk
      .filter((p) => idBySku.has(p.sku))
      .map((p) => ({
        product_id: idBySku.get(p.sku)!,
        sku: p.sku,
        ean: p.ean,
        option_label: p.optionLabel,
        price_cents: p.priceCents,
        compare_at_cents: p.compareAtCents,
        stock_qty: p.stockQty,
        // Um ship chandler NÃO tem armazém: compra contra o pedido, na
        // janela entre o pedido e a atracação. O que limita a venda é o
        // prazo do line-up, não uma contagem em prateleira. Com
        // track_stock ligado e a coluna `stock` vazia — que é o normal
        // numa planilha de fornecedor — todo item importado nasceria
        // "esgotado" e a loja abriria vazia.
        //
        // Quem de fato controla estoque de um item marca a coluna
        // `track_stock` na planilha.
        track_stock: p.trackStock,
        active: p.active,
      }));
    await supabase.from("product_variants").upsert(variantRows, { onConflict: "sku" });

    const catRows = chunk
      .filter((p) => p.categorySlug && catByslug.has(p.categorySlug) && idBySku.has(p.sku))
      .map((p) => ({
        product_id: idBySku.get(p.sku)!,
        category_id: catByslug.get(p.categorySlug!)!,
      }));
    if (catRows.length) {
      await supabase
        .from("product_categories")
        .upsert(catRows, { onConflict: "product_id,category_id", ignoreDuplicates: true });
    }

    // Fotos: só para quem tem URL na planilha e ainda não tem capa.
    // Uma de cada vez, para não abrir cem conexões de saída de uma vez
    // nem estourar o tempo da ação.
    const needsImage = chunk.filter((p) => p.imageUrl && idBySku.has(p.sku));
    if (needsImage.length) {
      const { data: already } = await supabase
        .from("products")
        .select("id")
        .in("id", needsImage.map((p) => idBySku.get(p.sku)!))
        .not("primary_image_path", "is", null);
      const have = new Set((already ?? []).map((r) => r.id as string));

      // Em lotes de quatro: em sequência, trinta fotos passam do teto da
      // ação e ela morre com os produtos gravados e nenhuma foto; todas de
      // uma vez, abre trinta conexões de saída no mesmo instante e o
      // servidor do outro lado começa a recusar.
      const pendentes = needsImage.filter((p) => !have.has(idBySku.get(p.sku)!));
      for (let j = 0; j < pendentes.length; j += 4) {
        await Promise.all(
          pendentes.slice(j, j + 4).map((p) =>
            fetchImageToStorage(supabase, idBySku.get(p.sku)!, p.imageUrl!)
          )
        );
      }
    }

    written += saved?.length ?? 0;
  }
  return written;
}
