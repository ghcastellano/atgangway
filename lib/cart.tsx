"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHAVE_CARRINHO } from "@/lib/chaves";
import { createClient } from "@/lib/supabase/client";
import { reconciliar } from "@/lib/carrinho-dono";

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
  /** Ao sair da conta: esvazia e desvincula (ver <SairDaConta/>). */
  esquecerDono: () => void;
  count: number;
};

const CartContext = createContext<CartState | null>(null);

// v2: as chaves passaram de produto para variante — é a variante que
// tem preço e estoque. Carrinho antigo é descartado em vez de migrado:
// os ids não se traduzem, e ressuscitar um carrinho errado é pior que
// um carrinho vazio.
// O nome mora em lib/chaves.ts, que também migra o do prefixo antigo.
const LS_KEY = CHAVE_CARRINHO;

// `dono`: a conta a quem o carrinho pertence (null = visitante). Carrinho
// gravado antes deste campo é lido como de visitante. Ver lib/carrinho-dono.
type Persisted = { items: Record<string, number>; dono?: string | null };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Record<string, number>>({});
  const dono = useRef<string | null>(null);

  useEffect(() => {
    let guardado: Persisted = { items: {} };
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) guardado = JSON.parse(raw) as Persisted;
    } catch {
      // storage indisponível (modo privado etc.) — segue com estado em memória
    }
    const supabase = createClient();
    // getSession lê o cookie local, sem rede: aqui só importa QUEM é, para
    // não mostrar a uma conta o carrinho de outra.
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setItems(reconciliar({ items: guardado.items ?? {}, dono: guardado.dono ?? null }, uid));
      dono.current = uid;
      setReady(true);
    });
    // Login na mesma aba (senha ou Google) chega por aqui. Sair da conta
    // não chega — o cookie morre no servidor — e é <SairDaConta/> quem limpa.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      const uid = session?.user.id ?? null;
      if (uid === dono.current) return;
      setItems((prev) => {
        const proximos = reconciliar({ items: prev, dono: dono.current }, uid);
        dono.current = uid;
        // Grava aqui também: quando o visitante entra, os itens não mudam
        // e o efeito de persistência não roda — o dono ficaria null no
        // storage, e a próxima conta herdaria o carrinho.
        gravar(proximos);
        return proximos;
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready) gravar(items);
  }, [ready, items]);

  function gravar(itens: Record<string, number>) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ items: itens, dono: dono.current } satisfies Persisted));
    } catch {
      // sem persistência — ok
    }
  }

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
  // Sair da conta: o carrinho volta a ser de ninguém, e vazio.
  const esquecerDono = useCallback(() => {
    dono.current = null;
    setItems({});
  }, []);

  const count = useMemo(() => Object.values(items).reduce((a, b) => a + b, 0), [items]);

  const value = useMemo(
    () => ({ ready, items, add, change, clear, esquecerDono, count }),
    [ready, items, add, change, clear, esquecerDono, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
