"use client";

import { useRouter } from "next/navigation";
import { useCart, type CartShip } from "@/lib/cart";
import { hoursUntil, orderCloseAt } from "@/lib/format";
import { delayLabel, type Ship } from "@/lib/types";

export default function ShipPicker({ ships }: { ships: Ship[] }) {
  const router = useRouter();
  const { setShip } = useCart();

  function pick(s: Ship) {
    const ship: CartShip = {
      id: s.id,
      name: s.name,
      berth: s.berth,
      eta: s.eta,
      cutoff_hours: s.cutoff_hours,
    };
    setShip(ship);
    router.push("/shop");
  }

  if (ships.length === 0) {
    return (
      <div className="empty">
        <div className="i">🛳️</div>
        No vessels in the line-up right now.
        <br />
        Check back soon — we track every call at Santos.
      </div>
    );
  }

  return (
    <div className="ships">
      {ships.map((s) => {
        const etaH = hoursUntil(s.eta);
        const closeH = hoursUntil(orderCloseAt(s.eta, s.cutoff_hours));
        const open = closeH > 0;
        const cls = closeH > 48 ? "ok" : closeH > 24 ? "soon" : open ? "urgent" : "closed";
        return (
          <button key={s.id} className="ship" onClick={() => pick(s)} disabled={!open}>
            <span className="nm">{s.name}</span>
            <span className="meta">
              DOCKS IN {etaH}H{s.berth ? ` · BERTH ${s.berth}` : ""}
              {delayLabel(s) && <b className="delay-tag">{delayLabel(s)}</b>}
            </span>
            <span className="win">
              <span className={cls}>
                {!open
                  ? "ORDERS CLOSED"
                  : closeH <= 24
                    ? `⏳ LAST CALL · ${closeH}H LEFT`
                    : `ORDERS CLOSE IN ${closeH}H`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
