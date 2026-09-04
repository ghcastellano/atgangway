import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import type { BrandOption, CategoryNode } from "@/lib/catalog";

/**
 * Trilho de categorias da listagem, à esquerda, a partir de 1024px.
 *
 * Server Component de propósito: é navegação, não interação — zero JS
 * no navegador. O CategoryDrawer não servia porque é o hambúrguer do
 * celular, é client, e abre por cima da tela em vez de morar ao lado.
 *
 * Abre os filhos SÓ do ramo em que a pessoa está. A árvore inteira
 * aberta são 28 linhas de uma vez — vira parede, não navegação.
 */

/** Quantas marcas o trilho mostra sem precisar abrir. */
const MAIS_VISIVEIS = 8;

function ramoAberto(root: CategoryNode, activeSlug: string | null): boolean {
  if (!activeSlug) return false;
  if (root.slug === activeSlug) return true;
  const desce = (n: CategoryNode): boolean =>
    n.children.some((c) => c.slug === activeSlug || desce(c));
  return desce(root);
}

export default function FacetRail({
  tree,
  activeSlug,
  counts = {},
  brands = [],
  activeBrand = null,
  brandHref,
}: {
  tree: CategoryNode[];
  /** Slug da categoria aberta; null em /shop. */
  activeSlug: string | null;
  /** category_id → produtos ativos na subárvore (RPC category_counts). */
  counts?: Record<string, number>;
  /** Só marcas com produto ativo — filtro que devolve vazio é armadilha. */
  brands?: BrandOption[];
  activeBrand?: string | null;
  /** Monta a URL preservando o resto dos filtros. */
  brandHref?: (slug: string | null) => string;
}) {
  if (tree.length === 0) return null;

  // O trilho listava TODAS as marcas, em ordem de cadastro, sem número
  // e sem fim: em 1920px a lista passava da dobra e empurrava a coluna
  // inteira: quem rolava a página rolava um índice de fornecedor. Agora
  // aparecem as MAIS_VISIVEIS com mais produto (a ordem vem de
  // marcasEmUso), e as demais ficam atrás de "N more brands".
  //
  // A marca ATIVA entra na lista visível mesmo que seja a trigésima —
  // filtro ligado escondido dentro de um acordeão fechado é filtro que
  // a pessoa não consegue desligar.
  const visiveis = brands.slice(0, MAIS_VISIVEIS);
  const ativaEscondida =
    activeBrand && !visiveis.some((b) => b.slug === activeBrand)
      ? brands.find((b) => b.slug === activeBrand)
      : undefined;
  const aMostrar = ativaEscondida ? [ativaEscondida, ...visiveis] : visiveis;
  const resto = brands.filter((b) => !aMostrar.some((v) => v.id === b.id));

  return (
    <aside className="facets" aria-label="Filters">
      <div className="facet">
        <h2 className="facet-t">Categories</h2>
        <ul className="facet-l">
          <li>
            <Link href="/shop" className={activeSlug ? "" : "on"}>
              All products
            </Link>
          </li>
          {tree.map((root) => (
            <li key={root.id}>
              <Link href={`/c/${root.slug}`} className={root.slug === activeSlug ? "on" : ""}>
                {/* traço da casa, não o emoji cru do banco — era o último
                    lugar do storefront desktop com as duas caras coladas */}
                <CategoryIcon slug={root.slug} fallback={root.icon} size={18} />
                {root.name}
                {/* PRODUTOS na subárvore, não subcategorias. O número
                    antigo era children.length — "Food & Drinks 4" quando
                    a loja tinha 60 itens lá dentro. Número num filtro é
                    promessa do que o clique devolve; contar outra coisa
                    é promessa quebrada. */}
                {(counts[root.id] ?? 0) > 0 && <span className="ct">{counts[root.id]}</span>}
              </Link>
              {ramoAberto(root, activeSlug) && root.children.length > 0 && (
                <ul className="sub">
                  {root.children.map((c) => (
                    <li key={c.id}>
                      <Link href={`/c/${c.slug}`} className={c.slug === activeSlug ? "on" : ""}>
                        {c.name}
                        {(counts[c.id] ?? 0) > 0 && <span className="ct">{counts[c.id]}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Some inteira quando não há marca cadastrada — seção vazia lê
          como filtro quebrado. */}
      {brands.length > 0 && brandHref && (
        <div className="facet">
          <h2 className="facet-t">Brands</h2>
          <ul className="facet-l">
            {activeBrand && (
              <li>
                <Link href={brandHref(null)}>All brands</Link>
              </li>
            )}
            {aMostrar.map((b) => (
              <li key={b.id}>
                <Link
                  href={brandHref(b.slug === activeBrand ? null : b.slug)}
                  className={b.slug === activeBrand ? "on" : ""}
                >
                  {b.name}
                  <span className="ct">{b.count}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* O resto atrás de um <details>: sem JavaScript, e fechado
              por padrão porque o trilho é navegação lateral, não um
              índice do fornecedor. */}
          {resto.length > 0 && (
            <details className="facet-mais">
              <summary>
                {resto.length} more brand{resto.length === 1 ? "" : "s"}
              </summary>
              <ul className="facet-l">
                {resto.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={brandHref(b.slug === activeBrand ? null : b.slug)}
                      className={b.slug === activeBrand ? "on" : ""}
                    >
                      {b.name}
                      <span className="ct">{b.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </aside>
  );
}
