// Env com fallback: o app builda e roda mesmo sem Supabase configurado
// (mostra aviso de setup em vez de quebrar). A anon key é pública por design.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_placeholder";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/* NEXT_PUBLIC_USD_BRL_RATE foi removida. Era 5.30 congelada no build
   com o PTAX real em 5,1490 — e como a cobrança era em real, a
   diferença virava sobrepreço. A cotação agora vem do Banco Central,
   guardada em fx_rates e atualizada por cron. */

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ahoy@marinerssupplyco.com";
