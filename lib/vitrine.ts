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
    // Quantos produtos ativos cada marca tem. O número não é enfeite:
    // é o que decide QUAIS marcas o trilho mostra sem abrir, e é a
    // promessa do que o clique devolve — a mesma regra dos números das
    // categorias. Antes só existia o conjunto "tem ou não tem produto",
    // e o trilho listava as trinta em ordem de cadastro.
    const porMarca = new Map<string, number>();
    for (const p of (usadas.data ?? []) as { brand_id: string | null }[]) {
      if (p.brand_id) porMarca.set(p.brand_id, (porMarca.get(p.brand_id) ?? 0) + 1);
    }
    return ((marcas.data ?? []) as { id: string; slug: string; name: string }[])
      .filter((b) => porMarca.has(b.id))
      .map((b) => ({ ...b, count: porMarca.get(b.id) ?? 0 }))
      // Maior primeiro: quem procura marca procura a que a loja tem de
      // verdade. Empate volta para a ordem alfabética, que é estável.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },
  ["vitrine-marcas"],
  OPTS
);

/**
 * Quantos produtos cada selo tem NO CONTEXTO — a categoria aberta, a
 * marca filtrada, a busca em curso.
 *
 * Existe por causa de um defeito real: dentro de "New Arrivals" a tela
 * oferecia Promo e Outlet, e os dois davam SEMPRE zero. Não era falta de
 * produto em promoção: `badge` é uma coluna única por produto, e New
 * Arrivals é justamente a coleção de badge='new' — cruzar os dois é
 * impossível por construção. Oferecer um filtro que não pode ter
 * resultado é prometer o que não se tem.
 */
export const contagensPorSelo = unstable_cache(
  async (ctx: { category?: string | null; brand?: string | null; query?: string | null }) => {
    if (!supabaseConfigured) return {} as Record<string, number>;
    const { data } = await cronometrar(
      "vitrine.miss_ms",
      async () =>
        anon().rpc("badge_counts", {
          p_category: ctx.category ?? undefined,
          p_brand: ctx.brand ?? undefined,
          p_query: ctx.query ?? undefined,
        }),
      { consulta: "selos" }
    );
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as { badge: string; produtos: number }[]) {
      out[r.badge] = Number(r.produtos) || 0;
    }
    return out;
  },
  ["vitrine-selos"],
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
