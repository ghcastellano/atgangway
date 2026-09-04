"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * O carrinho guarda ITENS, e só.
 *
 * Guardava também um navio (`ship` / `setShip`), do desenho antigo em
 * que a pessoa escolhia a escala dentro do carrinho. O navio mudou de
 * casa faz tempo — mora no perfil, é o `profiles.ship_id`, e é de lá
 * que o checkout o lê. Ninguém escrevia nem lia este campo havia
 * versões; ele só continuava sendo serializado no localStorage de todo
 * visitante e aparecendo na assinatura do contexto, onde lê como se
 * ainda fosse a fonte da verdade. Dois lugares dizendo qual é o navio é
 * como o pedido chega no navio errado.
 *
 * Carrinho antigo com a chave `ship` continua sendo lido sem erro: o
 * campo simplesmente é ignorado, e a próxima gravação o remove.
 */
type CartState = {
  ready: boolean;
  items: Record<string, number>; // variant_id -> qty
  add: (variantId: string, qty?: number) => void;
  change: (variantId: string, delta: number) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartState | null>(null);

// v2: as chaves passaram de produto para variante — é a variante que
// tem preço e estoque. Carrinho antigo é descartado em vez de migrado:
// os ids não se traduzem, e ressuscitar um carrinho errado é pior que
// um carrinho vazio.
const LS_KEY = "ms.cart.v2";

type Persisted = { items: Record<string, number> };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Persisted;
        if (data.items) setItems(data.items);
      }
    } catch {
      // storage indisponível (modo privado etc.) — segue com estado em memória
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ items } satisfies Persisted));
    } catch {
      // sem persistência — ok
    }
  }, [ready, items]);

  const add = useCallback((id: string, qty = 1) => {
    setItems((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + Math.max(1, qty) }));
  }, []);

  const change = useCallback((id: string, delta: number) => {
    setItems((prev) => {
      const next = { ...prev };
      const q = (next[id] ?? 0) + delta;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const count = useMemo(() => Object.values(items).reduce((a, b) => a + b, 0), [items]);

  const value = useMemo(
    () => ({ ready, items, add, change, clear, count }),
    [ready, items, add, change, clear, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
