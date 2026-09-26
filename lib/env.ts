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

/**
 * O endereço que o NAVEGADOR usa para falar com o Supabase.
 *
 * Por padrão é o mesmo de cima. Ligando NEXT_PUBLIC_SUPABASE_PROXY=1, o
 * navegador passa a chamar o próprio domínio da loja e o next.config
 * repassa para o Supabase. O cliente deixa de ver "supabase.co" em
 * qualquer requisição — é o que o add-on de domínio próprio faria, sem
 * os US$ 10/mês.
 *
 * Vale SÓ para o navegador. O servidor continua indo direto ao Supabase:
 * fazer uma função da Vercel chamar o próprio site para chegar ao banco
 * custaria uma invocação a mais e uma volta de rede em cada consulta.
 */
export const SUPABASE_URL_NAVEGADOR =
  process.env.NEXT_PUBLIC_SUPABASE_PROXY === "1" && SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL || "https://atgangway.com"
    : SUPABASE_URL;

/**
 * O nome do cookie onde a sessão mora — sempre derivado do endereço do
 * SERVIDOR, nunca do endereço do navegador.
 *
 * O @supabase/ssr monta essa chave a partir do hostname: com
 * cuaocjxofaizefzcxlyc.supabase.co ele grava em
 * `sb-cuaocjxofaizefzcxlyc-auth-token`; com atgangway.com, em
 * `sb-atgangway-auth-token`. Como o proxy deu endereços diferentes para o
 * navegador e para o servidor, cada lado passou a usar um cookie diferente:
 * o login acontecia, o token era emitido, e o servidor procurava a sessão
 * num cookie que não existia. Para quem usava, era simplesmente "o login
 * não funciona" — sem erro nenhum na tela.
 *
 * Fixando a chave, os dois lados voltam a falar do mesmo cookie.
 */
export const SUPABASE_STORAGE_KEY = (() => {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : undefined;
  } catch {
    return undefined;
  }
})();

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
