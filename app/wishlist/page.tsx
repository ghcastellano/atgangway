import type { Metadata } from "next";
import Link from "next/link";
import AccountRail from "@/components/AccountRail";
import { ehAdmin } from "@/lib/admin";
import { IconHeart } from "@/components/Icon";
import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ProductCardView from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
import type { ProductCard } from "@/lib/catalog";
import { sessionUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My Wish List" };

/** Só o que o card da grade consome — o embed não traz nada além disso. */
type Row = {
  products: {
    id: string;
    slug: string;
    name: string;
    short_description: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    max_price_cents: number | null;
    stock_qty: number;
    tracks_stock: boolean;
    variant_count: number;
    primary_image_path: string | null;
    badge: "promo" | "new" | "outlet" | null;
    sku: string | null;
    default_variant_id: string | null;
    brands: { name: string } | null;
  };
};

export default async function WishlistPage() {
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) redirect("/login?next=/wishlist");

  // O embed nomeia a chave estrangeira de propósito: products tem DUAS
  // relações com product_variants (product_variants.product_id e
  // products.default_variant_id), e o PostgREST recusa o embed assim que
  // alguém encostar numa variante daqui. Nomear já é o hábito da casa.
  //
  // default_variant_id vem como coluna escalar — é o que o botão da grade
  // adiciona ao carrinho, e evita justamente aquele embed ambíguo.
  //
  // !inner + active: produto tirado do ar continua na lista de desejos de
  // quem o marcou, e um card que leva a um 404 é pior que a ausência dele.
  const { data } = await supabase
    .from("wishlists")
    .select(
      `products!wishlists_product_id_fkey!inner(
         id, slug, name, short_description, price_cents, compare_at_cents,
         max_price_cents, stock_qty, tracks_stock, variant_count, primary_image_path,
         badge, sku, default_variant_id,
         brands(name)
       )`
    )
    .eq("user_id", user.id)
    .eq("products.active", true)
    .order("created_at", { ascending: false });

  const isAdmin = await ehAdmin(supabase, user.id);

  const items: ProductCard[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const { brands, ...p } = r.products;
    return {
      ...p,
      brand_name: brands?.name ?? null,
      // cursor só existe para a paginação por keyset da listagem; aqui a
      // lista inteira cabe numa tela e não há próxima página.
      cursor: "",
    };
  });

  return (
    <main className="pg-acct">
      <Breadcrumb trail={[{ label: "My Wish List" }]} />

      <h1 className="secttl left">My Wish List</h1>

      <AccountRail current="/wishlist" isAdmin={isAdmin} />

      <div className="acct-main">

      {items.length === 0 ? (
        /* Estado vazio com voz, não um aviso: aviso azul é para regra de
           pedido; lista vazia é um convite — ensina o gesto do coração. */
        <div className="empty">
          <div className="i" aria-hidden><IconHeart size={26} /></div>
          <p className="t">Nothing saved yet</p>
          <p className="d">
            Tap the heart on any product and it drops anchor here — easy to
            find again on your next call.
          </p>
          <Link className="btn ghost" href="/shop" prefetch={false}>
            Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="pgrid">
          {items.map((p, i) => (
            // As quatro primeiras acima da dobra entram com priority; o
            // resto fica preguiçoso, que é o que segura o wifi do navio.
            <ProductCardView key={p.id} p={p} priority={i < 4} wished />
          ))}
        </div>
      )}

      {/* "Back" é link de verdade, não history.back(): quem chega aqui pelo
          ícone ♡ do cabeçalho não tem para onde voltar. */}
      <p className="linkline">
        <Link href="/shop">Back</Link>
      </p>
      </div>
    </main>
  );
}
