import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/env";
import { sitemapProducts } from "@/lib/sitemap-products";

export const revalidate = 3600;

/** Páginas fixas, com o peso que elas realmente têm na loja. */
const ESTATICAS: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, freq: "daily" },
  { path: "/shop", priority: 0.9, freq: "daily" },
  { path: "/ports", priority: 0.7, freq: "weekly" },
  { path: "/brochures", priority: 0.6, freq: "weekly" },
  { path: "/faq", priority: 0.5, freq: "monthly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/attributions", priority: 0.2, freq: "monthly" },
  { path: "/login", priority: 0.4, freq: "yearly" },
  { path: "/signup", priority: 0.5, freq: "yearly" },
];

/**
 * /sitemap.xml — respondia 404 junto com o robots.
 *
 * Categoria e ficha de produto entram do banco, não de uma lista fixa:
 * catálogo que muda pelo admin e sitemap escrito à mão divergem na
 * primeira importação de CSV, e aí o buscador indexa produto que saiu.
 *
 * Cliente anônimo de propósito — a RLS de leitura pública já entrega
 * exatamente o que um visitante enxerga, que é a definição do que deve
 * ser indexado.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ESTATICAS.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    changeFrequency: p.freq,
    priority: p.priority,
  }));

  if (!supabaseConfigured) return base;

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [cats, products] = await Promise.all([
      db.from("categories").select("slug").eq("active", true).order("sort_order"),
      sitemapProducts((from, to) => db.from("products").select("slug, updated_at")
        .eq("active", true).order("id").range(from, to)),
    ]);
    if (cats.error) throw new Error("Sitemap category query failed");

    return [
      ...base,
      ...(cats.data ?? []).map((c) => ({
        url: `${SITE_URL}/c/${c.slug as string}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...products.map((p) => ({
        url: `${SITE_URL}/p/${p.slug as string}`,
        ...(p.updated_at ? { lastModified: new Date(p.updated_at as string) } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // Banco fora do ar não pode devolver 500 para o buscador: sitemap
    // curto é melhor que sitemap quebrado.
    return base;
  }
}
