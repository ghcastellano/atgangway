import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { resumoDaLista } from "@/lib/wishlist";

/**
 * Quem está olhando — a única coisa da casca do site que é pessoal.
 *
 * Existe para que o CABEÇALHO não precise saber. Enquanto ele sabia, o
 * site inteiro pagava por isso: o cabeçalho mora no layout raiz, o
 * layout raiz está em todas as rotas, e um `cookies()` ali marca cada
 * uma delas como dinâmica. Medido antes: /faq — texto puro, zero
 * consultas próprias — respondia `x-vercel-cache: MISS` e abria uma
 * função na Vercel a cada visita, para descobrir se havia sessão e
 * desenhar um cabeçalho igual para todo mundo. Eram 43 rotas assim,
 * inclusive a ficha de produto, que é a página que o Google rastreia e
 * que viaja em grupo de tripulação.
 *
 * Agora o documento é o mesmo para todos e pode ficar guardado na
 * borda; o que muda por pessoa — o selo do ♡, quais corações nascem
 * cheios, "Sign in" ou "Sign out" — chega por aqui, depois da tela
 * pintada. É como toda loja grande faz, e pela mesma razão.
 *
 * Este handler é dinâmico por natureza (lê cookie) e nunca deve ser
 * guardado por ninguém: `private` mantém fora do cache compartilhado da
 * Vercel, `no-store` fora do cache do navegador. Uma resposta destas
 * vazando para outro visitante mostraria a lista de desejos alheia.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const semSessao = NextResponse.json(
    { logado: false, count: 0, ids: [] as string[] },
    { headers: { "Cache-Control": "private, no-store" } }
  );

  try {
    const supabase = await createClient();
    // JWT verificado localmente: sem ida ao servidor de Auth.
    const user = await sessionUser(supabase);
    if (!user) return semSessao;

    const { count, ids } = await resumoDaLista();
    return NextResponse.json(
      { logado: true, count, ids },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    // Auth ou banco fora do ar: o cabeçalho continua desenhado, apenas
    // sem selo. Nada aqui vale derrubar a navegação.
    return semSessao;
  }
}
