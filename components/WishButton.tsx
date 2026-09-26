"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWish } from "@/app/wishlist/actions";
import { WISH_KEY, togglePending } from "@/lib/wishstash";
import { useWish } from "@/lib/wish";

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
  initial,
}: {
  productId: string;
  name: string;
  /**
   * Estado dito pela PÁGINA. Só /wishlist ainda usa — lá todo item é,
   * por definição, favorito. Nas vitrines vem `undefined` de
   * propósito: elas são pré-renderizadas e iguais para todo mundo, e
   * quem sabe o que esta pessoa marcou é o contexto do navegador,
   * semeado uma vez pelo cabeçalho.
   */
  initial?: boolean;
}) {
  const router = useRouter();
  const { bump, ids, marcar } = useWish();
  // A ordem importa: o que a página afirmou vence; na ausência dela,
  // o que o servidor semeou.
  const doServidor = initial ?? ids.has(productId);
  const [on, setOn] = useState(doServidor);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  // O servidor manda o estado real a cada render, e o botão precisa
  // acompanhar: quando a fila guardada é gravada depois do login, a
  // página recarrega por baixo de um botão já montado, e sem isto ele
  // ficaria preso no coração vazio que viu ao nascer.
  const [lastFromServer, setLastFromServer] = useState(doServidor);
  if (lastFromServer !== doServidor && !pending) {
    setLastFromServer(doServidor);
    setOn(doServidor);
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
        // O selo do cabeçalho muda junto com o coração, não quando o
        // servidor responder. O conjunto de ids vai junto: é ele que
        // decide o coração deste mesmo produto na próxima tela.
        bump(next ? 1 : -1);
        marcar(productId, next);
        start(async () => {
          const res = await toggleWish(productId);
          if (res.needsAuth) {
            bump(next ? -1 : 1);
            marcar(productId, !next);
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
            router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
          }
          if (!res.ok) {
            setOn(!next);
            bump(next ? -1 : 1);
            marcar(productId, !next);
            setFailed(true);
            return;
          }
          // O servidor pode discordar (dois aparelhos): acerta o selo.
          if (res.wished !== next) bump(res.wished ? 1 : -1);
          marcar(productId, res.wished);
          setOn(res.wished);
        });
      }}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
