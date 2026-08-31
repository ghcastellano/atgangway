"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "./Icon";

/**
 * A busca do cabeçalho, separada do resto dele.
 *
 * O motivo é técnico e vale registrar: useSearchParams obriga o Next a
 * renderizar no cliente tudo que estiver acima na árvore. Como o
 * cabeçalho vive no layout raiz, isso quebrava a pré-renderização do
 * 404. Isolada aqui e embrulhada num Suspense pelo cabeçalho, a
 * bailout fica contida neste campo.
 */
export default function HeaderSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlTerm = params.get("q") ?? "";
  const [q, setQ] = useState(urlTerm);

  // A busca da página saiu (duplicava esta). Então é esta caixa que
  // precisa mostrar o termo: quem digitou "powerbnk" corrige o que
  // está ali em vez de redigitar tudo.
  useEffect(() => setQ(urlTerm), [urlTerm]);

  return (
    <form
      className="sunsearch"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
      }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search entire store here…"
        aria-label="Search entire store"
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Search">
        <IconSearch />
      </button>
    </form>
  );
}
