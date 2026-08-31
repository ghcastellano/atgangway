import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import SiteHeader from "./SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { buildTree, type Category, type CategoryNode } from "@/lib/catalog";
import { wishCount } from "@/lib/wishlist";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";

/**
 * O cabeçalho de todas as telas. Como ele mora no layout raiz, tudo que
 * ele faz, ele faz UMA VEZ POR PÁGINA DO SITE — e era aí que estava a
 * lentidão que parecia não ter dono.
 *
 * Eram três idas ao Supabase, em SEQUÊNCIA: a árvore de categorias, a
 * contagem de desejos e o getUser(). O tempo era a soma das três, e
 * pagava em toda tela — inclusive nas que não têm dado nenhum. Medido
 * aqui, /faq (texto puro, zero consultas próprias) respondia em ~400 ms
 * contra 2 ms de um arquivo estático. Não era o middleware, como cheguei
 * a supor e a testar: era o cabeçalho perguntando três coisas ao banco
 * antes de desenhar uma página que não precisava de nenhuma delas.
 *
 * Duas correções:
 *
 * 1. A árvore de categorias sai do caminho crítico. Ela é IDÊNTICA para
 *    todo visitante e muda quando o catálogo muda — ou seja, quase
 *    nunca. Vai para unstable_cache com a tag "catalog", a mesma que as
 *    ações do admin já invalidam, então editar categoria continua
 *    aparecendo na hora. Cliente anônimo de propósito: unstable_cache
 *    não pode tocar em nada de escopo de requisição (cookies() aborta o
 *    cache), e a RLS de leitura pública cobre categories ativas.
 *
 * 2. O que sobrou roda em PARALELO. As duas restantes são por usuário e
 *    não dá para cachear, mas nada obrigava uma a esperar a outra: o
 *    custo passa a ser o maior dos dois, não a soma dos três.
 *
 * O comentário antigo dizia que paralelizar "não adianta aqui, a árvore
 * já voltou". Estava certo sobre a ordem em que as linhas rodavam e
 * errado sobre a conclusão: a resposta não era aceitar a sequência, era
 * desfazê-la.
 */

const carregarArvore = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    if (!supabaseConfigured) return [];
    try {
      const db = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await db
        .from("categories")
        .select("id, parent_id, slug, name, icon, image_path, path, depth, active, sort_order")
        .eq("active", true)
        .order("sort_order");
      return buildTree((data ?? []) as Category[]);
    } catch {
      // Catálogo indisponível não pode derrubar o cabeçalho do site.
      return [];
    }
  },
  ["chrome-category-tree"],
  { revalidate: 300, tags: ["catalog"] }
);

/**
 * O cabeçalho precisa saber se há sessão: sem isso o menu mostrava
 * "Sign in / Sign out" como um link só, para /login, que não desloga
 * ninguém — quem estava logado clicava e nada acontecia.
 */
async function temSessao(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function SiteChrome() {
  const [tree, wishes, signedIn] = await Promise.all([
    carregarArvore(),
    wishCount(),
    temSessao(),
  ]);

  return <SiteHeader tree={tree} wishCount={wishes} signedIn={signedIn} />;
}
