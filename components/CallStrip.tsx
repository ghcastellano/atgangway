"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { callState, canOrder } from "@/lib/callstate";
import { diaCurto, diaLocal, orderCloseAt, restante } from "@/lib/format";

/**
 * A escala da pessoa, numa linha, nas telas de compra.
 *
 * A pergunta que decide a compra é "ainda dá para pedir para ESTA escala,
 * e quando chega?". A home responde no painel do navio; o catálogo, o
 * carrinho e o checkout não diziam nada — a pessoa escolhia produto sem
 * saber se o prazo já tinha passado. Esta faixa é o painel reduzido a
 * uma frase, e leva de volta a ele.
 *
 * Lê o perfil no navegador (mesma consulta da tela de conta) para poder
 * viver em página de cliente e de servidor sem duplicar a busca.
 * Visitante, ou conta sem navio, não vê nada.
 */
type Escala = { name: string; eta: string; ata: string | null; cutoff_hours: number | null };

export default function CallStrip() {
  const [escala, setEscala] = useState<Escala | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data: sessao } = await supabase.auth.getSession();
      const uid = sessao.session?.user.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("ships!profiles_ship_id_fkey(name, eta, ata, cutoff_hours)")
        .eq("id", uid)
        .maybeSingle();
      const s = (data as { ships: Escala | null } | null)?.ships;
      if (vivo && s?.eta) setEscala(s);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!escala) return null;

  const cutoff = escala.cutoff_hours ?? 24;
  const estado = callState({ eta: escala.eta, ata: escala.ata, cutoff_hours: cutoff });
  const aberto = canOrder(estado);
  const falta = orderCloseAt(escala.eta, cutoff).getTime() - Date.now();

  return (
    <Link href="/" className={`callstrip${aberto ? "" : " fechada"}`} prefetch={false}>
      <strong>{escala.name}</strong>
      {estado === "sailed" ? (
        <span>This call is over · pick your current vessel</span>
      ) : aberto ? (
        <span>
          Order cut-off in <b>{restante(falta)}</b> · delivery on docking {diaCurto(diaLocal(escala.eta))}
        </span>
      ) : (
        <span>Order window closed · see the next call</span>
      )}
    </Link>
  );
}
