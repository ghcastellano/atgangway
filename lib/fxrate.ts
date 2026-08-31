/**
 * Leitura da cotação guardada, para o servidor.
 *
 * Separado de lib/fx.ts porque aquele é puro e testável sem banco; este
 * abre conexão e por isso não entra em componente de cliente.
 */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/env";
import { rateIsUsable, type FxRate } from "@/lib/fx";

/**
 * Cotação mais recente que ainda serve como referência.
 *
 * `<= hoje` e não `= hoje` de propósito: o PTAX não publica em fim de
 * semana, e exigir a data de hoje deixaria a loja sem número de sábado
 * a segunda. Devolve null quando a última é velha demais — número
 * errado é pior que número nenhum quando o texto diz "hoje".
 *
 * Cliente anônimo: a cotação é pública (fx_rates tem policy de leitura
 * para todos) e não depende de sessão.
 */
export async function currentFxRate(): Promise<FxRate | null> {
  if (!supabaseConfigured) return null;
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db
      .from("fx_rates")
      .select("quote_date, usd_brl_buy, usd_brl_sell")
      .lte("quote_date", new Date().toISOString().slice(0, 10))
      .order("quote_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const rate: FxRate = {
      quoteDate: data.quote_date as string,
      buy: Number(data.usd_brl_buy),
      sell: Number(data.usd_brl_sell),
    };
    return rateIsUsable(rate, new Date()) ? rate : null;
  } catch {
    // Câmbio fora do ar não pode derrubar o checkout: sem taxa, a tela
    // simplesmente não mostra a referência em real.
    return null;
  }
}
