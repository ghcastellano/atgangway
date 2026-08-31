import { createClient } from "@/lib/supabase/server";
import { shortShipName } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: OrderStatus;
  ships: { name: string } | null;
  order_items: { name: string; emoji: string | null; qty: number }[];
};

export default async function ShoppingList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, code, status, ships(name), order_items(name, emoji, qty)")
    .in("status", ["deposit_paid", "preparing"]);

  const orders = (data ?? []) as unknown as Row[];

  const agg = new Map<string, { emoji: string; total: number; per: Map<string, number> }>();
  for (const o of orders) {
    const ship = o.ships ? shortShipName(o.ships.name) : "—";
    for (const i of o.order_items) {
      const cur = agg.get(i.name) ?? { emoji: i.emoji ?? "📦", total: 0, per: new Map() };
      cur.total += i.qty;
      cur.per.set(ship, (cur.per.get(ship) ?? 0) + i.qty);
      agg.set(i.name, cur);
    }
  }
  const rows = [...agg.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <main className="pb-nav">
      <p className="subhead">
        Consolidated buy list — {orders.length} paid order{orders.length === 1 ? "" : "s"} (deposit
        confirmed / shopping)
      </p>
      {rows.length === 0 ? (
        <div className="empty">
          <div className="i">🛒</div>
          Nothing to buy right now.
          <br />
          Orders enter this list once their deposit is confirmed.
        </div>
      ) : (
        <div className="cart-list">
          {rows.map(([name, r]) => (
            <div key={name} className="shoprow">
              <div className="em">{r.emoji}</div>
              <div>
                <div className="nm">{name}</div>
                <div className="per">
                  {[...r.per.entries()].map(([ship, q]) => `${ship} ×${q}`).join(" · ")}
                </div>
              </div>
              <div className="qtybig">×{r.total}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
