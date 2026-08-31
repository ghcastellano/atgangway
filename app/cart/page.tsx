"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import { imageUrl } from "@/lib/catalog";
import { DEPOSIT_PCT, splitOrder, toCents, usd } from "@/lib/money";
import { IconCart, IconPackage, IconTrash } from "@/components/Icon";

type Line = {
  id: string;
  sku: string;
  option_label: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock_qty: number;
  track_stock: boolean;
  image_path: string | null;
  active: boolean;
  products: {
    name: string;
    slug: string;
    primary_image_path: string | null;
    active: boolean;
  } | null;
};

/**
 * Carrinho na estrutura do Sunny: aviso de pedido mínimo, título,
 * cartão "Summary" com os dois botões dentro e, só então, a lista de
 * itens. O Summary vem ANTES da lista de propósito — é a ordem que a
 * tripulação já tem na memória, e quem abre o carrinho abre para ver
 * quanto deu, não para reler o que escolheu.
 *
 * O que era barra fixa (.cta-dock) saiu: os botões moram no Summary,
 * como lá. Uma barra fixa a mais só rouba altura de tela no celular.
 */
export default function CartPage() {
  const { items, change, ready } = useCart();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [minOrderCents, setMinOrderCents] = useState(0);
  const [creditCents, setCreditCents] = useState(0);
  const [minDismissed, setMinDismissed] = useState(false);

  const ids = useMemo(() => Object.keys(items), [items]);

  useEffect(() => {
    if (!ready) return;
    if (!supabaseConfigured || ids.length === 0) {
      setLines([]);
      return;
    }
    // Busca só as variantes do carrinho. Puxar o catálogo inteiro para
    // achar 3 linhas funciona com 12 SKUs e mata a página com 2 mil.
    const supabase = createClient();
    supabase
      .from("product_variants")
      .select(
        `id, sku, option_label, price_cents, compare_at_cents, stock_qty,
         track_stock, image_path, active,
         products!product_variants_product_id_fkey!inner(name, slug, primary_image_path, active)`
      )
      .in("id", ids)
      .then(({ data }) => {
        const linhas = (data ?? []) as unknown as Line[];
        setLines(linhas);
        // Mesma poda do MiniCart: id de produto desativado sai do
        // carrinho em vez de virar um fantasma que o selo conta e a
        // tela não mostra.
        const vivos = new Set(linhas.filter((l) => l.active && l.products?.active).map((l) => l.id));
        for (const id of ids) {
          if (!vivos.has(id)) change(id, -(items[id] ?? 0));
        }
      });
  }, [ready, ids.join(",")]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    // [otim] Mínimo do porto e saldo de crédito são buscados uma vez na
    // montagem, não a cada toque no stepper: nenhum dos dois depende do
    // que está no carrinho, e o wifi do navio não sobra.
    supabase
      .from("ports")
      .select("min_order_cents")
      .eq("slug", "santos")
      .maybeSingle()
      .then(({ data }) => setMinOrderCents(Number(data?.min_order_cents ?? 0)));
    // A RPC só é concedida a authenticated: visitante recebe erro e fica
    // em zero — carrinho de quem ainda não entrou não pode quebrar. E ela
    // devolve numeric em dólares, então passa por toCents.
    supabase.rpc("my_credit_balance").then(({ data }) => setCreditCents(toCents(data ?? 0)));
  }, []);

  const rows = useMemo(
    () =>
      (lines ?? [])
        .filter((l) => l.active && l.products?.active)
        .map((l) => ({ ...l, qty: items[l.id] ?? 0 }))
        .filter((l) => l.qty > 0),
    [lines, items]
  );

  // Item que saiu do ar entre a adição e agora: some da conta, mas o
  // cliente precisa saber por que — sumir calado é pior que avisar.
  const dropped = useMemo(
    () => (lines === null ? 0 : ids.length - rows.length),
    [lines, ids.length, rows.length]
  );

  const subtotal = rows.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const saved = rows.reduce(
    (s, l) => s + (l.compare_at_cents ? (l.compare_at_cents - l.price_cents) * l.qty : 0),
    0
  );
  const split = splitOrder(subtotal);
  // Porto sem mínimo cadastrado guarda 0: nesse caso o aviso nunca existe.
  const belowMin = minOrderCents > 0 && subtotal < minOrderCents;

  return (
    <main className="pg-cart">
      <Breadcrumb trail={[{ label: "Shopping Cart" }]} />

      {belowMin && !minDismissed && rows.length > 0 && (
        <div className="infobox">
          <span>Minimum order amount {usd(minOrderCents)}</span>
          <button onClick={() => setMinDismissed(true)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <h1 className="secttl left">Shopping Cart</h1>

      {/* O carrinho mora no aparelho, então o servidor não sabe o que
          tem dentro e o bloco só ganha altura depois da hidratação. Sem
          reservar espaço, o rodapé pulava ~200px — CLS de 0,13 no
          celular, acima do limite de 0,1 do Core Web Vitals. */}
      <div className="cartslot">
      {lines === null || !ready ? (
        <div className="spin" aria-label="Loading" />
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="i" aria-hidden><IconCart size={28} /></div>
          <p className="t">Your kit is empty, sailor</p>
          <p className="d">
            Provisions, gear and a taste of home — picked from your bunk,
            handed over at the gangway.
          </p>
          <Link className="btn" href="/shop">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <>
          <section className="sumcard" aria-label="Summary">
            <h3>Summary</h3>

            <div className="sumrow">
              <span>Products:</span>
              <b>{rows.length}</b>
            </div>

            {/* Onde o Sunny põe "Apply Discount Code" nós pomos o crédito
                Captain: é o mesmo lugar em que a pessoa já procura desconto,
                e aqui não há cupom para digitar.
                [otim] <details> nativo — recolhe sem estado e sem JS. */}
            <details className="disc">
              <summary>Apply Discount Code</summary>
              <div className="disc-body">
                <div className={`disc-line${creditCents > 0 ? "" : " zero"}`}>
                  <span>Captain credit</span>
                  <b>{usd(creditCents)}</b>
                </div>
                <p className="finehint">
                  {creditCents > 0
                    ? "Comes off your deposit at checkout — nothing to type in."
                    : "No credit on this account yet. Referral credit lands here and comes off your deposit at checkout."}
                </p>
              </div>
            </details>

            <div className="sumrow">
              <span>Subtotal</span>
              <b>{usd(subtotal)}</b>
            </div>

            {saved > 0 && (
              <div className="sumrow">
                <span>You save</span>
                <b style={{ color: "var(--teal)" }}>−{usd(saved)}</b>
              </div>
            )}

            <div className="sumrow grand">
              <span>Grand Total</span>
              <b>{usd(subtotal)}</b>
            </div>

            <Link className="btn" href="/checkout">
              Proceed to Checkout
            </Link>
            <Link className="btn navy" href="/shop">
              Return to shopping
            </Link>

            <p className="finehint">
              {DEPOSIT_PCT}% deposit now — {usd(split.deposit)}, charged in US dollars. Balance {usd(split.balance)} at the gangway;
              delivery on board is free. If your ship skips Santos, the deposit becomes full credit
              for your next call — no paperwork.
            </p>
          </section>

          {dropped > 0 && (
            <div className="stack">
              <p className="alert">
                {dropped} item{dropped === 1 ? "" : "s"} left the catalog since you added
                {dropped === 1 ? " it" : " them"} — removed from your order.
              </p>
            </div>
          )}

          <div className="cart-list">
            {rows.map((l) => {
              const src = imageUrl(l.image_path ?? l.products?.primary_image_path);
              const short = l.track_stock && l.stock_qty > 0 && l.stock_qty < l.qty;
              return (
                <div className="mcline" key={l.id}>
                  <Link href={`/p/${l.products?.slug}`} className="ci-thumb" prefetch={false}>
                    {src ? (
                      <Image src={src} alt="" fill sizes="(min-width: 1280px) 96px, (min-width: 1024px) 84px, 62px" style={{ objectFit: "contain" }} />
                    ) : (
                      <span aria-hidden><IconPackage size={26} /></span>
                    )}
                  </Link>

                  <div className="mcbody">
                    <div className="mchead">
                      <Link href={`/p/${l.products?.slug}`} className="nm" prefetch={false}>
                        {l.products?.name}
                      </Link>
                      <b className="mono">{usd(l.price_cents * l.qty)}</b>
                    </div>

                    <span className="sku mono">Sku {l.sku}</span>
                    {l.option_label && <span className="sku">{l.option_label}</span>}
                    <span className="sku mono">
                      {l.compare_at_cents ? <s>{usd(l.compare_at_cents)}</s> : null}{" "}
                      {usd(l.price_cents)} each
                    </span>
                    {short && (
                      <span className="sku" style={{ color: "var(--amber)" }}>
                        Only {l.stock_qty} left
                      </span>
                    )}

                    <div className="mcactions">
                      <div className="qty">
                        <button onClick={() => change(l.id, -1)} aria-label="Less">
                          −
                        </button>
                        <span className="mono">{l.qty}</span>
                        <button onClick={() => change(l.id, 1)} aria-label="More">
                          +
                        </button>
                      </div>
                      {/* mesmo traço da gaveta: o 🗑 era o único emoji
                          sobrando no fluxo de compra */}
                      <button
                        className="mcdel"
                        onClick={() => change(l.id, -l.qty)}
                        aria-label={`Remove ${l.products?.name ?? "item"}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>
    </main>
  );
}
