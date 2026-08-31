"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { claimWishes } from "@/app/wishlist/actions";
import { WISH_KEY, readPending } from "@/lib/wishstash";

/**
 * Grava os corações marcados antes do login, assim que a sessão
 * aparece.
 *
 * Sem isto, tocar no coração deslogado mandava para o login e perdia o
 * item pelo caminho: a pessoa entrava, voltava para a vitrine e a
 * lista continuava vazia — exatamente o que ela achava ter feito.
 *
 * Quem confere a sessão é o servidor, pelo cookie, e não o cliente do
 * Supabase no navegador: um passo a menos para dar errado justamente
 * no wifi ruim de bordo, onde essa fila mais importa. Roda a cada
 * troca de rota, que cobre os dois caminhos de entrada — o login por
 * e-mail (router.push) e a volta do Google (/auth/callback).
 *
 * Não faz nada quando a fila está vazia, que é o caso quase sempre:
 * uma leitura de localStorage e acabou, sem ida ao servidor.
 */
export default function WishClaim() {
  const router = useRouter();
  const pathname = usePathname();
  const running = useRef(false);

  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = readPending(localStorage.getItem(WISH_KEY));
    } catch {
      return;
    }
    if (ids.length === 0 || running.current) return;

    running.current = true;
    (async () => {
      try {
        const res = await claimWishes(ids);
        // needsAuth: ainda não logou. A fila fica onde está, para a
        // próxima tela tentar de novo.
        if (!res.ok) return;
        try {
          localStorage.removeItem(WISH_KEY);
        } catch {
          // segue o baile
        }
        // Redesenha para o coração nascer cheio onde a pessoa tocou,
        // em vez de continuar vazio até a próxima navegação.
        if (res.saved > 0) router.refresh();
      } finally {
        running.current = false;
      }
    })();
  }, [pathname, router]);

  return null;
}
