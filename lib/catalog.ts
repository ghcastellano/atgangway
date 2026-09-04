/**
 * Catálogo — tipos e leitura.
 *
 * Toda listagem passa pela RPC list_products, que pagina por keyset.
 * A regra que sustenta isso: nenhuma tela busca "todos os produtos"
 * para filtrar na memória do navegador. Funciona com 12 SKUs e mata
 * a loja com 2 mil.
 */

import { SUPABASE_URL } from "./env.ts";

export const PRODUCT_BUCKET = "product-images";
/* Voltou para 24, e o motivo de ter ido a 48 já não existe.
   
   Ele subiu porque com 24 a leitura era "não está mostrando todos os
   produtos" — mas a causa disso não era o número, era não haver NENHUM
   sinal de quantos produtos a loja tem. Esse sinal existe agora: a barra
   da listagem diz "80 products", e a paginação por keyset diz "Next 24".
   Quem vê o total sabe que há mais; quem não vê, supõe que acabou.

   E os 48 custavam caro no celular. Medido no /shop: 213 KB de página,
   dos quais 105 KB são o payload do React embutido em <script> — cada
   card paga duas vezes, no HTML e na serialização. Num Pixel 7 com CPU
   4x mais lenta em 4G, o clique da home até a listagem assentar levava
   4,4 s, e 1,8 s disso era só analisar e hidratar antes de a tela reagir
   a qualquer toque. Por card são 0,9 KB: o card não está gordo, são 48
   deles. Metade dos itens é metade dos dois lados.

   24 numa grade de 4 colunas são 6 linhas; em 2 colunas no celular, 12.
   É mais do que cabe numa dobra em qualquer um dos dois. */
export const PAGE_SIZE = 24;

export type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  icon: string | null;
  image_path: string | null;
  path: string;
  depth: number;
  active: boolean;
  sort_order: number;
};

export type Brand = { id: string; slug: string; name: string; logo_path: string | null };

/** Linha da listagem — é exatamente o que a RPC devolve, nada a mais. */
export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  brand_name: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  max_price_cents: number | null;
  stock_qty: number;
  /** Alguma variante controla saldo? Falso = sempre disponível. */
  tracks_stock: boolean;
  variant_count: number;
  primary_image_path: string | null;
  badge: "promo" | "new" | "outlet" | null;
  sku: string | null;
  /** Variante mais barata ativa — é o que o botão da grade adiciona. */
  default_variant_id: string | null;
  cursor: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  ean: string | null;
  option_label: string | null;
  options: Record<string, string>;
  price_cents: number;
  compare_at_cents: number | null;
  stock_qty: number;
  track_stock: boolean;
  image_path: string | null;
  active: boolean;
  sort_order: number;
};

export type ProductImage = {
  id: string;
  path: string;
  alt: string | null;
  sort_order: number;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  specs: string[] | null;
  tax_class: "bonded" | "domestic" | "digital";
  min_qty: number;
  max_qty: number | null;
  primary_category_id: string | null;
  product_variants: ProductVariant[];
  product_images: ProductImage[];
};

export type SortKey = "featured" | "price_asc" | "price_desc" | "newest";

export const SORT_LABEL: Record<SortKey, string> = {
  featured: "Featured",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  newest: "Newest",
};

/**
 * Caminho no Storage → URL pública.
 *
 * O bucket é público de propósito (é vitrine), então a URL é estável
 * e cacheável na CDN. Link assinado em foto de catálogo só serve para
 * furar cache e deixar a loja lenta.
 */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path; // já é absoluta (import externo)
  // Começa com "/": é arquivo do próprio site, em public/. A carga
  // inicial mora aí porque o Storage autoriza por sessão de usuário e a
  // padronização das fotos não pode depender de alguém estar logado —
  // foto de catálogo é build, não upload. Ganha o CDN da Vercel de
  // graça e some do caminho de uma credencial a mais.
  if (path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const BADGE_LABEL: Record<string, string> = {
  promo: "Promo",
  new: "New",
  outlet: "Outlet",
};

/** Nó da árvore — recursivo de verdade, não só um nível. */
export type CategoryNode = Category & { children: CategoryNode[] };

/** Monta a árvore a partir da lista plana — uma passada, sem recursão em consulta. */
export function buildTree(rows: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of rows) byId.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id)!.children.push(c);
    else roots.push(c);
  }
  const sort = (a: Category, b: Category) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  roots.sort(sort);
  for (const c of byId.values()) c.children.sort(sort);
  return roots;
}

