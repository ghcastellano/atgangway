import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { loginErrorPath, resolveNext, type AuthUrlError } from "@/lib/authmsg";

// Destino dos links de email do Supabase (confirmação de cadastro,
// recuperação de senha, troca de email). Suporta os dois formatos:
// - ?token_hash=&type=  → template customizado (verifyOtp; funciona em
//   qualquer navegador, mesmo abrindo o email em outro aparelho)
// - ?code=              → template padrão do Supabase (o endpoint /verify
//   confirma o email e redireciona com um code PKCE para trocar por sessão)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Três saídas diferentes mandam para o mesmo lugar. A URL leva só o
  // código; a frase mora em lib/authmsg.ts, com teste.
  const paraLogin = (code: AuthUrlError) => NextResponse.redirect(`${origin}${loginErrorPath(code)}`);
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
    // Convite e link de acesso não são nem um nem outro: link novo, e só.
    return paraLogin(
      confirmacaoDeConta ? "link_used" : type === "recovery" ? "reset_expired" : "bad_link"
    );
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // O code PKCE só troca por sessão no mesmo navegador que iniciou o fluxo.
    // O email em si já foi confirmado pelo endpoint /verify do Supabase —
    // então aqui basta orientar a entrar de novo.
    return paraLogin("other_browser");
  }

  return paraLogin("bad_link");
}
