import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/env";
import { latestPtax, ptaxUrl, type PtaxRow } from "@/lib/fx";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Puxa o PTAX do Banco Central e guarda no banco.
 *
 * Mesmo desenho do cron do line-up: chave anon mais segredo
 * compartilhado, para não existir chave service_role dentro do app. O
 * segredo mora em app_secrets e a RPC confere.
 *
 * Janela de 10 dias para trás, sempre: o PTAX não publica em fim de
 * semana nem feriado, e Carnaval emendado deixa quatro dias sem
 * cotação. Pedir só "hoje" devolveria vazio e o site ficaria sem taxa.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured) {
    return Response.json({ ok: false, error: "supabase not configured" }, { status: 503 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - 10 * 86_400_000);

  let rows: PtaxRow[] = [];
  try {
    const res = await fetch(ptaxUrl(from, to), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `bcb ${res.status}` }, { status: 502 });
    }
    const body = (await res.json()) as { value?: PtaxRow[] };
    rows = body.value ?? [];
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }

  const rate = latestPtax(rows);
  if (!rate) {
    // Dez dias sem cotação nenhuma não é feriado, é API mudada. Falha
    // alto: melhor o cron vermelho que a taxa velha em silêncio.
    return Response.json({ ok: false, error: "no ptax in window" }, { status: 502 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc("upsert_fx_rate", {
    p_date: rate.quoteDate,
    p_buy: rate.buy,
    p_sell: rate.sell,
    p_source: "bcb-ptax",
    p_secret: secret,
  });

  if (error) {
    console.error(JSON.stringify({ at: "cron_ptax", code: error.code, message: error.message }));
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, action: data, ...rate });
}
