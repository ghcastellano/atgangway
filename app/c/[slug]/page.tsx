import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ProductCardView from "@/components/ProductCard";
import FacetRail from "@/components/FacetRail";
import { IconCompass } from "@/components/Icon";
import {
  categoriasAtivas,
  contagensPorCategoria,
  contagensPorSelo,
  listarProdutos,
  marcasEmUso,
} from "@/lib/vitrine";
import SortSelect from "@/components/SortSelect";
import BrandSelect from "@/components/BrandSelect";
import {
  BADGE_LABEL,
  buildTree,
  PAGE_SIZE,
  SORT_LABEL,
  type CategoryNode,
  type SortKey,
} from "@/lib/catalog";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Da mesma árvore em cache que a página usa: zero consulta extra.
  const data = (await categoriasAtivas()).find((c) => c.slug === slug) as
    | { name: string; description?: string | null }
    | undefined;
  const nome = data?.name;
  return {
    title: nome ?? undefined,
    // Nenhuma das categorias tem descrição no banco ainda, e sem esta
    // linha toda página de categoria ia para o buscador sem resumo. O
    // texto diz o que a página é de verdade — não é enfeite de SEO.
    description:
      data?.description ??
      (nome
        ? `${nome} for your vessel's next call at Porto de Santos. Pre-order before docking, pay a 30% deposit, receive at the gangway.`
        : undefined),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string; badge?: string; brand?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = (sp.sort as SortKey) ?? "featured";

  // Árvore, contagens e marcas do cache público (lib/vitrine); pai e
  // filhos saem da árvore em memória. Nada disso depende de quem olha.
  const [planas, counts, brands] = await Promise.all([
    categoriasAtivas(),
    contagensPorCategoria(),
    marcasEmUso(),
  ]);
  const roots = buildTree(planas);
  const achada = planas.find((c) => c.slug === slug);
  if (!achada) notFound();
  const category = achada;

  const children = planas.filter((c) => c.parent_id === category.id);
  const parent = category.parent_id
    ? (planas.find((c) => c.id === category.parent_id) ?? null)
    : null;

  // A RPC recebe UUID; a URL carrega slug. Slug inexistente vira null.
  const brandId = sp.brand ? (brands.find((b) => b.slug === sp.brand)?.id ?? null) : null;

  /** Filtro ligado: o número passa a ser o do resultado, não o da categoria. */
  const temFiltro = Boolean(sp.brand || sp.badge || sp.cursor);

  const [{ items, nextCursor }, selos] = await Promise.all([
    listarProdutos({
      category: category.path,
      sort,
      badge: (sp.badge as "promo" | "new" | "outlet" | undefined) ?? null,
      brand: brandId,
      cursor: sp.cursor ?? null,
    }),
    contagensPorSelo({ category: category.path, brand: brandId }),
  ]);
  const selosDisponiveis = (["promo", "new", "outlet"] as const).filter((b) => (selos[b] ?? 0) > 0);

  // O coração precisa nascer no estado certo: vazio quando já está
  // salvo vira toque duplo, e o toque duplo desmarca.

  // Preserva sort E badge. O more() antigo só carregava o sort, então
  // paginar dentro de um filtro apagava o filtro em silêncio.
  const keep = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const atual: Record<string, string | null> = {
      sort: sort !== "featured" ? sort : null,
      badge: sp.badge ?? null,
      brand: sp.brand ?? null,
      cursor: sp.cursor ?? null,
      ...extra,
    };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/c/${slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="pg-list">
      <Breadcrumb
        trail={[
          { label: "Shop", href: "/shop" },
          ...(parent ? [{ label: parent.name, href: `/c/${parent.slug}` }] : []),
          { label: category.name },
        ]}
      />
      <h1 className="secttl left">{category.name}</h1>

      <div className="shop-body">
        <FacetRail
          tree={roots as CategoryNode[]}
          activeSlug={slug}
          counts={counts}
          brands={brands}
          activeBrand={brandId ? (sp.brand ?? null) : null}
          brandHref={(b) => keep({ brand: b, cursor: null })}
        />
        <div className="listcol">

      {(children ?? []).length > 0 && (
        <div className="cats-tabs" style={{ paddingTop: 12 }}>
          <span className="tab on">All</span>
          {(children ?? []).map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="tab" prefetch={false}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="listbar">
        <span className="count">
          {/* O TOTAL da subárvore, não o tamanho da página. Dizia
              "24+ items" enquanto o trilho, dois centímetros à
              esquerda, dizia "Food & Drinks 81" — dois números para a
              mesma categoria, na mesma tela, e o menor deles com um
              "+" que não explica nada. O total só sai de cena quando
              há filtro aplicado, porque aí ele deixaria de ser o
              número do que está na tela. */}
          {temFiltro
            ? `${items.length}${nextCursor ? "+" : ""} item${items.length === 1 ? "" : "s"}`
            : `${counts[category.id] ?? items.length} item${
                (counts[category.id] ?? items.length) === 1 ? "" : "s"
              }`}
        </span>
        {/* Só o selo que TEM produto aqui, e com quantos. Um filtro que
            devolve zero não é filtro, é beco. */}
        {selosDisponiveis.length > 0 && (
          <span className="offers">
            {selosDisponiveis.map((b) => (
              <Link
                key={b}
                href={keep({ badge: sp.badge === b ? null : b, cursor: null })}
                className={sp.badge === b ? "on" : ""}
                prefetch={false}
              >
                {BADGE_LABEL[b]} <b>{selos[b]}</b>
              </Link>
            ))}
          </span>
        )}
        <span className="sortlbl" aria-hidden>
          Sort by
        </span>
        <SortSelect value={sort} options={SORT_LABEL} />
        {/* Só no celular: no desktop o trilho à esquerda já filtra por marca. */}
        <BrandSelect brands={brands} value={brandId ? (sp.brand ?? null) : null} />
      </div>

      {(sp.badge || brandId) && (
        <div className="chips">
          {sp.badge && (
            <Link href={keep({ badge: null, cursor: null })} prefetch={false}>
              <b>Offer</b> {BADGE_LABEL[sp.badge as "promo" | "new" | "outlet"]}
            </Link>
          )}
          {brandId && (
            <Link href={keep({ brand: null, cursor: null })} prefetch={false}>
              <b>Brand</b> {brands.find((b) => b.id === brandId)?.name}
            </Link>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">
          <div className="i" aria-hidden><IconCompass size={28} /></div>
          <p className="t">Nothing in {category.name} yet</p>
          <p className="d">This aisle is being restocked for the next call.</p>
          <Link className="btn ghost" href="/shop" prefetch={false}>
            Browse the whole store
          </Link>
        </div>
      ) : (
        <div className="pgrid">
          {items.map((p, i) => (
            <ProductCardView key={p.id} p={p} priority={i < 4} />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="stack">
          {sp.cursor && (
            <Link className="btn ghost back" href={keep({ cursor: null })} prefetch={false}>
              ← Back to start
            </Link>
          )}
          <Link className="btn ghost" href={keep({ cursor: nextCursor })} prefetch={false}>
            Next {PAGE_SIZE} →
          </Link>
        </div>
      )}
        </div>
      </div>
    </main>
  );
}
