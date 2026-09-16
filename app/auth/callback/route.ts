import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";
import { profileIsComplete } from "@/lib/profile";
import { loginErrorPath } from "@/lib/authmsg";

// Retorno do OAuth (Google): troca o ?code= por sessão e segue o fluxo.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Entrar pelo Google pula o formulário de cadastro inteiro: a conta
      // nasce só com nome e e-mail, sem navio, porto nem telefone. Sem
      // este desvio a pessoa só descobre o que falta no checkout, com o
      // cartão na mão — que foi exatamente o que aconteceu aqui.
      const user = data?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, vessel_name, port_id, whatsapp")
          .eq("id", user.id)
          .maybeSingle();
        if (!profileIsComplete(profile)) {
          return NextResponse.redirect(`${origin}/account`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // O error_description do provedor ia cru para a tela. Agora só
  // importa distinguir "a pessoa desistiu" de "deu errado".
  const cancelou = searchParams.get("error") === "access_denied";
  return NextResponse.redirect(
    `${origin}${loginErrorPath(cancelou ? "google_cancelled" : "google_failed")}`
  );
}
