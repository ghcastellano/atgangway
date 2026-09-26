import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/format";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/env";
import { sessionUser } from "@/lib/supabase/session";

const PROTECTED_PREFIXES = ["/account", "/orders", "/checkout", "/admin", "/captain"];

/**
 * Só estas colunas decidem se o cadastro está completo. É a mesma regra
 * de lib/profile.ts, repetida aqui porque o proxy roda antes da
 * renderização e importar o módulo inteiro arrastaria dependências que
 * não pertencem a esse caminho.
 */
function faltaCadastro(p: Record<string, unknown> | null): boolean {
  if (!p) return true;
  const tem = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return !(tem(p.full_name) && tem(p.vessel_name) && tem(p.port_id) && tem(p.whatsapp));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseConfigured) return supabaseResponse;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANTE: nada entre criar o client e a leitura da sessão — é ela
  // que renova o token vencido e grava o cookie novo. getClaims() faz
  // isso verificando o JWT localmente (chave pública em memória), sem a
  // viagem ao servidor de Auth que getUser() fazia em TODA requisição.
  const user = await sessionUser(supabase);

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Quem já tem sessão e abre /login ou /signup (link antigo, "Sign in"
  // num cabeçalho que ainda não soube da sessão) não deve entrar de novo
  // — vai para onde ia, ou para a loja.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    const destino = safeNext(request.nextUrl.searchParams.get("next"));
    url.pathname = destino.split("?")[0];
    url.search = destino.includes("?") ? destino.slice(destino.indexOf("?")) : "";
    return NextResponse.redirect(url);
  }

  // O painel tem porta própria: quem cai em /admin deslogado vai para
  // /admin/login, não para o login da loja. E a tela de login do painel
  // não pode exigir login para ser vista.
  const staffLogin = pathname === "/admin/login";
  if (needsAuth && !user && !staffLogin) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  /**
   * O portão de cadastro incompleto vale só onde o cadastro é usado: no
   * checkout.
   *
   * Ele já barrou a loja inteira — quem entrava pelo Google sem navio ou
   * telefone no perfil era expulso até da vitrine, e a consulta de
   * perfil rodava a cada navegação de todo mundo logado. Navegar e
   * montar carrinho não pede cadastro; pagar é que pede. O /account
   * devolve a pessoa ao checkout pelo ?next= quando terminar.
   */
  if (user && pathname.startsWith("/checkout")) {
    try {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("full_name, vessel_name, port_id, whatsapp")
        .eq("id", user.id)
        .maybeSingle();

      if (faltaCadastro(perfil)) {
        const url = request.nextUrl.clone();
        url.pathname = "/account";
        url.search = "";
        // De onde veio, para a tela de conta poder devolver a pessoa ao
        // que ela estava fazendo depois de completar.
        url.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(url);
      }
    } catch {
      // Banco fora do ar não pode trancar o checkout: sem resposta,
      // deixa passar — o placeOrder barra de novo pelo missingProfileFields.
    }
  }

  return supabaseResponse;
}
