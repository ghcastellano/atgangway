"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * O número do coração no cabeçalho, vivo no navegador.
 *
 * Antes ele só existia no servidor: marcar um favorito disparava
 * `revalidatePath("/", "layout")` — a árvore INTEIRA do site era
 * redesenhada no servidor para mudar um dígito no cabeçalho — e o
 * dígito só aparecia quando essa resposta chegava, segundos depois no
 * wifi do navio. Era a lentidão do coração.
 *
 * Agora o servidor semeia o número uma vez (WishSeed, no cabeçalho) e
 * o botão do coração soma ou subtrai na hora, otimista, como o
 * carrinho já fazia. Se o servidor recusar, o botão devolve o número.
 */
type WishState = {
  count: number;
  /** Soma (ou subtrai) ao selo, sem esperar o servidor. */
  bump: (delta: number) => void;
  /** Valor vindo do servidor: vence o que o navegador acumulou. */
  seed: (n: number) => void;
};

const WishContext = createContext<WishState | null>(null);

export function WishProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const bump = useCallback((d: number) => setCount((c) => Math.max(0, c + d)), []);
  const seed = useCallback((n: number) => setCount(Math.max(0, n)), []);
  const value = useMemo(() => ({ count, bump, seed }), [count, bump, seed]);
  return <WishContext.Provider value={value}>{children}</WishContext.Provider>;
}

export function useWish(): WishState {
  const ctx = useContext(WishContext);
  if (!ctx) throw new Error("useWish must be used inside <WishProvider>");
  return ctx;
}

/** O servidor conta; o navegador guarda. Renderiza nada. */
export function WishSeed({ count }: { count: number }) {
  const { seed } = useWish();
  useEffect(() => seed(count), [count, seed]);
  return null;
}
