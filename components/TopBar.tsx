"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { shortShipName } from "@/lib/format";

export function VesselChip() {
  const { ship, ready } = useCart();
  return (
    <Link href="/" className="vessel-chip" title="Change ship">
      <span className="dot" />
      <span>
        {ready && ship ? `${shortShipName(ship.name)} · B${ship.berth ?? "—"}` : "PICK SHIP"}
      </span>
    </Link>
  );
}

export default function TopBar({
  title,
  backHref,
  chip = true,
  account = false,
}: {
  title?: string;
  backHref?: string;
  chip?: boolean;
  account?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="top">
      {backHref && (
        <button className="back" aria-label="Back" onClick={() => router.push(backHref)}>
          ‹
        </button>
      )}
      {title ? (
        <h1>{title}</h1>
      ) : (
        <Link href="/" className="logo">
          Vessel <b>Supplier</b>
        </Link>
      )}
      <div className="top-side">
        {chip && <VesselChip />}
        {account && (
          <Link href="/account" className="iconbtn" aria-label="Account">
            ⚓
          </Link>
        )}
      </div>
    </header>
  );
}
