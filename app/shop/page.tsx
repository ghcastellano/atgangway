import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import ProductCardView from "@/components/ProductCard";
import FacetRail from "@/components/FacetRail";
import CategoryIcon from "@/components/CategoryIcon";
import { IconCompass } from "@/components/Icon";
import {
  categoriasAtivas,
  contagensPorCategoria,
  contagensPorSelo,
  listarProdutos,
  marcasEmUso,
} from "@/lib/vitrine";
import {
  BADGE_LABEL,
  buildTree,
  PAGE_SIZE,
  SORT_LABEL,
  type SortKey,
} from "@/lib/catalog";
import SortSelect from "@/components/SortSelect";
import BrandSelect from "@/components/BrandSelect";

// A vitrine muda pouco e é lida muito. O catálogo vem de unstable_cache
// (lib/vitrine, tag "catalog", 300 s); a única coisa por visitante é o
// coração da lista de desejos, e só para quem está logado.
export const revalidate = 300;

/** Coleções são curadorias sobre a MESMA prateleira (o item de New
 *  Arrivals também mora em Coffee & Tea). Entrar na soma seria contar
 *  o mesmo produto duas vezes — o rótulo dizia 96 numa loja de 81. */
const COLECOES = new Set(["new-arrivals", "promo", "outlet"]);

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; cursor?: string; badge?: string; brand?: string }>;
}) {
  const sp = await searchParams;
  const sort = (sp.sort as SortKey) ?? "featured";
  const query = sp.q?.trim() || null;

  // Tudo abaixo é catálogo público e vem do cache (lib/vitrine): a
  // página deixou de refazer cinco consultas por visita. As marcas vêm
  // antes porque a RPC recebe UUID e a URL carrega slug.
  const brands = await marcasEmUso();
  const brandId = sp.brand ? (brands.find((b) => b.slug === sp.brand)?.id ?? null) : null;

  const [{ items, nextCursor }, cats, counts, selos] = await Promise.all([
    listarProdutos({
      query,
      sort,
      cursor: sp.cursor ?? null,
      badge: sp.badge ?? null,
      brand: brandId,
    }),
    categoriasAtivas(),
    contagensPorCategoria(),
    contagensPorSelo({ brand: brandId, query }),
  ]);
  const selosDisponiveis = (["promo", "new", "outlet"] as const).filter((b) => (selos[b] ?? 0) > 0);

  // O coração precisa nascer no estado certo, senão parece que não salvou.

  const roots = buildTree(cats);
  const keep = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (sort !== "featured") p.set("sort", sort);
    if (sp.badge) p.set("badge", sp.badge);
    if (sp.brand) p.set("brand", sp.brand);
    for (const [k, v] of Object.entries(extra)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  return (
    <main className="pg-list">
      {/* Sem caixa de busca na página: a do cabeçalho global é a mesma do
          Sunny, e duas na mesma tela dividem o gesto ao meio. */}
      <Breadcrumb
        trail={
          query
            ? [{ label: "Shop", href: "/shop" }, { label: `“${query}”` }]
            : [{ label: "Shop" }]
        }
      />
      <h1 className="secttl left">{query ? `“${query}”` : "Shop"}</h1>

      {/* Duas colunas a partir de 1024px: trilho de categorias à
          esquerda, lista à direita. Abaixo disso o CSS achata tudo de
          volta numa coluna e o trilho some — o celular não muda. */}
      <div className="shop-body">
        <FacetRail
          tree={roots}
          activeSlug={null}
          counts={counts}
          brands={brands}
          activeBrand={brandId ? (sp.brand ?? null) : null}
          brandHref={(b) => keep({ brand: b, cursor: null })}
        />
        <div className="listcol">

      {!query && !sp.cursor && !sp.badge && (
        <>
          <p className="subhead">Browse</p>
          <div className="catgrid">
            {roots.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`} className="catcard" prefetch={false}>
                {/* mesmo traço da home: o emoji do banco fica de retaguarda */}
                <CategoryIcon slug={c.slug} fallback={c.icon} size={22} />
                <span className="tx">
                  <span className="nm">{c.name}</span>
                  {/* Era `{c.children.length} sections`, que dava
                      "1 sections" em Connectivity — plural errado numa
                      tela que a pessoa vê antes de qualquer produto — e
                      contava SUBCATEGORIAS, enquanto o trilho ao lado
                      contava produtos. Dois números diferentes para a
                      mesma categoria, na mesma página. Agora é um só, e
                      é o que o clique devolve. */}
                  {(counts[c.id] ?? 0) > 0 && (
                    <span className="ct">
                      {counts[c.id]} item{counts[c.id] === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="listbar">
        <span className="count">
          {/* O total REAL, não "All products": rótulo sem número numa
              página que corta em 48 alimenta a leitura de catálogo
              sumido. A soma sai das contagens por subárvore das raízes,
              a mesma fonte dos números do trilho. */}
          {query
            ? `${items.length} result${items.length === 1 ? "" : "s"}`
            : `${roots.reduce(
                (s, r) => (COLECOES.has(r.slug) ? s : s + (counts[r.id] ?? 0)),
                0
              )} products`}
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

      {/* O que está filtrando agora, e como sair. Sem isto, quem chega
          por link com ?badge= não descobre por que a lista é curta. */}
      {/* A BUSCA saiu daqui. Ela aparecia em quatro lugares na mesma
          tela — migalha, título, caixa de busca do cabeçalho (que fica
          preenchida) e este chip —, e no celular era a quarta faixa de
          controle antes do primeiro produto, numa tela de 844px. Selo e
          marca ficam, porque chega gente por link com ?badge= e sem o
          chip não há como descobrir por que a lista é curta. */}
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
          {query ? (
            <>
              <p className="t">Nothing matches “{query}”</p>
              <p className="d">
                Check the spelling or try the brand name — or steer by
                category from the menu.
              </p>
              <Link className="btn ghost" href="/shop" prefetch={false}>
                Clear the search
              </Link>
            </>
          ) : (
            <>
              <p className="t">The shelves are being stocked</p>
              <p className="d">Check back shortly — supplies land before every call.</p>
            </>
          )}
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
          {/* "Load 24 more" mentia: a paginação é keyset, então a página
              seguinte SUBSTITUI as 24 anteriores, não soma. */}
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
