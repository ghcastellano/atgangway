import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/env";

const PROTECTED_PREFIXES = ["/account", "/orders", "/checkout", "/admin", "/captain"];

/**
 * Rotas que um perfil incompleto ainda alcança.
 *
 * `/account` é o destino do desvio — sem ele o redirecionamento gira em
 * círculo. `/auth` e `/login` são o caminho de entrada e de saída, e
 * `/admin` fica de fora porque o staff não tem navio nem porto de casa:
 * exigir isso da própria equipe seria trancá-la para fora do painel.
 */
/**
 * Caminhos que o portão de cadastro NÃO barra.
 *
 * "/r" entrou depois e por um defeito: é a aterrissagem do QR do
 * Captain, e quem escaneia o código de um colega estando logado com
 * cadastro incompleto era mandado para /account ANTES de a página
 * rodar. A página é quem guarda o código no aparelho — então a
 * indicação se perdia em silêncio, justamente no fluxo que o programa
 * inteiro existe para servir. Guardar o código não depende de cadastro
 * completo; comprar é que depende, e /shop continua barrado.
 */
const LIVRES = ["/account", "/auth", "/login", "/signup", "/reset-password", "/admin", "/api", "/r/"];

/**
 * Só estas colunas decidem se o cadastro está completo. É a mesma regra
 * de lib/profile.ts, repetida aqui porque o middleware roda no runtime
 * de borda e importar o módulo inteiro arrastaria dependências que não
 * cabem nele.
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

  // IMPORTANTE: nada entre criar o client e getUser() — mantém a sessão viva.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // backend fora do ar — não derruba a navegação pública
  }

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  /**
   * Navio, porto e telefone são obrigatórios — e agora obrigatórios de
   * verdade.
   *
   * O formulário de cadastro já exigia os três, mas entrar pelo Google
   * pula o formulário inteiro: a conta nascia só com nome e e-mail. A
   * pessoa navegava a loja, montava o carrinho, e só descobria o que
   * faltava no checkout, com o cartão na mão. E a home ainda mostrava um
   * card "Add your ship" que não deveria precisar existir.
   *
   * Custa uma consulta por navegação de quem está logado — uma linha por
   * chave primária. É o preço de a regra valer em todo caminho de
   * entrada em vez de só naquele que alguém lembrou de cobrir.
   */
  if (user && !LIVRES.some((p) => pathname.startsWith(p))) {
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
        if (pathname !== "/") url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    } catch {
      // Banco fora do ar não pode trancar a loja: sem resposta, deixa
      // passar. O checkout continua barrando pelo missingProfileFields.
    }
  }

  return supabaseResponse;
}
