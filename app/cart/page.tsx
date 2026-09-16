"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import { imageUrl } from "@/lib/catalog";
import { DEPOSIT_PCT, faltaParaMinimo, splitOrder, toCents, usd } from "@/lib/money";
import { IconCart, IconPackage, IconTrash } from "@/components/Icon";
import { callState, canOrder, type CallState } from "@/lib/callstate";

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
  // A janela da escala do perfil. O carrinho é a última tela antes do
  // checkout: mandar para lá com a escala morta é fazer a pessoa
  // trabalhar por um "não". Aqui o botão já vira o próximo passo.
  const [callSt, setCallSt] = useState<CallState | null>(null);
  /**
   * A leitura das linhas não voltou.
   *
   * O carrinho tinha o mesmo defeito que o checkout tinha: um `.then()`
   * sem par. No wifi de bordo a conexão não RECUSA — ela pendura, e uma
   * promessa que nunca resolve deixa `lines` em null para sempre. O que
   * a pessoa via era um giro no meio de uma página em branco, sem
   * explicação e sem saída, na tela em que ela já escolheu o que quer
   * comprar. Ela não tem como saber se perdeu o carrinho.
   */
  const [falhaCarga, setFalhaCarga] = useState(false);

  const ids = useMemo(() => Object.keys(items), [items]);

  useEffect(() => {
    if (!ready) return;
    if (!supabaseConfigured || ids.length === 0) {
      setLines([]);
      return;
    }
    // Busca só as variantes do carrinho. Puxar o catálogo inteiro para
    // achar 3 linhas funciona com 12 SKUs e mata a página com 2 mil.
    //
    // 12 segundos de teto: o builder do Supabase devolve um PromiseLike
    // sem `.catch`, então o try/catch é obrigatório, e `abortSignal` é o
    // que transforma "pendurado" em "falhou" — sem ele não há erro para
    // capturar, só espera.
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), 12_000);
    let cancelado = false;
    setFalhaCarga(false);

    (async () => {
      try {
        const { data, error } = await createClient()
          .from("product_variants")
          .select(
            `id, sku, option_label, price_cents, compare_at_cents, stock_qty,
             track_stock, image_path, active,
             products!product_variants_product_id_fkey!inner(name, slug, primary_image_path, active)`
          )
          .in("id", ids)
          .abortSignal(ctl.signal);
        if (cancelado) return;
        if (error) {
          setFalhaCarga(true);
          return;
        }
        const linhas = (data ?? []) as unknown as Line[];
        setLines(linhas);
        // Mesma poda do MiniCart: id de produto desativado sai do
        // carrinho em vez de virar um fantasma que o selo conta e a
        // tela não mostra.
        const vivos = new Set(linhas.filter((l) => l.active && l.products?.active).map((l) => l.id));
        for (const id of ids) {
          if (!vivos.has(id)) change(id, -(items[id] ?? 0));
        }
      } catch {
        if (!cancelado) setFalhaCarga(true);
      } finally {
        clearTimeout(relogio);
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(relogio);
      ctl.abort();
    };
  }, [ready, ids.join(",")]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    // [otim] Mínimo do porto, saldo de crédito e escala são buscados uma
    // vez na montagem, não a cada toque no stepper: nenhum depende do
    // que está no carrinho, e o wifi do navio não sobra.
    //
    // As três são ACESSÓRIAS: falharam, a página segue com o valor
    // neutro. O que elas não podem é ficar penduradas nem estourar
    // rejeição sem dono — eram três `.then()` sem par. 10 s e um
    // try/catch cada, dentro do mesmo sinal de aborto.
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), 10_000);
    let cancelado = false;
    const supabase = createClient();

    (async () => {
      try {
        const { data } = await supabase
          .from("ports")
          .select("min_order_cents")
          .eq("slug", "santos")
          .abortSignal(ctl.signal)
          .maybeSingle();
        if (!cancelado) setMinOrderCents(Number(data?.min_order_cents ?? 0));
      } catch {
        // segue com mínimo zero: o guard de servidor no checkout decide.
      }
    })();

    // A RPC só é concedida a authenticated: visitante recebe erro e fica
    // em zero — carrinho de quem ainda não entrou não pode quebrar. E ela
    // devolve numeric em dólares, então passa por toCents.
    (async () => {
      try {
        const { data } = await supabase.rpc("my_credit_balance").abortSignal(ctl.signal);
        if (!cancelado) setCreditCents(toCents(data ?? 0));
      } catch {
        // sem crédito na tela; o valor real é aplicado no servidor.
      }
    })();

    // Estado da escala do próprio perfil. Visitante deslogado não tem
    // escala e segue vendo o carrinho normal — o portão dele é o login.
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("ships!profiles_ship_id_fkey(eta, ata, cutoff_hours)")
          .abortSignal(ctl.signal)
          .maybeSingle();
        const nav = (data as { ships: { eta: string; ata: string | null; cutoff_hours: number | null } | null } | null)?.ships;
        if (!cancelado && nav?.eta) {
          setCallSt(callState({ eta: nav.eta, ata: nav.ata, cutoff_hours: nav.cutoff_hours }));
        }
      } catch {
        // escala desconhecida segue para o checkout: a UI antecipa o
        // "não", não o inventa.
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(relogio);
      ctl.abort();
    };
  }, []);

  // Só bloqueia quando SABE que a janela morreu. Estado desconhecido
  // (deslogado, sem escala, leitura falhou) segue para o checkout, que
  // tem o guard de servidor — a UI antecipa o "não", não o inventa.
  const janelaMorta = callSt !== null && !canOrder(callSt);

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
  const { below: belowMin, label: avisoMin } = faltaParaMinimo(subtotal, minOrderCents);

  return (
    <main className="pg-cart">
      <Breadcrumb trail={[{ label: "Shopping Cart" }]} />

      {/* O aviso não tem mais o ✕: dispensável, ele sumia levando junto a
          única pista do mínimo — e o botão de checkout seguia ativo. Quem
          decide é o CTA lá embaixo; este box só antecipa o número. */}
      {belowMin && rows.length > 0 && (
        <div className="infobox">
          <span>Minimum order amount {usd(minOrderCents)}</span>
        </div>
      )}

      <h1 className="secttl left">Shopping Cart</h1>

      {/* O carrinho mora no aparelho, então o servidor não sabe o que
          tem dentro e o bloco só ganha altura depois da hidratação. Sem
          reservar espaço, o rodapé pulava ~200px — CLS de 0,13 no
          celular, acima do limite de 0,1 do Core Web Vitals. */}
      <div className="cartslot">
      {falhaCarga ? (
        /* O que a pessoa precisa saber, nesta ordem: que não foi ela,
           que o carrinho continua guardado, e o que fazer agora. */
        <div className="empty">
          <div className="i" aria-hidden><IconCart size={28} /></div>
          <p className="t">We couldn&apos;t load your cart</p>
          <p className="d">
            The connection didn&apos;t answer. Nothing was lost — your{" "}
            {ids.length} item{ids.length === 1 ? "" : "s"} {ids.length === 1 ? "is" : "are"} still
            saved on this device.
          </p>
          <button className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
          <Link className="btn ghost" href="/shop">
            Keep browsing
          </Link>
        </div>
      ) : lines === null || !ready ? (
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

            {janelaMorta ? (
              <>
                <p className="alert" style={{ margin: "0 0 12px" }}>
                  {callSt === "sailed"
                    ? "Your vessel has sailed — this kit is saved for your next call."
                    : "Orders for this call have closed — your kit is saved for the next one."}
                </p>
                <Link className="btn" href="/account">
                  {callSt === "sailed" ? "I'm on a new vessel" : "Pick my next call"}
                </Link>
              </>
            ) : belowMin ? (
              /* Abaixo do mínimo o botão diz o que falta em vez de deixar
                 passar: o servidor sempre barrou no placeOrder, mas barrar
                 lá é depois do checkout preenchido — o pior lugar para um
                 "não" que o carrinho já sabia dar. */
              <button className="btn" disabled>
                {avisoMin}
              </button>
            ) : (
              <Link className="btn" href="/checkout">
                Proceed to Checkout
              </Link>
            )}
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
