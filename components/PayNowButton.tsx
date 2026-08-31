"use client";

import { useState, useTransition } from "react";
import { payOrderDeposit } from "@/app/checkout/actions";

// Retomada de pagamento: quem fechou o Stripe no meio volta ao pedido
// e paga daqui, sem refazer nada.
export default function PayNowButton({ code, amount }: { code: string; amount: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pay() {
    setErr(null);
    startTransition(async () => {
      const res = await payOrderDeposit(code);
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      setErr(res.error ?? "Couldn't start the payment — try again.");
    });
  }

  return (
    <div className="stack" style={{ paddingTop: 0 }}>
      <button className="btn" onClick={pay} disabled={pending}>
        {pending ? "Opening secure payment…" : `Pay deposit now · ${amount}`}
      </button>
      {err && <p className="alert">{err}</p>}
    </div>
  );
}
