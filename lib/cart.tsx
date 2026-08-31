"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartShip = {
  id: string;
  name: string;
  berth: string | null;
  eta: string;
  cutoff_hours: number;
};

type CartState = {
  ready: boolean;
  ship: CartShip | null;
  items: Record<string, number>; // variant_id -> qty
  setShip: (ship: CartShip | null) => void;
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

type Persisted = { ship: CartShip | null; items: Record<string, number> };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ship, setShipState] = useState<CartShip | null>(null);
  const [items, setItems] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Persisted;
        if (data.ship) setShipState(data.ship);
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
      localStorage.setItem(LS_KEY, JSON.stringify({ ship, items } satisfies Persisted));
    } catch {
      // sem persistência — ok
    }
  }, [ready, ship, items]);

  const setShip = useCallback((s: CartShip | null) => setShipState(s), []);

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
    () => ({ ready, ship, items, setShip, add, change, clear, count }),
    [ready, ship, items, setShip, add, change, clear, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
