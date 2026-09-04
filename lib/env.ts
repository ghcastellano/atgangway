// Env com retaguarda REAL — e com `||`, não `??`: variável criada EM
// BRANCO no painel da Vercel chega como "" (que passa pelo nullish) e
// derrubava o build com `Invalid URL, input: ''`.
//
// A retaguarda vale SÓ onde ela salvou a loja: no build da Vercel. A
// flag NEXT_PUBLIC_ON_VERCEL é injetada pelo next.config no momento do
// build (vale também no bundle do navegador — process.env.VERCEL puro
// não existe lá). Fora da Vercel, env ausente NÃO cai para produção:
// era possível rodar `npm run dev` sem .env.local e escrever no banco
// de produção sem perceber. Agora isso vira o modo "backend not
// configured", que o app já sabe mostrar.
const NA_VERCEL = Boolean(process.env.NEXT_PUBLIC_ON_VERCEL);
const retaguarda = (valor: string | undefined, producao: string) =>
  valor || (NA_VERCEL ? producao : "");

// Os valores de produção são públicos por design (a anon/publishable
// key roda no navegador; a segurança vem da RLS).
export const SUPABASE_URL = retaguarda(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://cuaocjxofaizefzcxlyc.supabase.co"
);

export const SUPABASE_ANON_KEY = retaguarda(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "sb_publishable_ia1xhkkK8Pb_gD0Wc8jmXA_71wecTI0"
);

// Volta a significar algo: na Vercel é sempre true (retaguarda), no dev
// local sem .env.local é FALSE — e as telas mostram o aviso em vez de
// falar com o banco errado.
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// URL e e-mail são inofensivos sem backend: ficam com retaguarda
// incondicional porque o metadataBase do layout precisa de uma URL
// válida até num build sem env nenhuma.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://atgangway.com";

/* NEXT_PUBLIC_USD_BRL_RATE foi removida. Era 5.30 congelada no build
   com o PTAX real em 5,1490 — e como a cobrança era em real, a
   diferença virava sobrepreço. A cotação agora vem do Banco Central,
   guardada em fx_rates e atualizada por cron. */

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "help@atgangway.com";

/**
 * O WhatsApp do balcão, e o link já com mensagem dentro.
 *
 * Morava cravado no rodapé. Agora que o herói também oferece a
 * conversa, um número em dois lugares é um número que um dia vai
 * divergir — e o que diverge é justamente o canal pelo qual o cliente
 * pede socorro na véspera de atracar.
 *
 * `wa.me` SEM `?text=` abre a conversa em branco: a pessoa toca, cai
 * num chat vazio com um número desconhecido e fecha. O texto entra
 * sempre, e diz de onde ela veio.
 */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP || "5511970561448";

export function whatsappLink(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
}
