/**
 * O catálogo público, em cache — UMA vez a cada cinco minutos, não uma
 * vez por visita.
 *
 * O relatório do banco mostrou onde ia o tempo: list_products 11.379
 * chamadas, category_counts 9.403, brands + products(brand_id) 8.866
 * cada, categories 11.012 — a listagem inteira refeita a cada render de
 * /shop e /c, porque a página abria o client com cookie (sessão) e isso
 * tira o Next do cache. Nenhuma dessas consultas depende de quem olha:
 * a RLS de leitura pública devolve o mesmo catálogo para todo mundo.
 *
 * Aqui elas rodam com client anônimo dentro de unstable_cache, tag
 * "catalog" (a mesma que o admin invalida ao salvar produto), e os
 * argumentos entram na chave — cada combinação de filtro/página é uma
 * entrada. O que continua por visitante é só o coração da lista de
 * desejos, que é barato e só roda logado.
 */
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";
import { listProducts, type BrandOption, type Category, type ProductCard, type ListArgs } from "./catalog";
import { cronometrar, medir } from "./metricas";

const anon = () =>
  createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const OPTS = { revalidate: 300, tags: ["catalog"] };

/** Categorias ativas, planas, na ordem de exibição. */
export const categoriasAtivas = unstable_cache(
  async (): Promise<Category[]> => {
    if (!supabaseConfigured) return [];
    // Só chega aqui no MISS: o corpo do unstable_cache não roda no hit.
    // Contar estes é contar quantas vezes o cache NÃO segurou.
    const { data } = await cronometrar("vitrine.miss_ms", async () =>
      anon()
        .from("categories")
        .select("id, parent_id, slug, name, icon, image_path, path, depth, active, sort_order")
        .eq("active", true)
        .order("sort_order"), { consulta: "categorias" });
    return (data ?? []) as Category[];
  },
  ["vitrine-categorias"],
  OPTS
);

/** category_id → produtos ativos na subárvore. */
export const contagensPorCategoria = unstable_cache(
  async (): Promise<Record<string, number>> => {
    if (!supabaseConfigured) return {};
    const { data } = await cronometrar("vitrine.miss_ms", async () => anon().rpc("category_counts"), {
      consulta: "contagens",
    });
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as { category_id: string; product_count: number }[]) {
      out[r.category_id] = Number(r.product_count) || 0;
    }
    return out;
  },
  ["vitrine-contagens"],
  OPTS
);

/** Marcas com ao menos um produto ativo — filtro que nunca devolve vazio. */
export const marcasEmUso = unstable_cache(
  async (): Promise<BrandOption[]> => {
    if (!supabaseConfigured) return [];
    const db = anon();
    const [marcas, usadas] = await cronometrar(
      "vitrine.miss_ms",
      async () =>
        Promise.all([
          db.from("brands").select("id, slug, name").eq("active", true).order("sort_order"),
          db.from("products").select("brand_id").eq("active", true).not("brand_id", "is", null),
        ]),
      { consulta: "marcas" }
    );
    const emUso = new Set(((usadas.data ?? []) as { brand_id: string | null }[]).map((p) => p.brand_id));
    return ((marcas.data ?? []) as BrandOption[]).filter((b) => emUso.has(b.id));
  },
  ["vitrine-marcas"],
  OPTS
);

/** A listagem em si; os argumentos viram parte da chave do cache. */
export const listarProdutos = unstable_cache(
  async (args: ListArgs): Promise<{ items: ProductCard[]; nextCursor: string | null }> => {
    if (!supabaseConfigured) return { items: [], nextCursor: null };
    // A tag diz QUE TIPO de listagem custou, não qual busca: "busca" e
    // "categoria" são dois valores; o termo digitado seria infinito.
    const tipo = args.query ? "busca" : args.category ? "categoria" : "vitrine";
    const r = await cronometrar("vitrine.miss_ms", async () => listProducts(anon(), args), {
      consulta: "produtos",
      tipo,
    });
    medir("vitrine.itens", r.items.length, { tipo });
    return r;
  },
  ["vitrine-produtos"],
  OPTS
);
