import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import SiteHeader from "./SiteHeader";
import SessaoSeed from "./SessaoSeed";
import { buildTree, type Category, type CategoryNode } from "@/lib/catalog";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";

/**
 * O cabeçalho de todas as telas. Como ele mora no layout raiz, tudo que
 * ele faz, ele faz UMA VEZ POR PÁGINA DO SITE — e era aí que estava a
 * lentidão que parecia não ter dono.
 *
 * Primeiro corte (já feito): eram três idas ao Supabase EM SEQUÊNCIA —
 * árvore de categorias, contagem de desejos e getUser(). A árvore foi
 * para unstable_cache com a tag "catalog", e o resto passou a rodar em
 * paralelo.
 *
 * Este é o segundo corte, e é o que faltava. Paralelizar encurtou a
 * espera; não mudou a NATUREZA dela. Enquanto o cabeçalho lesse cookie,
 * nenhuma página do site podia ser guardada pronta: um `cookies()` no
 * layout raiz marca a rota inteira como dinâmica, e o layout raiz está
 * em todas. Cada visita a /faq — texto que não muda há meses — abria
 * uma função na Vercel e uma conexão com o banco para descobrir se
 * havia sessão, para desenhar um cabeçalho que é igual para todo mundo.
 *
 * Agora o corpo daqui é IMÓVEL: a árvore de categorias, e nada mais. O
 * que depende de quem está olhando saiu para <SessaoSeed/>, dentro de
 * um <Suspense> — que é o buraco que o PPR deixa em branco no HTML
 * guardado e preenche por visitante. Com `ppr: "incremental"` no
 * next.config, cada rota escolhe entrar (ver `experimental_ppr`), então
 * o que não foi auditado continua se comportando exatamente como antes.
 *
 * Cliente anônimo de propósito: unstable_cache não pode tocar em nada
 * de escopo de requisição, e a RLS de leitura pública cobre categories
 * ativas.
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

export default async function SiteChrome() {
  const tree = await carregarArvore();

  return (
    <>
      {/* Componente de CLIENTE: busca a sessão depois da tela pintada.
          É o que permite este arquivo inteiro ser imóvel. */}
      <SessaoSeed />
      <SiteHeader tree={tree} />
    </>
  );
}
