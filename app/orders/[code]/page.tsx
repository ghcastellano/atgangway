import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmandoPagamento from "@/components/ConfirmandoPagamento";
import PayNowButton from "@/components/PayNowButton";
import { createClient } from "@/lib/supabase/server";
import { hoursUntil, santosTime } from "@/lib/format";
import { toCents, usd } from "@/lib/money";
import { orderReturn } from "@/lib/pedido";
import {
  DELIVERY_BUCKET,
  ORDER_FLOW,
  orderStep,
  PAYMENT_LABEL,
  STATUS_LABEL,
  STATUS_PILL,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/types";
import { sessionUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  // Colunas em centavos são a verdade; as _usd ficam de retaguarda
  // para os pedidos gravados antes da virada.
  subtotal_cents: number | null;
  deposit_cents: number | null;
  balance_cents: number | null;
  subtotal_usd: number;
  deposit_usd: number;
  balance_usd: number;
  credit_applied_usd: number;
  created_at: string;
  delivery_photo_path: string | null;
  delivered_at: string | null;
  ships: { name: string; berth: string | null; eta: string } | null;
  order_items: {
    name: string;
    emoji: string | null;
    unit_price_cents: number | null;
    unit_price_usd: number;
    qty: number;
  }[];
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ placed?: string; paid?: string; cancelled?: string }>;
}) {
  const { code } = await params;
  const { placed, paid, cancelled } = await searchParams;

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) redirect(`/login?next=/orders/${code}`);

  const { data } = await supabase
    .from("orders")
    .select(
      "id, code, status, payment_method, subtotal_cents, deposit_cents, balance_cents, subtotal_usd, deposit_usd, balance_usd, credit_applied_usd, created_at, delivery_photo_path, delivered_at, ships(name, berth, eta), order_items(name, emoji, unit_price_cents, unit_price_usd, qty)"
    )
    .eq("code", code.toUpperCase())
    .maybeSingle();

  const o = data as unknown as Row | null;
  if (!o) notFound();

  // A foto de entrega mora em bucket privado: a policy libera a
  // leitura para o dono do pedido, e o link assinado dura uma hora —
  // tempo de olhar, não de circular por aí.
  let proofUrl: string | null = null;
  if (o.delivery_photo_path) {
    const { data: signed } = await supabase.storage
      .from(DELIVERY_BUCKET)
      .createSignedUrl(o.delivery_photo_path, 3600);
    proofUrl = signed?.signedUrl ?? null;
  }

  const itemCount = o.order_items.reduce((a, i) => a + i.qty, 0);
  // Tudo em inteiro: subtrair dólares em ponto flutuante é como um
  // centavo some do que o cliente vê que deve.
  const subtotal = o.subtotal_cents ?? toCents(o.subtotal_usd);
  const deposit = o.deposit_cents ?? toCents(o.deposit_usd);
  const balance = o.balance_cents ?? toCents(o.balance_usd);
  const credit = toCents(o.credit_applied_usd);
  const dueNow = Math.max(0, deposit - credit);
  // O passo sai da régua única (lib/types), a mesma que o painel percorre.
  const stepNow = orderStep(o.status);

  // Um marco por estado do fluxo, com o MESMO rótulo do selo do pedido:
  // ver "Deposit received" no topo e "We shop & pack" aceso na trilha
  // era o que fazia o cliente achar que a loja estava adiantada — ou
  // atrasada, quando o painel já tinha andado e a palavra não mudava.
  const DETALHE: Partial<Record<OrderStatus, string>> = {
    awaiting_deposit: `30% · ${usd(dueNow)} to reserve your gangway window`,
    deposit_paid: `Deposit cleared${o.payment_method ? ` — ${PAYMENT_LABEL[o.payment_method]}` : ""} · your slot is confirmed`,
    preparing: "Buying fresh in Santos, matched to your ETA",
    at_gangway: "Waiting when lines are fast · photo proof",
    delivered: `Balance ${usd(balance)} by card at delivery`,
  };
  const steps = ORDER_FLOW.map((s) => ({ t: STATUS_LABEL[s], p: DETALHE[s] ?? "" }));
  // De onde a pessoa chegou (pediu / pagou / desistiu de pagar) — lib/pedido.
  const volta = orderReturn({ placed, paid, cancelled }, o.status);

  return (
    <main>
      <Breadcrumb trail={[{ label: "My Orders", href: "/orders" }, { label: `#${o.code}` }]} />

      {volta.kind !== "plain" ? (
        <div className="okwrap">
          <div className="okring">{volta.kind === "cancelled" ? "⏳" : "✓"}</div>
          <h2>{volta.title}</h2>
          <p>
            Order <span className="mono">#{o.code}</span> · {itemCount} items ·{" "}
            {usd(subtotal)}
          </p>
          {o.ships && (
            <p style={{ marginTop: 4 }}>
              {o.ships.name} · BERTH {o.ships.berth ?? "—"} · gangway delivery on docking
            </p>
          )}
          {volta.kind === "paid" && (
            <div className="stack" style={{ marginTop: 18 }}>
              <Link className="btn" href="/shop">
                Continue shopping
              </Link>
              <Link className="btn ghost" href="/orders">
                All my orders
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="hero-mini">
          <p className="kicker">
            {o.ships
              ? `${o.ships.name} · BERTH ${o.ships.berth ?? "—"} · ETA IN ${hoursUntil(o.ships.eta)}H`
              : "—"}
          </p>
          <h2>
            #{o.code}{" "}
            <span className={`pill ${STATUS_PILL[o.status]}`} style={{ verticalAlign: "middle" }}>
              {STATUS_LABEL[o.status]}
            </span>
          </h2>
          <p>
            {itemCount} items · {usd(subtotal)}
          </p>
        </div>
      )}

      {volta.confirming ? (
        <div className="stack" style={{ marginTop: 10 }}>
          <ConfirmandoPagamento />
        </div>
      ) : o.status === "awaiting_deposit" ? (
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="note">
            Deposit of <b>{usd(dueNow)}</b> pending — your gangway window is reserved meanwhile.
          </p>
          <PayNowButton code={o.code} amount={usd(dueNow)} />
        </div>
      ) : null}
      {o.status === "credited" && (
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="note">
            Ship diverted from Santos — your deposit became full credit for the next call. No
            bureaucracy, it&apos;s waiting for you.
          </p>
        </div>
      )}
      {o.status === "cancelled" && (
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="alert">This order was cancelled. Anything wrong? Talk to us at the bar.</p>
        </div>
      )}

      {stepNow !== null && (
        <div className="track">
          {steps.map((s, k) => (
            <div key={s.t} className={`step ${k < stepNow ? "done" : k === stepNow ? "now" : ""}`}>
              <div className="n">{k < stepNow ? "✓" : k === stepNow ? "●" : k + 1}</div>
              <div>
                <h4>{s.t}</h4>
                <p>{s.p}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {proofUrl && (
        <figure className="proof-card">
          <figcaption>
            <span className="kicker">DELIVERY PHOTO</span>
            {o.delivered_at && <b>{santosTime(o.delivered_at)} · Santos</b>}
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofUrl} alt={`Delivery proof for order ${o.code}`} />
        </figure>
      )}

      <div className="cart-list">
        {o.order_items.map((i, k) => (
          <div className="ci" key={k}>
            <div className="em">{i.emoji ?? "📦"}</div>
            <div>
              <div className="nm">{i.name}</div>
              <div className="pr">
                {usd(i.unit_price_cents ?? toCents(i.unit_price_usd))} × {i.qty}
              </div>
            </div>
            <b className="mono">{usd((i.unit_price_cents ?? toCents(i.unit_price_usd)) * i.qty)}</b>
          </div>
        ))}
      </div>

      <div className="summary">
        <div className="r">
          <span>Subtotal</span>
          <b>{usd(subtotal)}</b>
        </div>
        <div className="r">
          <span>Gangway delivery</span>
          <b>USD 0.00</b>
        </div>
        <div className="r total">
          <span>Deposit (30%)</span>
          <b>{usd(deposit)}</b>
        </div>
        {credit > 0 && (
          <div className="r">
            <span>🧢 Captain credit applied</span>
            <b style={{ color: "var(--teal)" }}>−{usd(credit)}</b>
          </div>
        )}
        <div className="r">
          <span>Balance at the gangway</span>
          <b>{usd(balance)}</b>
        </div>
      </div>
    </main>
  );
}
