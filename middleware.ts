import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /* Tudo, exceto estáticos, assets — e as quatro páginas de texto puro.
     *
     * O middleware não é só renovação de sessão: ele também barra rota
     * protegida e DESVIA perfil incompleto para /account. Rodando em
     * /faq, /terms, /privacy e /attributions, ele fazia as duas coisas
     * erradas de uma vez.
     *
     * A cara: medido aqui, uma dessas páginas custa ~400 ms de resposta
     * contra 2 ms de um arquivo estático, e ela não busca dado nenhum —
     * é ida ao Supabase para verificar um usuário que a página não usa.
     *
     * E a errada: quem estava logado com cadastro incompleto era
     * expulso da política de privacidade para a tela de conta. Ler os
     * termos antes de completar o cadastro é exatamente o que uma
     * pessoa cuidadosa faz, e o site respondia trancando a porta.
     *
     * Nenhuma das quatro é protegida, nenhuma é personalizada e nenhuma
     * depende de sessão: o cabeçalho lê o cookie por conta própria no
     * servidor, sem precisar do middleware. Quem ficar parado numa
     * delas por muito tempo tem o token renovado no próximo clique para
     * qualquer outra rota — o efeito se resolve sozinho.
     *
     * O caminho quente (home → listagem → produto) NÃO sai daqui de
     * propósito: carrinho e lista de desejos dependem da sessão, e
     * economizar o middleware ali custaria correção. */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|faq|terms|privacy|attributions|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
