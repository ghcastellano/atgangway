"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWish } from "@/app/wishlist/actions";
import { WISH_KEY, togglePending } from "@/lib/wishstash";

/**
 * Coração de wishlist, no mesmo lugar do Sunny: ao lado do botão de
 * adicionar, em círculo claro.
 *
 * Estado otimista: o coração enche no toque e só volta atrás se o
 * servidor recusar. Numa conexão de navio a ida e volta pode levar
 * segundos, e um botão que não responde é um botão que a pessoa
 * aperta de novo.
 */
export default function WishButton({
  productId,
  name,
  initial = false,
}: {
  productId: string;
  name: string;
  initial?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  // O servidor manda o estado real a cada render, e o botão precisa
  // acompanhar: quando a fila guardada é gravada depois do login, a
  // página recarrega por baixo de um botão já montado, e sem isto ele
  // ficaria preso no coração vazio que viu ao nascer.
  const [lastFromServer, setLastFromServer] = useState(initial);
  if (lastFromServer !== initial && !pending) {
    setLastFromServer(initial);
    setOn(initial);
  }

  return (
    <button
      type="button"
      className={`wish ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={
        failed
          ? `Couldn't save ${name} — tap to try again`
          : on
            ? `Remove ${name} from wish list`
            : `Add ${name} to wish list`
      }
      // Antes o coração só voltava atrás, sem dizer nada: dava para
      // confundir com "salvou" e tocar de novo, que remove.
      title={failed ? "Couldn't save — tap to try again" : undefined}
      disabled={pending}
      onClick={() => {
        setFailed(false);
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await toggleWish(productId);
          if (res.needsAuth) {
            // Guarda a intenção ANTES de sair da página. Sem isto a
            // pessoa faz login, volta para a vitrine e o item não está
            // lá — exatamente o que ela achava ter feito.
            try {
              localStorage.setItem(
                WISH_KEY,
                togglePending(localStorage.getItem(WISH_KEY), productId)
              );
            } catch {
              // aparelho sem armazenamento: vai para o login mesmo assim
            }
            router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          if (!res.ok) {
            setOn(!next);
            setFailed(true);
            return;
          }
          setOn(res.wished);
        });
      }}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