export type ListArgs = {
  category?: string | null; // caminho: '/electronics/'
  brand?: string | null;
  query?: string | null;
  badge?: string | null;
  sort?: SortKey;
  cursor?: string | null;
  limit?: number;
};

type Rpc = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- adaptador
  // estrutural: o cliente tipado (createClient<Database>) só aceita nomes do
  // schema em rpc(), e este tipo existe justamente para a vitrine não se
  // acoplar ao supabase-js — o teste passa um objeto com rpc() de mentira.
  rpc: (fn: any, args?: any) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function listProducts(
  supabase: Rpc,
  args: ListArgs = {}
): Promise<{ items: ProductCard[]; nextCursor: string | null }> {
  const limit = args.limit ?? PAGE_SIZE;
  const { data, error } = await supabase.rpc("list_products", {
    p_category: args.category ?? null,
    p_brand: args.brand ?? null,
    p_query: args.query ?? null,
    p_badge: args.badge ?? null,
    p_sort: args.sort ?? "featured",
    p_cursor: args.cursor ?? null,
    p_limit: limit,
  });
  if (error) return { items: [], nextCursor: null };

  const items = (data ?? []) as ProductCard[];
  // Página cheia significa "pode haver mais": um cursor a mais é
  // barato, uma página vazia no fim é aceitável.
  const nextCursor = items.length === limit ? (items[items.length - 1]?.cursor ?? null) : null;
  return { items, nextCursor };
}

/** Preço mostrado no card: "USD 12.00" ou "from USD 12.00" quando há variantes. */
export function priceRange(p: Pick<ProductCard, "price_cents" | "max_price_cents">) {
  return {
    from: p.price_cents,
    hasRange: p.max_price_cents != null && p.max_price_cents > p.price_cents,
  };
}

/**
 * Disponível para pedir.
 *
 * Estoque zero NÃO é esgotado por si só. Um ship chandler não tem
 * armazém: compra contra o pedido, na janela entre o pedido e a
 * atracação. O que limita a venda é o prazo do line-up, não uma
 * contagem em prateleira — e a loja inteira mostrava "Out of stock" em
 * 43 produtos ativos, com foto e preço, por causa disso.
 *
 * Esgotado é só o item que DECLARA controlar saldo e chegou a zero.
 */
export const inStock = (p: Pick<ProductCard, "stock_qty" | "tracks_stock">) =>
  !p.tracks_stock || p.stock_qty > 0;

/**
 * Separa o tamanho da embalagem do nome.
 *
 * "Melitta Traditional Ground Coffee 500 g" vira título e "500 g".
 * Loja de mantimento séria nunca mistura os dois na mesma linha: o
 * nome serve para reconhecer o produto e o tamanho para comparar
 * preço, e quem compra rancho compara o tempo todo — meio quilo de um
 * ao lado de um quilo do outro, com o nome mais longo empurrando o
 * tamanho para a segunda linha, é onde o pedido sai errado.
 *
 * Só o que se reconhece sem ambiguidade no fim do nome. Não casou,
 * devolve o nome inteiro e nenhum tamanho — melhor sem a linha do que
 * com um pedaço do nome nela.
 */
const TAMANHO = /\s+((?:\d+\s*[x\u00d7]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl|un|ct|pack)\b)\.?$/i;

export function packSize(name: string): { title: string; unit: string | null } {
  const m = TAMANHO.exec(name);
  if (!m) return { title: name.trim(), unit: null };
  const title = name.slice(0, m.index).trim();
  // Nome que é SÓ o tamanho ("500 g") não tem título para sobrar.
  if (!title) return { title: name.trim(), unit: null };
  return { title, unit: m[1].replace(/\s+/g, " ").trim() };
}

/** Marca com produto ativo. `count` é o que o filtro devolve se clicado. */
export type BrandOption = { id: string; slug: string; name: string; count: number };
