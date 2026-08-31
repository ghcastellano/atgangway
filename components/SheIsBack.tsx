"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchVessel } from "@/app/account/actions";
import { santosTime } from "@/lib/format";

/**
 * "Ela voltou" — o toque que nenhum concorrente dá.
 *
 * O perfil guarda o IMO, que é a identidade do casco: o mesmo navio
 * volta a Santos com outra viagem e outro ETA, mas o mesmo IMO. Quando
 * a home reencontra esse número no line-up, o app reconhece o navio da
 * pessoa antes que ela precise procurá-lo — e o re-vínculo vira um
 * botão em vez de uma volta ao cadastro.
 *
 * É por isso que a escala expira e a sessão não: quem some é o vínculo,
 * e ele se refaz num toque, com o kit intacto.
 */
export default function SheIsBack({
  shipId,
  name,
  eta,
}: {
  shipId: string;
  name: string;
  eta: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="volta">
      <p className="vt">
        <b>{name}</b> is back on the line-up
      </p>
      <p className="vd">ETA {santosTime(eta)} · same vessel, new call</p>
      {erro && <p className="vd erro">{erro}</p>}
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErro(null);
            const r = await switchVessel(shipId);
            if (r.ok) router.refresh();
            else setErro(r.error ?? "Couldn't switch — try again.");
          })
        }
      >
        {pending ? "Switching…" : "Continue on this call"}
      </button>
    </div>
  );
}
