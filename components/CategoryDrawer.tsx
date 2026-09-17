"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import SairDaConta from "./SairDaConta";
import type { CategoryNode } from "@/lib/catalog";
import { whatsappLink } from "@/lib/env";
import { IconAnchor, IconCap, IconCart, IconClose, IconHeart, IconLogin, IconLogout, IconPackage, IconUser } from "./Icon";
import CategoryIcon from "./CategoryIcon";

/**
 * Drawer de categorias, no fluxo do Sunny: drill-down, não acordeão.
 *
 * A diferença importa. Acordeão empurra a lista para baixo e obriga a
 * rolar para achar onde estava; drill-down troca a tela inteira e o
 * "voltar" devolve exatamente ao ponto anterior. A tripulação já
 * aprendeu esse gesto no site deles — mudar custaria mais do que
 * qualquer ganho de tela.
 *
 * [otim] O que acrescentamos sem mexer no gesto: foco preso enquanto
 * aberto, fechar no Esc e aria-modal. No deles o foco escapa para a
 * página atrás, o que deixa quem navega por teclado perdido.
 */
export default function CategoryDrawer({
  open,
  onClose,
  tree,
  cartCount,
  wishCount = 0,
  signedIn = false,
}: {
  open: boolean;
  onClose: () => void;
  tree: CategoryNode[];
  cartCount: number;
  /** Conta e lista saíram do cabeçalho no celular e vivem aqui. */
  wishCount?: number;
  signedIn?: boolean;
}) {
  const [stack, setStack] = useState<CategoryNode[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const current = stack[stack.length - 1] ?? null;
  const list = current ? current.children : tree;

  // Reabrir sempre começa na raiz: ninguém espera voltar no meio de
  // uma árvore que fechou faz meia hora.
  useEffect(() => {
    if (!open) setStack([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const title = useMemo(() => current?.name ?? null, [current]);
  if (!open) return null;

  return (
    <>
      <button className="drawer-ovl" aria-label="Close menu" onClick={onClose} />
      <div
        className="drawer"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title ? `${title} categories` : "Categories"}
      >
        <div className="drawer-top">
          <Link href="/" className="sunlogo" onClick={onClose} aria-label="At Gangway — home">
            <IconAnchor className="mark" />
            <span className="word">
              <span className="l1">At</span>
              <span className="l2">Gangway</span>
            </span>
          </Link>
          <button className="drawer-x" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="drawer-list">
          {current && (
            <>
              <button
                className="drawer-back"
                onClick={() => setStack((s) => s.slice(0, -1))}
              >
                ‹ {current.name}
              </button>
              <Link className="drawer-item" href={`/c/${current.slug}`} onClick={onClose}>
                <span className="nm">See all {current.name}</span>
              </Link>
            </>
          )}

          {list.map((c) =>
            c.children.length > 0 ? (
              <button key={c.id} className="drawer-item" onClick={() => setStack((s) => [...s, c])}>
                <CategoryIcon slug={c.slug} fallback={c.icon} size={19} />
                <span className="nm">{c.name}</span>
                <span className="chev" aria-hidden>›</span>
              </button>
            ) : (
              <Link key={c.id} className="drawer-item" href={`/c/${c.slug}`} onClick={onClose}>
                <CategoryIcon slug={c.slug} fallback={c.icon} size={19} />
                <span className="nm">{c.name}</span>
              </Link>
            )
          )}

          {!current && (
            <>
              {/* Mesmo traço das categorias logo acima: emoji aqui era a
                  única fileira do painel fora da família de ícones. */}
              <Link className="drawer-item" href="/orders" onClick={onClose}>
                <IconPackage className="ic" size={19} />
                <span className="nm">My Orders</span>
              </Link>
              <Link className="drawer-item" href="/captain" onClick={onClose}>
                <IconCap className="ic" size={19} />
                <span className="nm">Captain rewards</span>
              </Link>
              <Link className="drawer-item" href="/wishlist" onClick={onClose}>
                <IconHeart className="ic" size={19} />
                <span className="nm">My Wish List</span>
                {wishCount > 0 && <span className="drawer-count">{wishCount}</span>}
              </Link>
              <Link className="drawer-item" href="/account" onClick={onClose}>
                <IconUser className="ic" size={19} />
                <span className="nm">My Account</span>
              </Link>
              {/* Sair é AÇÃO, não link: apaga o cookie no servidor.
                  E, ao contrário dos links vizinhos, NÃO fecha a gaveta
                  no clique: fechar desmonta o <form> e a Server Action
                  morre com ele — a pessoa apertava sair e continuava
                  dentro. A gaveta fecha na navegação. */}
              {signedIn ? (
                <SairDaConta className="drawer-item">
                  <IconLogout className="ic" size={19} />
                  <span className="nm">Sign out</span>
                </SairDaConta>
              ) : (
                <Link className="drawer-item" href="/login" onClick={onClose}>
                  <IconLogin className="ic" size={19} />
                  <span className="nm">Sign in</span>
                </Link>
              )}
            </>
          )}
        </div>

        <div className="drawer-foot">
          <p className="drawer-ajuda">
            Need a hand?{" "}
            <a
              href={whatsappLink(
                "Hi! I'm on atgangway.com and I have a question about supplies for my vessel."
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp us
            </a>
          </p>
          <Link className="btn" href="/cart" onClick={onClose}>
            <IconCart size={18} /> Shopping Cart{cartCount > 0 ? ` · ${cartCount}` : ""}
          </Link>
        </div>
      </div>
    </>
  );
}
