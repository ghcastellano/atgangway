"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import { imageUrl } from "@/lib/catalog";
import { usd } from "@/lib/money";
import { IconCart, IconClose, IconPackage, IconTrash } from "./Icon";

type Line = {
  id: string;
  sku: string;
  option_label: string | null;
  price_cents: number;
  image_path: string | null;
  active: boolean;
  products: { name: string; slug: string; primary_image_path: string | null; active: boolean } | null;
};

/**
 * Mini-carrinho, no gesto do Sunny: o ícone do carrinho abre um painel
 * pela direita em vez de navegar. Quem está no meio da listagem
 * confere o que já pôs sem perder o lugar — e volta a comprar com um
 * toque, que é o ponto todo.
 *
 * Só busca os dados quando abre. Um painel que consulta o banco a cada
 * item adicionado desperdiça a conexão de quem está no navio.
 */
export default function MiniCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, change, count } = useCart();
  const [lines, setLines] = useState<Line[] | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => Object.keys(items), [items]);

  useEffect(() => {
    if (!open) return;
    if (!supabaseConfigured || ids.length === 0) {
      setLines([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("product_variants")
      .select(
        `id, sku, option_label, price_cents, image_path, active,
         products!product_variants_product_id_fkey!inner(name, slug, primary_image_path, active)`
      )
      .in("id", ids)
      .then(({ data }) => {
        const linhas = (data ?? []) as unknown as Line[];
        setLines(linhas);
        // O carrinho vive no aparelho; o catálogo, no banco. Quando um
        // produto é desativado, o id guardado continua lá — e o selo do
        // cabeçalho dizia "1" sobre uma gaveta vazia, porque o selo
        // conta o localStorage e a gaveta conta o que ainda existe.
        // Item que o banco não devolve vivo sai do carrinho na hora.
        const vivos = new Set(linhas.filter((l) => l.active && l.products?.active).map((l) => l.id));
        for (const id of ids) {
          if (!vivos.has(id)) change(id, -(items[id] ?? 0));
        }
      });
  }, [open, ids.join(",")]);

  /**
   * Diálogo de verdade, não só role="dialog": o foco entra, fica e volta.
   *
   * Antes, Tab saía do painel e ia passear pela página escondida atrás
   * do véu — quem navega por teclado ou leitor de tela perdia o
   * carrinho sem fechá-lo. E ao fechar, o foco caía no <body>, longe do
   * botão que abriu. Agora Tab e Shift+Tab circulam dentro do painel, e
   * o fechamento devolve o foco a quem o abriu.
   */
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const inside = panel.current?.contains(document.activeElement) ?? false;
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Só devolve se o foco ainda estiver no painel (ou perdido): um
      // clique num link do carrinho já levou o foco para outra página.
      if (opener && opener.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        opener.focus();
      }
    };
  }, [open, onClose]);

  const rows = useMemo(
    () =>
      (lines ?? [])
        .filter((l) => l.active && l.products?.active)
        .map((l) => ({ ...l, qty: items[l.id] ?? 0 }))
        .filter((l) => l.qty > 0),
    [lines, items]
  );
  const subtotal = rows.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const totalQty = rows.reduce((s, l) => s + l.qty, 0);

  if (!open) return null;

  return (
    <>
      <button className="drawer-ovl" aria-label="Close cart" onClick={onClose} />
      <div className="minicart" ref={panel} role="dialog" aria-modal="true" aria-label="My Cart">
        {/* O que mudou, dito em voz alta: +/− e a lixeira alteram o
            subtotal sem mover o foco, e o leitor de tela não anuncia o
            que não está sob o cursor. polite: não interrompe o botão
            que a pessoa acabou de acionar. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {lines === null
            ? "Loading cart"
            : `${totalQty} ${totalQty === 1 ? "item" : "items"} in cart, subtotal ${usd(subtotal)}`}
        </p>
        <div className="minicart-top">
          <h2>My Cart</h2>
          <button className="minicart-x" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="minicart-list">
          {lines === null ? (
            <div className="spin" aria-label="Loading" />
          ) : rows.length === 0 ? (
            <div className="empty" style={{ padding: "48px 24px" }}>
              <div className="i" aria-hidden><IconCart size={26} /></div>
              <p className="t">Your cart is empty</p>
              <p className="d">Whatever you add waits here, all the way to the gangway.</p>
              <Link className="btn small ghost" href="/shop" onClick={onClose}>
                Start shopping
              </Link>
            </div>
          ) : (
            rows.map((l) => {
              const src = imageUrl(l.image_path ?? l.products?.primary_image_path);
              return (
                <div className="mcline" key={l.id}>
                  <Link href={`/p/${l.products?.slug}`} className="ci-thumb" onClick={onClose}>
                    {src ? <Image src={src} alt="" fill sizes="52px" style={{ objectFit: "contain" }} />
                         : <span aria-hidden><IconPackage size={22} /></span>}
                  </Link>
                  <div className="mcbody">
                    <div className="mchead">
                      <span className="nm">{l.products?.name}</span>
                      <b className="mono">{usd(l.price_cents * l.qty)}</b>
                    </div>
                    <span className="sku mono">Sku {l.sku}</span>
                    {l.option_label && <span className="sku">{l.option_label}</span>}
                    <div className="mcactions">
                      <div className="qty small">
                        <button onClick={() => change(l.id, -1)} aria-label="Less">−</button>
                        <span className="mono">{l.qty}</span>
                        <button onClick={() => change(l.id, 1)} aria-label="More">+</button>
                      </div>
                      <button
                        className="mcdel"
                        onClick={() => change(l.id, -l.qty)}
                        aria-label={`Remove ${l.products?.name}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* O rodapé só existe com item dentro: "Checkout" sobre carrinho
            vazio é um beco sem saída oferecido como ação primária. */}
        {rows.length > 0 && (
          <div className="minicart-foot">
            <div className="sumrow">
              <span>Subtotal</span>
              <b>{usd(subtotal)}</b>
            </div>
            <Link className="btn" href="/checkout" onClick={onClose}>
              Checkout
            </Link>
            <Link className="btn navy" href="/cart" onClick={onClose}>
              View and Edit Cart
            </Link>
            {count > 0 && (
              <p className="finehint" style={{ textAlign: "center", margin: "8px 0 0" }}>
                30% deposit now · balance at the gangway
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
