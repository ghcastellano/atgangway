"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { brlRef, type FxRate } from "@/lib/fx";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import { DEPOSIT_PCT, faltaParaMinimo, splitOrder, toCents, usd } from "@/lib/money";
import { placeOrder } from "./actions";

type Line = {
  id: string;
  price_cents: number;
  active: boolean;
  option_label: string | null;
  products: { active: boolean; name: string } | null;
};

/**
 * Resumo curto e o botão de pagar. É a única parte do checkout que
 * precisa virar JavaScript: o carrinho mora no localStorage, então só
 * o navegador sabe o que tem dentro.
 *
 * Nada de campo para digitar — nome, telefone e navio vêm do perfil,
 * conferidos no cartão acima. Aqui só se confirma e paga.
 */
export default function CheckoutClient({
  blocked,
  minOrderCents,
  shipId,
  contactName,
  contactWhatsapp,
  fxRate,
}: {
  blocked: boolean;
  /** Mínimo do porto do perfil, em centavos; 0 = sem mínimo. O carrinho
   *  já barra abaixo disso, mas /checkout digitado na barra chegava
   *  aqui com "Proceed to Payment" ativo para um pedido de US$ 18 — e o
   *  "não" vinha do servidor, depois do clique. A mesma régua, aqui. */
  minOrderCents: number;
  shipId: string | null;
  contactName: string;
  contactWhatsapp: string;
  /** PTAX do dia, só para a referência de quem paga em PIX. Null = não mostra. */
  fxRate: FxRate | null;
}) {
  const router = useRouter();
  const { items, count, ready, clear } = useCart();
  const [lines, setLines] = useState<Line[] | null>(null);
  /** A leitura do carrinho falhou (rede caiu). Diferente de "ainda
   *  carregando" e de "carrinho vazio" — e precisa de saída própria. */
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [creditCents, setCreditCents] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const [pending, startTransition] = useTransition();

  // A chave de idempotência: uma por TENTATIVA de compra. Nasce na
  // montagem e troca quando o carrinho muda — assim o retry de rede e o
  // clique duplo reenviam a MESMA tentativa (e recebem o mesmo pedido),
  // enquanto um carrinho editado é, de verdade, uma compra nova.
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  const assinatura = useMemo(
    () =>
      Object.entries(items)
        .map(([id, qty]) => `${id}:${qty}`)
        .sort()
        .join("|"),
    [items]
  );
  useEffect(() => {
    setIdem(crypto.randomUUID());
  }, [assinatura]);

  const ids = useMemo(() => Object.keys(items), [items]);

  useEffect(() => {
    if (!ready) return;
    if (!supabaseConfigured || ids.length === 0) {
      setLines([]);
      return;
    }
    // Só as variantes do carrinho, e só as colunas que entram na conta.
    // O NOME entrou junto: "Products: 4" e nada mais obriga a pessoa a
    // voltar ao carrinho para conferir o que está prestes a pagar — e
    // no desktop, com a coluna larga, lê como tela quebrada. Uma coluna
    // de texto na mesma consulta não custa outra ida ao banco.
    // ANTES: .then(({ data }) => setLines(data ?? []))  — sem catch.
    //
    // No wifi de bordo o fetch não devolve erro: ele REJEITA. A promessa
    // rejeitada não tinha quem a pegasse, `lines` ficava null para
    // sempre e a tela mostrava um círculo girando eternamente — sem
    // mensagem, sem botão, sem saída, na tela onde a pessoa vai pagar.
    // É o pior lugar do site para um beco sem fim, e o público desta
    // loja está justamente na pior conexão que existe.
    let cancelado = false;
    setFalhaCarga(false);
    // async/await, e não .then(): o builder do Supabase devolve um
    // PromiseLike, que NÃO tem .catch — era por isso que a rejeição de
    // rede não tinha como ser pega aqui.
    // TIMEOUT, e não só try/catch: a conexão de bordo raramente RECUSA
    // — ela PENDURA. O fetch fica esperando um servidor que não
    // responde, a promessa nunca resolve nem rejeita, e nenhum catch do
    // mundo dispara. Sem este relógio, a tela de pagamento gira para
    // sempre. 12 s é mais que o dobro do pior caso medido em 3G de
    // porto, e ainda é pouco para alguém desistir da compra.
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), 12_000);
    (async () => {
      try {
        const { data, error } = await createClient()
          .from("product_variants")
          .select(
            "id, price_cents, active, option_label, products!product_variants_product_id_fkey!inner(active, name)"
          )
          .in("id", ids)
          .abortSignal(ctl.signal);
        if (cancelado) return;
        if (error) {
          setFalhaCarga(true);
          return;
        }
        setLines((data ?? []) as unknown as Line[]);
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
  }, [ready, ids.join(","), tentativa]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    // A RPC devolve numeric em dólares e só é concedida a authenticated.
    // Sem saldo a compra segue: quem não tem crédito paga o depósito
    // cheio, que é o caso de quase todo mundo. O que não pode é a falha
    // desta leitura derrubar a tela de pagamento.
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), 8_000);
    (async () => {
      try {
        const { data } = await createClient()
          .rpc("my_credit_balance")
          .abortSignal(ctl.signal);
        setCreditCents(toCents(data ?? 0));
      } catch {
        setCreditCents(0);
      } finally {
        clearTimeout(relogio);
      }
    })();
    return () => {
      clearTimeout(relogio);
      ctl.abort();
    };
  }, []);

  useEffect(() => {
    // "placed" evita voltar pro carrinho no instante em que ele é
    // esvaziado pós-pedido. O navio não entra mais nessa condição: ele
    // vem do perfil, e perfil incompleto trava o botão, não a página.
    if (ready && !placed && count === 0) router.replace("/cart");
  }, [ready, placed, count, router]);

  const rows = useMemo(
    () =>
      (lines ?? [])
        .filter((l) => l.active && l.products?.active)
        .map((l) => ({ ...l, qty: items[l.id] ?? 0 }))
        .filter((l) => l.qty > 0),
    [lines, items]
  );

  const subtotal = rows.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const split = splitOrder(subtotal, creditCents);
  const coveredByCredit = split.credit > 0 && split.dueNow === 0;
  const { below, label: avisoMin, minimo } = faltaParaMinimo(subtotal, minOrderCents);
  const belowMin = below && rows.length > 0;
  const canPay = ready && lines !== null && rows.length > 0 && !blocked && !belowMin && !pending;

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await placeOrder({
        idempotencyKey: idem,
        // O navio agora vem do perfil, não do carrinho: é do tripulante,
        // não da compra, e não muda entre um pedido e outro.
        shipId,
        applyCredit: creditCents > 0,
        contactName,
        contactWhatsapp,
        note: "",
        items: Object.entries(items).map(([id, qty]) => ({ id, qty })),
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setPlaced(true);
      clear();
      if (res.payUrl) {
        // página segura do Stripe (cartão · Apple Pay · Google Pay · PIX)
        window.location.assign(res.payUrl);
        return;
      }
      router.push(`/orders/${res.code}?placed=1${res.paid ? "&paid=1" : ""}`);
    });
  }

  if (falhaCarga) {
    return (
      <section className="sumcard" aria-live="assertive">
        <h2 className="sumttl">We couldn&apos;t load your cart</h2>
        <p className="finehint">
          The connection dropped before we could price your items. Nothing was
          charged and your cart is safe on this device.
        </p>
        <button
          type="button"
          className="btn block"
          onClick={() => {
            setFalhaCarga(false);
            setTentativa((n) => n + 1);
          }}
        >
          Try again
        </button>
        <p className="linkline">
          <Link href="/cart">Back to cart</Link>
        </p>
      </section>
    );
  }

  // Blocos com a altura das linhas do resumo, não um disco: enquanto
  // o carrinho não volta, o cartão precisa ocupar o espaço que vai
  // ocupar. Sem isto o rodapé sobe e desce na tela do pagamento.
  if (!ready || lines === null)
    return (
      <section className="sumcard esq" aria-busy="true" aria-label="Loading">
        <div className="esq-main lista"><span /><span /><span /></div>
      </section>
    );

  return (
    <section className="sumcard" aria-label="Order summary">
      <h3>Your order</h3>

      {/* "Products" com a mesma contagem do carrinho: o número não pode
          mudar de uma tela para a outra sem nada ter mudado. */}
      <ul className="sumlines">
        {rows.map((l) => (
          <li key={l.id}>
            <span className="nm">
              {l.products?.name}
              {l.option_label ? <span className="op"> · {l.option_label}</span> : null}
              {l.qty > 1 ? <span className="qt"> ×{l.qty}</span> : null}
            </span>
            <b className="mono">{usd(l.price_cents * l.qty)}</b>
          </li>
        ))}
      </ul>

      <div className="sumrow">
        <span>Subtotal</span>
        <b>{usd(split.subtotal)}</b>
      </div>

      <div className="sumrow">
        <span>Deposit ({DEPOSIT_PCT}%)</span>
        <b>{usd(split.deposit)}</b>
      </div>

      {split.credit > 0 && (
        <div className="sumrow">
          <span>🧢 Captain credit</span>
          <b style={{ color: "var(--teal)" }}>−{usd(split.credit)}</b>
        </div>
      )}

      <div className="sumrow">
        <span>Balance at the gangway</span>
        <b>{usd(split.balance)}</b>
      </div>

      <div className="sumrow grand">
        <span>Pay now</span>
        <b>{usd(split.dueNow)}</b>
            {/* A loja virou dólar; num cartão de 360px isso ficava na
                quinta linha da letra miúda. Só aparece a partir de 1024. */}
            <span className="sumcur">charged in USD</span>
      </div>

      {err && <p className="alert" style={{ marginTop: 12 }}>{err}</p>}

      <button className="btn" onClick={submit} disabled={!canPay}>
        {pending
          ? "Placing order…"
          : belowMin
            ? avisoMin
            : "Proceed to Payment"}
      </button>

      <p className="finehint">
        {belowMin ? (
          <>
            Minimum order for this port is {usd(minimo)}.{" "}
            <Link className="alink" href="/cart">
              Back to your cart
            </Link>{" "}
            to add a few more items.
          </>
        ) : blocked ? (
          <>
            Add the missing details above to your{" "}
            <Link className="alink" href="/account">
              profile
            </Link>{" "}
            to place this order.
          </>
        ) : coveredByCredit ? (
          "Your Captain credit covers the whole deposit — confirming places your order right away."
        ) : (
          <>
            {usd(split.dueNow)} charged now, in US dollars.{" "}
            {/* A referência em real existe só por causa do PIX, que é em
                real. Sai do PTAX do Banco Central, não de constante — e
                some quando a cotação está velha, porque número errado é
                pior que número nenhum. */}
            {brlRef(split.dueNow, fxRate) ? (
              <>
                Paying by PIX? That&apos;s about {brlRef(split.dueNow, fxRate)} at today&apos;s
                Banco Central rate.{" "}
              </>
            ) : null}
            Next is our secure payment page: card, Apple Pay, Google Pay or PIX. If your ship
            skips the call, the deposit becomes full credit for the next one — no paperwork.
          </>
        )}
      </p>
    </section>
  );
}
