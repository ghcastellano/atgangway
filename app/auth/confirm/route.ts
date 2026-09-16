import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Aceita ?next= como caminho interno ou como URL absoluta do próprio site
// (o template de email do Supabase repassa o redirect_to completo).
function resolveNext(raw: string | null, origin: string, fallback = "/shop"): string {
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const u = new URL(raw);
    if (u.origin === origin) return u.pathname + u.search;
  } catch {
    // não era URL — cai no fallback
  }
  return fallback;
}

// Destino dos links de email do Supabase (confirmação de cadastro,
// recuperação de senha, troca de email). Suporta os dois formatos:
// - ?token_hash=&type=  → template customizado (verifyOtp; funciona em
//   qualquer navegador, mesmo abrindo o email em outro aparelho)
// - ?code=              → template padrão do Supabase (o endpoint /verify
//   confirma o email e redireciona com um code PKCE para trocar por sessão)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = resolveNext(searchParams.get("next"), origin);

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);

    /* Link de e-mail é de uso único e tem prazo. Quando ele não serve
       mais, o Supabase responde a mesma coisa nos dois casos —
       `otp_expired` / "One-time token not found" — e a tela devolvia
       "inválido ou expirado, peça outro" para ambos.

       Para quem estava CONFIRMANDO A CONTA isso é mentira por omissão:
       o link já tinha funcionado (ou a conta já estava ativa por outro
       caminho), e a pessoa é mandada pedir um link que não precisa,
       para uma conta que já existe. Quem abre o e-mail duas vezes — ou
       no celular depois de ter clicado no notebook — cai exatamente
       aqui e conclui que o cadastro falhou.

       Confirmação de conta e redefinição de senha precisam de respostas
       diferentes: uma acabou bem e só falta entrar; a outra precisa
       mesmo de um link novo. */
    const confirmacaoDeConta = type === "signup" || type === "email" || type === "email_change";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        confirmacaoDeConta
          ? "This link was already used — which usually means your account is confirmed. Just sign in below; if your password doesn't work, use “Forgot your password”."
          : "That password-reset link has expired or was already used. Request a new one below — links are single-use and short-lived."
      )}`
    );
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // O code PKCE só troca por sessão no mesmo navegador que iniciou o fluxo.
    // O email em si já foi confirmado pelo endpoint /verify do Supabase —
    // então aqui basta orientar a entrar de novo.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Almost there — your email link was used in a different browser. If you were confirming your account, it's confirmed: just sign in. For password resets, request a new link from this device."
      )}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That link is invalid or expired — request a new one."
    )}`
  );
}
