type Product = { slug: string; updated_at: string | null };
type ReadPage = (from: number, to: number) => PromiseLike<{ data: Product[] | null; error: unknown }>;

/** Read the existing 5,000-product sitemap budget in API-sized pages.
 * Callers must order by a stable, unique column (the product ID). */
export async function sitemapProducts(readPage: ReadPage): Promise<Product[]> {
  const products: Product[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await readPage(from, from + 999);
    if (error) throw new Error("Sitemap product page failed");
    const page = data ?? [];
    products.push(...page);
    if (page.length < 1000) break;
  }
  return products;
}
