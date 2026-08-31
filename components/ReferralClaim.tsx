"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/env";
import { REF_KEY } from "./StoreReferral";

/**
 * Vincula o código de indicação guardado no aparelho assim que existe
 * sessão — cobre tanto cadastro por e-mail quanto login com Google.
 * A função claim_referral no banco ignora auto-indicação e só grava
 * uma vez (nunca sobrescreve um padrinho existente).
 */
export default function ReferralClaim() {
  useEffect(() => {
    if (!supabaseConfigured) return;

    let code: string | null = null;
    try {
      code = localStorage.getItem(REF_KEY);
    } catch {
      return;
    }
    if (!code) return;

    const supabase = createClient();
    let done = false;

    const claim = async () => {
      if (done) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      done = true;
      const { error } = await supabase.rpc("claim_referral", { p_code: code });
      if (!error) {
        try {
          localStorage.removeItem(REF_KEY);
        } catch {
          // segue o baile
        }
      }
    };

    claim();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") claim();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
