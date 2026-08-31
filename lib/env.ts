// Env com fallback REAL — e com `||`, não `??`: variável criada EM BRANCO
// no painel da Vercel chega como "" (que passa pelo nullish) e derrubava o
// build com `Invalid URL, input: ''`. String vazia agora cai no fallback,
// que é o valor público de produção (anon key é pública por design; a
// segurança vem da RLS). Painel vazio não pode derrubar a loja.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://auth.marinerssupplyco.com";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_ia1xhkkK8Pb_gD0Wc8jmXA_71wecTI0";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://vesselsupplierco.vercel.app";

/* NEXT_PUBLIC_USD_BRL_RATE foi removida. Era 5.30 congelada no build
   com o PTAX real em 5,1490 — e como a cobrança era em real, a
   diferença virava sobrepreço. A cotação agora vem do Banco Central,
   guardada em fx_rates e atualizada por cron. */

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ahoy@marinerssupplyco.com";
