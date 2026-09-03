"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { BrandOption } from "@/lib/catalog";

/**
 * Filtro de marca para telas estreitas.
 *
 * Abaixo de 1024px o trilho de filtros (FacetRail) não existe — e com
 * ele sumia a única porta para ?brand=. No celular a pessoa só chegava
 * a uma marca por link de fora, e não tinha como trocar. Um <select>
 * ao lado da ordenação, no mesmo gesto do SortSelect: preserva o resto
 * da query e zera o cursor, porque página 3 de "Nescafé" não existe
 * depois de trocar para "Lacta".
 *
 * A partir de 1024px o CSS o esconde (.narrow-only): o trilho já lista
 * as marcas, e dois controles para o mesmo filtro confundem.
 */
export default function BrandSelect({
  brands,
  value,
}: {
  brands: BrandOption[];
  /** Slug da marca ativa; null = todas. */
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (brands.length === 0) return null;

  return (
    <select
      className="sortsel narrow-only"
      value={value ?? ""}
      aria-label="Filter by brand"
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.delete("cursor");
        if (e.target.value) p.set("brand", e.target.value);
        else p.delete("brand");
        const s = p.toString();
        router.push(s ? `${pathname}?${s}` : pathname);
      }}
    >
      <option value="">All brands</option>
      {brands.map((b) => (
        <option key={b.id} value={b.slug}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
