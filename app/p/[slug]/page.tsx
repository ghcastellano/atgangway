import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ProductBuy from "@/components/ProductBuy";
import ProductCardView from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
import { listProducts, type ProductDetail } from "@/lib/catalog";
import { wishedProductIds } from "@/lib/wishlist";
import { ELIGIBILITY } from "@/lib/taxregime";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("name, short_description")
    .eq("slug", slug)
    .maybeSingle();
  return {
    title: data?.name ?? undefined,
    description: data?.short_description ?? undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      `id, slug, name, short_description, description, specs, badge, sku, tax_class,
       min_qty, max_qty, price_cents, compare_at_cents, max_price_cents, stock_qty,
       variant_count, primary_image_path, primary_category_id, brand_id,
       brands(name, slug),
       product_images(id, path, alt, sort_order),
       product_variants!product_variants_product_id_fkey(id, sku, ean, option_label, options, price_cents,
                        compare_at_cents, stock_qty, track_stock, image_path,
                        active, sort_order)`
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!data) notFound();

  const p = data as unknown as ProductDetail & {
    brands: { name: string; slug: string } | null;
  };
  const variants = (p.product_variants ?? [])
    .filter((v) => v.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.price_cents - b.price_cents);
  const images = (p.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order);

  // Relacionados da mesma categoria — busca barata, e é o que segura a
  // pessoa navegando em vez de voltar para a listagem.
  const { data: cat } = p.primary_category_id
    ? await supabase.from("categories").select("path, slug, name").eq("id", p.primary_category_id).maybeSingle()
    : { data: null };

  const related = cat
    ? (await listProducts(supabase, { category: cat.path, limit: 5 })).items.filter(
        (r) => r.id !== p.id
      )
    : [];

  // A ficha e os relacionados numa consulta só: o coração do produto
  // aberto e o dos cards ao lado nascem no estado real.
  const wished = await wishedProductIds([p.id, ...related.map((r) => r.id)]);

  return (
    <main className="pb-dock pg-pdp">
      <Breadcrumb
        trail={[
          { label: "Shop", href: "/shop" },
          ...(cat ? [{ label: cat.name, href: `/c/${cat.slug}` }] : []),
          { label: p.name },
        ]}
      />
      <ProductBuy
        product={{
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brands?.name ?? null,
          badge: p.badge,
          sku: p.sku,
          short_description: p.short_description,
          tax_class: p.tax_class,
          min_qty: p.min_qty,
          max_qty: p.max_qty,
        }}
        images={images.length ? images : p.primary_image_path
          ? [{ id: "primary", path: p.primary_image_path, alt: p.name, sort_order: 0 }]
          : []}
        variants={variants}
        wished={wished.has(p.id)}
      />

      {(p.specs?.length || p.description) && (
        <section className="pdp-block">
          {/* O nome volta no título e em negrito logo abaixo, como na
              ficha do Sunny: quem chega rolando de outra ficha confere
              de qual produto é a lista sem subir de novo. */}
          <h2>
            Description <span className="slash">/</span> {p.name}
          </h2>
          <p className="prodname">{p.name}</p>
          {p.specs?.length ? (
            <ul className="specs">
              {p.specs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="pdp-text">{p.description}</p>
          )}
        </section>
      )}

      {/* O que o imposto faz depende do CANAL, não do produto. Dizer
          "duty-free" em tudo era promessa que a operação não sustenta:
          o benefício do fornecimento de bordo exige adquirente no
          exterior e pagamento em moeda conversível pelo agente do
          armador — não cartão pessoal em real. */}
      <section className="pdp-block">
        <h2>{ELIGIBILITY[p.tax_class].headline}</h2>
        <ul className="specs">
          {ELIGIBILITY[p.tax_class].lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="pdp-block">
        <h2>How it reaches you</h2>
        <ul className="specs">
          <li>30% deposit now, balance when you take delivery.</li>
          <li>Photo proof of delivery on your order page.</li>
          <li>
            If your vessel skips the port, the deposit becomes full credit —{" "}
            <Link className="alink" href="/terms">
              clause 6
            </Link>
            .
          </li>
        </ul>
      </section>

      {related.length > 0 && (
        <>
          <p className="subhead">More in {cat?.name}</p>
          <div className="pgrid">
            {related.slice(0, 4).map((r) => (
              <ProductCardView key={r.id} p={r} wished={wished.has(r.id)} />
            ))}
          </div>
          <div className="stack" style={{ paddingTop: 2 }}>
            <Link className="btn ghost" href={`/c/${cat?.slug}`} prefetch={false}>
              See all {cat?.name}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
