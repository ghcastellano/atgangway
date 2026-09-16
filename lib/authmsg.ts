/**
 * A voz da autenticação.
 *
 * Quatro lugares escreviam frase de erro de auth, nenhum testado:
 * `/auth/confirm` e `/auth/callback` mandavam a FRASE pronta na query
 * string, `/login` a exibia como viesse, e as duas telas de login
 * casavam por regex o texto em inglês do próprio Supabase.
 *
 * Duas consequências. A primeira é a de sempre: frase sem teste é typo
 * descoberto em produção — e o "link inválido, peça outro" para quem já
 * tinha confirmado a conta foi exatamente isso. A segunda é pior:
 * `/login?error=<qualquer texto>` mostrava qualquer texto, com a cara
 * da loja, a quem clicasse num link forjado.
 *
 * Agora as rotas mandam um CÓDIGO e esta folha é a única que o
 * transforma em frase. Código desconhecido vira a frase genérica, nunca
 * o que veio na URL. Mesma forma de lib/pedido.ts.
 */

export type AuthUrlError =
  | "link_used" // confirmação de conta com link gasto: a conta já está ativa
  | "reset_expired" // link de redefinição gasto ou vencido
  | "other_browser" // code PKCE aberto em outro navegador
  | "bad_link" // chegou sem token nenhum
  | "google_cancelled" // a pessoa desistiu na tela do Google
  | "google_failed";

const FRASES: Record<AuthUrlError, string> = {
  link_used:
    "This link was already used — which usually means your account is confirmed. Just sign in below; if your password doesn't work, use “Forgot your password”.",
  reset_expired:
    "That password-reset link has expired or was already used. Request a new one below — links are single-use and short-lived.",
  other_browser:
    "Almost there — your email link was used in a different browser. If you were confirming your account, it's confirmed: just sign in. For password resets, request a new link from this device.",
  bad_link: "That link is invalid or expired — request a new one.",
  google_cancelled: "Google sign-in was cancelled — you can try again or sign in with your email.",
  google_failed: "Google sign-in failed — try again.",
};

/** `?error=` → frase. null quando não há erro na URL. */
export function authUrlMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  // hasOwn, não `in`: `"toString" in FRASES` é verdadeiro.
  return Object.hasOwn(FRASES, code) ? FRASES[code as AuthUrlError] : FRASES.bad_link;
}

/** Monta o destino de erro. Tipado: rota nenhuma inventa código. */
export function loginErrorPath(code: AuthUrlError): string {
  return `/login?error=${code}`;
}

export type SignInFailure = "unconfirmed" | "invalid" | "other";

/**
 * Classifica a recusa do signInWithPassword.
 *
 * O `code` é o contrato do Supabase; o texto é só retaguarda para
 * versões que não o mandam. Casar só o texto quebrava no dia em que
 * alguém lá trocasse uma palavra.
 */
export function signInFailure(error: { message?: string; code?: string | null }): SignInFailure {
  if (error.code === "email_not_confirmed") return "unconfirmed";
  if (error.code === "invalid_credentials") return "invalid";
  const msg = error.message ?? "";
  if (/not confirmed/i.test(msg)) return "unconfirmed";
  if (/invalid login credentials/i.test(msg)) return "invalid";
  return "other";
}

/** Frase da loja para a recusa. `other` devolve null: a tela decide. */
export function signInMessage(kind: SignInFailure): string | null {
  switch (kind) {
    case "unconfirmed":
      return "Your email isn't confirmed yet — open the link we sent you, or resend it below.";
    case "invalid":
      return "Wrong email or password. Forgot it? Reset below.";
    default:
      return null;
  }
}

// Aceita ?next= como caminho interno ou como URL absoluta do próprio site
// (o template de email do Supabase repassa o redirect_to completo).
export function resolveNext(raw: string | null, origin: string, fallback = "/shop"): string {
  let destino = fallback;
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) destino = raw;
  else {
    try {
      const u = new URL(raw);
      if (u.origin === origin) destino = u.pathname + u.search;
    } catch {
      // não era URL — cai no fallback
    }
  }
  /* O destino nunca pode ser o próprio /auth/confirm. O cadastro mandava
     `emailRedirectTo: /auth/confirm?next=/shop` — certo para o template
     padrão do Supabase, que devolvia a pessoa ali com um ?code=. Com o
     template da loja o link JÁ passa por aqui, e o destino virava um
     segundo /auth/confirm, sem token: a conta era confirmada e a pessoa
     via "link inválido". Desembrulha — inclusive para os e-mails que já
     estão nas caixas de entrada. */
  for (let i = 0; i < 3 && destino.startsWith("/auth/confirm"); i++) {
    const dentro = new URL(destino, origin).searchParams.get("next");
    destino = dentro && dentro.startsWith("/") && !dentro.startsWith("//") ? dentro : fallback;
  }
  return destino.startsWith("/auth/confirm") ? fallback : destino;
}
