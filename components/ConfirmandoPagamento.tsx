"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Volta do Stripe antes do webhook: por alguns segundos o pedido ainda
// diz awaiting_deposit. Em vez de "pull down to refresh", a página se
// atualiza sozinha — a cada 3 s, no máximo 10 vezes. Quem decide se
// isto aparece é o servidor: o status virou, o componente some.
const INTERVALO_MS = 3000;
const MAX_TENTATIVAS = 10;

export default function ConfirmandoPagamento() {
  const router = useRouter();
  // router.refresh() preserva o estado do client component, então a
  // contagem sobrevive a cada rodada.
  const [tentativas, setTentativas] = useState(0);

  useEffect(() => {
    if (tentativas >= MAX_TENTATIVAS) return;
    const t = setTimeout(() => {
      setTentativas((n) => n + 1);
      router.refresh();
    }, INTERVALO_MS);
    return () => clearTimeout(t);
  }, [tentativas, router]);

  return (
    <p className="note">
      {tentativas < MAX_TENTATIVAS
        ? "💳 Confirming your payment…"
        : "💳 Payment approved — taking a moment to show up here. Pull down to refresh."}
    </p>
  );
}
