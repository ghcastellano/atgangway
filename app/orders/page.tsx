import Link from "next/link";
import AccountRail from "@/components/AccountRail";
import AccountTabs from "@/components/AccountTabs";
import { ehAdmin } from "@/lib/admin";
import { IconPackage } from "@/components/Icon";
import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { createClient } from "@/lib/supabase/server";
import { toCents, usd } from "@/lib/money";
import { diaCurto, diaLocal } from "@/lib/format";
import { STATUS_LABEL, STATUS_PILL, type OrderStatus } from "@/lib/types";
import { sessionUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: OrderStatus;
  subtotal_cents: number | null;
  subtotal_usd: number; // retaguarda p/ pedido anterior à virada
  deposit_cents: number | null;
  created_at: string;
  delivery_date: string | null;
  ships: { name: string; berth: string | null; eta: string } | null;
  order_items: { qty: number }[];
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) redirect("/login?next=/orders");

  const { data } = await supabase
    .from("orders")
    .select(
      "id, code, status, subtotal_cents, subtotal_usd, deposit_cents, created_at, delivery_date, ships(name, berth, eta), order_items(qty)"
    )
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as Row[];
  const isAdmin = await ehAdmin(supabase, user.id);

  return (
    <main className="pg-acct">
      <Breadcrumb trail={[{ label: "My Orders" }]} />

      <div className="hero-mini">
        <p className="kicker">Your deliveries</p>
        <h2>Orders</h2>
        <p>Every kit rides with its ship&apos;s ETA — track each one here.</p>
      </div>

      <AccountRail current="/orders" isAdmin={isAdmin} />
      <AccountTabs />

      <div className="acct-main">
      {orders.length === 0 ? (
        <div className="empty">
          <div className="i" aria-hidden><IconPackage size={26} /></div>
          <p className="t">No orders yet</p>
          <p className="d">
            Place one and it docks here — status, cut-off and the photo
            proof of delivery, all on the same page.
          </p>
          <Link className="btn ghost" href="/shop" prefetch={false}>
            Start your kit
          </Link>
        </div>
      ) : (
        <div className="cart-list">
          {orders.map((o) => {
            const items = o.order_items.reduce((a, i) => a + i.qty, 0);
            return (
              <Link key={o.id} href={`/orders/${o.code}`} className="ocard">
                <div className="head">
                  <span className="code">#{o.code}</span>
                  <span className={`pill ${STATUS_PILL[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <div className="meta">
                  {o.ships?.name ?? "—"}
                  {o.ships?.berth ? ` · BERTH ${o.ships.berth}` : ""} · {items} ITEMS ·{" "}
                  {usd(o.subtotal_cents ?? toCents(o.subtotal_usd))}
                  {/* A promessa da página ("rides with its ship's ETA")
                      sem a data no cartão era promessa vazia. */}
                  {o.delivery_date || o.ships?.eta
                    ? ` · DELIVERY ${diaCurto(o.delivery_date ?? diaLocal(o.ships!.eta)).toUpperCase()}`
                    : ""}
                  {/* created_at já vinha na consulta e era descartado.
                      Aparece só a partir de 1024, onde sobra largura. */}
                  <span className="odate">
                    {new Date(o.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
}
