"use client";

import Link from "next/link";
import { signOut } from "@/app/account/actions";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import CategoryDrawer from "./CategoryDrawer";
import HeaderSearch from "./HeaderSearch";
import MiniCart from "./MiniCart";
import { IconAnchor, IconCart, IconHeart, IconMenu, IconUser } from "./Icon";
import { useCart } from "@/lib/cart";
import { useWish } from "@/lib/wish";
import type { CategoryNode } from "@/lib/catalog";

/**
 * Cabeçalho na estrutura do Sunny: barra de anúncio, depois a fileira
 * hambúrguer / logo / conta / wishlist / carrinho, depois a busca de
 * largura cheia.
 *
 * A ordem dos ícones e a busca embaixo são o que a tripulação já tem
 * na memória muscular. Não é lugar para criatividade.
 */
export default function SiteHeader({ tree }: { tree: CategoryNode[] }) {
  const { count, ready } = useCart();
  // Favoritos e sessão: semeados uma vez pelo servidor (SessaoSeed),
  // atualizados na hora pelo coração. `signedIn` era prop e virou
  // contexto porque saber quem está logado exige ler cookie — e ler
  // cookie aqui, no layout raiz, tornava dinâmica cada página do site.
  const { count: wishCount, logado } = useWish();
  const [drawer, setDrawer] = useState(false);
  const [cart, setCart] = useState(false);
  const [menu, setMenu] = useState(false);
  const acct = useRef<HTMLDivElement>(null);
  // Barra horizontal de categorias: só existe no desktop/iPad, mas o
  // estado mora aqui porque o markup é o mesmo — o CSS é que esconde.
  const [mega, setMega] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);
  // usePathname não provoca o bailout de pré-render que o
  // useSearchParams provoca — por isso ele pode viver aqui, e o
  // HeaderSearch continua isolado no <Suspense>.
  const path = usePathname();

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (acct.current && !acct.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!mega) return;
    const onDown = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setMega(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mega]);

  // Navegou: fecha. Sem isto o painel fica aberto por cima da página nova.
  useEffect(() => setMega(null), [path]);

  return (
    <>
      <Link className="announce" href="/brochures">
        View Catalog &amp; Flyers
      </Link>

      <header className="sunhead sup-escura">
        <div className="sunhead-row">
          <button className="hamb" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
            ☰
            <span className="hamb-label">All Categories</span>
          </button>

          {/* O nome acessível precisa CONTER o texto visível (WCAG 2.5.3).
              Os dois spans colavam em "AtGangway" — sem o espaço, e
              com o travessão no aria-label, nada batia: quem usa comando
              de voz dizia "clicar At Gangway" e não achava o link. */}
          <Link href="/" className="sunlogo" aria-label="At Gangway home">
            <IconAnchor className="mark" />
            <span className="word">
              <span className="l1">At</span>{" "}
              <span className="l2">Gangway</span>
            </span>
          </Link>

          <div className="headicons">
            <div className="acctwrap" ref={acct}>
              <button
                className="headicon"
                onClick={() => setMenu((m) => !m)}
                aria-label="Account menu"
                aria-expanded={menu}
              >
                <IconUser />
              </button>
              {menu && (
                <div className="acctmenu" role="menu">
                  <Link href="/account" role="menuitem" onClick={() => setMenu(false)}>My Account</Link>
                  <Link href="/orders" role="menuitem" onClick={() => setMenu(false)}>My Orders</Link>
                  <Link href="/captain" role="menuitem" onClick={() => setMenu(false)}>Captain rewards</Link>
                  <Link href="/wishlist" role="menuitem" onClick={() => setMenu(false)}>My Wish List</Link>
                  <hr />
                  {/* Um item só, "Sign in / Sign out", era um link para
                      /login: quem estava logado clicava e voltava para a
                      mesma tela, sem sair. Sair é uma AÇÃO — precisa
                      apagar o cookie no servidor, e por isso é um form,
                      não um link. */}
                  {/* `logado` nasce null: ainda não sabemos. Desenhar
                      "Sign in" nesse instante faria quem TEM sessão
                      achar que caiu — então o item nasce neutro e só
                      assume um dos dois quando a resposta chega. */}
                  {logado === null ? (
                    <span className="acctwait" aria-hidden>
                      &nbsp;
                    </span>
                  ) : logado ? (
                    <form action={signOut}>
                      <button type="submit" role="menuitem" onClick={() => setMenu(false)}>
                        Sign out
                      </button>
                    </form>
                  ) : (
                    <Link href="/login" role="menuitem" onClick={() => setMenu(false)}>
                      Sign in
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* O selo repete o que o carrinho já fazia. Sem ele o ♡ era
                mudo: dois itens guardados e nenhum sinal na tela — a
                pessoa abria a lista para descobrir se tinha algo. */}
            <Link
              href="/wishlist"
              className="headicon"
              aria-label={wishCount > 0 ? `Wish list, ${wishCount} items` : "Wish list"}
            >
              <IconHeart />
              {wishCount > 0 && <span className="cartbadge wishcount">{wishCount}</span>}
            </Link>

            {/* No Sunny o ícone abre o mini-carrinho em vez de navegar:
                quem está no meio da listagem confere sem perder o lugar. */}
            <button
              className="headicon"
              onClick={() => setCart(true)}
              aria-label={`Cart${ready && count > 0 ? `, ${count} items` : ""}`}
              aria-expanded={cart}
            >
              <IconCart />
              {ready && count > 0 && <span className="cartbadge">{count}</span>}
            </button>
          </div>
        </div>

        {/* Suspense porque useSearchParams força render no cliente de
            tudo acima na árvore — e o cabeçalho mora no layout raiz. */}
        <Suspense fallback={<div className="sunsearch" aria-hidden />}>
          <HeaderSearch />
        </Suspense>

        {/* Barra de categorias do desktop. No celular ela existe no
            HTML mas o CSS a esconde — e o painel só é RENDERIZADO
            quando aberto, então o celular não carrega árvore de
            submenu nenhuma. */}
        <nav
          className="catbar"
          aria-label="Product categories"
          ref={bar}
          onPointerLeave={(e) => e.pointerType === "mouse" && setMega(null)}
        >
          <ul className="catbar-list">
            {tree.map((c) => {
              const hot = c.slug === "promo" || c.slug === "outlet" || c.slug === "new-arrivals";
              const cls = `catlink${hot ? " hot" : ""}${path.startsWith(`/c/${c.slug}`) ? " on" : ""}`;
              return (
                <li key={c.id} className="catwrap">
                  {c.children.length > 0 ? (
                    <>
                      {/* Rótulo é LINK, seta é botão.
                          Era um botão só, que abria o painel e mais nada:
                          para ver "Connectivity" inteira era preciso abrir
                          o painel e achar "See all Connectivity" no rodapé
                          dele. Numa loja, clicar no nome da seção vai para
                          a seção — é o que Amazon, Zara e Mercado Livre
                          fazem, e é o que a pessoa espera. A seta continua
                          existindo para quem quer o submenu sem sair da
                          página, e é ela que carrega o aria-expanded. */}
                      <span
                        className={`catgroup${mega === c.id ? " open" : ""}`}
                        onPointerEnter={(e) => e.pointerType === "mouse" && setMega(c.id)}
                      >
                        <Link className={cls} href={`/c/${c.slug}`} onClick={() => setMega(null)}>
                          {c.name}
                        </Link>
                        <button
                          type="button"
                          className="cchev"
                          aria-haspopup="true"
                          aria-expanded={mega === c.id}
                          aria-label={`${c.name} subcategories`}
                          onClick={() => setMega((m) => (m === c.id ? null : c.id))}
                        >
                          <span aria-hidden>▾</span>
                        </button>
                      </span>
                      {mega === c.id && (
                        <div className="megapanel" role="group" aria-label={c.name}>
                          <div className="megagrid">
                            {c.children.map((s) => (
                              <div key={s.id} className="megacol">
                                <Link className="megahead" href={`/c/${s.slug}`} onClick={() => setMega(null)}>
                                  {s.name}
                                </Link>
                                {s.children.map((g) => (
                                  <Link key={g.id} className="megalink" href={`/c/${g.slug}`} onClick={() => setMega(null)}>
                                    {g.name}
                                  </Link>
                                ))}
                              </div>
                            ))}
                          </div>
                          <Link className="megaall" href={`/c/${c.slug}`} onClick={() => setMega(null)}>
                            See all {c.name} →
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link className={cls} href={`/c/${c.slug}`}>
                      {c.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <CategoryDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        tree={tree}
        cartCount={count}
        wishCount={wishCount}
        signedIn={logado === true}
      />
      <MiniCart open={cart} onClose={() => setCart(false)} />
    </>
  );
}
