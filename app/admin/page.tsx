import { createClient } from "@/lib/supabase/server";
import { santosTime, shortShipName, usd } from "@/lib/format";
import { STATUS_LABEL, STATUS_PILL, type OrderStatus } from "@/lib/types";
import DeliveryProof from "@/components/DeliveryProof";
import { setOrderStatus } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: OrderStatus;
  payment_method: string | null;
  subtotal_usd: number;
  deposit_usd: number;
  balance_usd: number;
  contact_name: string | null;
  contact_whatsapp: string | null;
  note: string | null;
  created_at: string;
  ships: { name: string; berth: string | null; eta: string } | null;
  order_items: { name: string; qty: number }[];
};

const ACTIVE: OrderStatus[] = ["awaiting_deposit", "deposit_paid", "preparing", "at_gangway"];

const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  awaiting_deposit: { to: "deposit_paid", label: "✓ Deposit paid" },
  deposit_paid: { to: "preparing", label: "🛒 Start shopping" },
  preparing: { to: "at_gangway", label: "🚚 At the gangway" },
  // at_gangway não entra aqui: fechar a entrega passa pelo
  // DeliveryProof, que sobe a foto junto com a mudança de estado.
};

function ActionBtn({ id, to, label, danger }: { id: string; to: OrderStatus; label: string; danger?: boolean }) {
  return (
    <form action={setOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={`btn small ${danger ? "danger" : "ghost"}`} type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function AdminBoard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, code, status, payment_method, subtotal_usd, deposit_usd, balance_usd, contact_name, contact_whatsapp, note, created_at, ships(name, berth, eta), order_items(name, qty)"
    )
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as unknown as Row[];
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const done = orders.filter((o) => !ACTIVE.includes(o.status)).slice(-12).reverse();

  const awaiting = active.filter((o) => o.status === "awaiting_deposit").length;
  const depositsHeld = active
    .filter((o) => o.status !== "awaiting_deposit")
    .reduce((s, o) => s + Number(o.deposit_usd), 0);
  const booked = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "credited")
    .reduce((s, o) => s + Number(o.subtotal_usd), 0);

  return (
    <main className="pb-nav">
      <div className="kpis">
        <div className="kpi">
          <b>{active.length}</b>
          <span>open orders</span>
        </div>
        <div className="kpi amber">
          <b>{awaiting}</b>
          <span>awaiting deposit</span>
        </div>
        <div className="kpi">
          <b>{usd(depositsHeld)}</b>
          <span>deposits held</span>
        </div>
        <div className="kpi amber">
          <b>{usd(booked)}</b>
          <span>booked (all time)</span>
        </div>
      </div>

      <p className="subhead">Open orders · oldest first</p>
      {active.length === 0 ? (
        <div className="empty">
          <div className="i">🧭</div>
          Deck clear — no open orders.
        </div>
      ) : (
        <div className="cart-list">
          {active.map((o) => {
            const next = NEXT_ACTION[o.status];
            const itemsTxt = o.order_items.map((i) => `${i.qty}× ${i.name}`).join(" · ");
            return (
              <div key={o.id} className="ocard">
                <div className="head">
                  <span className="code">#{o.code}</span>
                  <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <div className="meta">
                  {o.ships ? `${shortShipName(o.ships.name)} · B${o.ships.berth ?? "—"} · ETA ${santosTime(o.ships.eta)}` : "—"}
                </div>
                <div className="items">{itemsTxt}</div>
                <div className="meta">
                  {usd(Number(o.subtotal_usd))} · dep {usd(Number(o.deposit_usd))} · bal{" "}
                  {usd(Number(o.balance_usd))}
                  {o.payment_method ? ` · ${o.payment_method}` : ""}
                </div>
                {(o.contact_name || o.contact_whatsapp || o.note) && (
                  <div className="items">
                    {o.contact_name && <>👤 {o.contact_name} </>}
                    {o.contact_whatsapp && <>· 📱 {o.contact_whatsapp} </>}
                    {o.note && <>· 📝 {o.note}</>}
                  </div>
                )}
                <div className="actions">
                  {o.status === "at_gangway" ? (
                    <DeliveryProof orderId={o.id} code={o.code} />
                  ) : (
                    next && <ActionBtn id={o.id} to={next.to} label={next.label} />
                  )}
                  {o.status !== "at_gangway" && (
                    <ActionBtn id={o.id} to="cancelled" label="Cancel" danger />
                  )}
                  {o.status !== "awaiting_deposit" && (
                    <ActionBtn id={o.id} to="credited" label="↺ Credit (diverted)" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <>
          <p className="subhead">Recently closed</p>
          <div className="cart-list">
            {done.map((o) => (
              <div key={o.id} className="ocard">
                <div className="head">
                  <span className="code">#{o.code}</span>
                  <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <div className="meta">
                  {o.ships ? shortShipName(o.ships.name) : "—"} · {usd(Number(o.subtotal_usd))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
