"use client";

import { useEffect } from "react";
import { useWish } from "@/lib/wish";

/**
 * Busca quem está olhando, DEPOIS que a tela já pintou.
 *
 * Renderiza nada e não bloqueia nada. É o par no navegador da rota
 * /api/sessao, e a razão de existir está lá: enquanto o cabeçalho
 * perguntava isso no servidor, nenhuma página do site podia ser
 * guardada pronta.
 *
 * Três cuidados, todos por causa do wifi de navio:
 *
 *   AbortController com 8 segundos. A conexão de bordo não recusa —
 *   ela PENDURA. Uma promessa que nunca resolve deixaria o menu da
 *   conta no estado neutro para sempre.
 *
 *   Falhou, assume deslogado. Ficar em "não sei" é pior: o item do
 *   menu nunca decide. "Sign in" é o palpite seguro — quem já tem
 *   sessão e clicar é levado para a conta, não deslogado.
 *
 *   `keepalive: false` e `cache: "no-store"`: esta resposta contém a
 *   lista de desejos de uma pessoa e não pode encostar em cache
 *   nenhum, nem no do navegador.
 */
export default function SessaoSeed() {
  const { seed } = useWish();

  useEffect(() => {
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), 8_000);
    let vivo = true;

    (async () => {
      try {
        const r = await fetch("/api/sessao", {
          signal: ctl.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!vivo) return;
        if (!r.ok) {
          seed(0, [], false);
          return;
        }
        const d = (await r.json()) as { logado: boolean; count: number; ids: string[] };
        if (!vivo) return;
        seed(d.count ?? 0, d.ids ?? [], Boolean(d.logado));
      } catch {
        if (vivo) seed(0, [], false);
      } finally {
        clearTimeout(relogio);
      }
    })();

    return () => {
      vivo = false;
      clearTimeout(relogio);
      ctl.abort();
    };
  }, [seed]);

  return null;
}
