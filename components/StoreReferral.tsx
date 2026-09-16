"use client";

import { useEffect } from "react";
import { CHAVE_INDICACAO } from "@/lib/chaves";

export const REF_KEY = CHAVE_INDICACAO;

/** Guarda o código de indicação no aparelho até a pessoa criar conta. */
export default function StoreReferral({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem(REF_KEY, code);
    } catch {
      // storage indisponível — a indicação simplesmente não é registrada
    }
  }, [code]);

  return null;
}
