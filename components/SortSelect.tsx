"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/** Ordenação preserva o resto da query e zera o cursor — página 3 de
 *  "mais baratos" não faz sentido depois de trocar para "mais novos". */
export default function SortSelect({
  value,
  options,
}: {
  value: string;
  options: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <select
      className="sortsel"
      value={value}
      aria-label="Sort products"
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.delete("cursor");
        if (e.target.value === "featured") p.delete("sort");
        else p.set("sort", e.target.value);
        const s = p.toString();
        router.push(s ? `${pathname}?${s}` : pathname);
      }}
    >
      {Object.entries(options).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}
