"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";

export type WishResult = { ok: boolean; wished: boolean; needsAuth?: boolean };

/**
 * Só a página da lista precisa ser redesenhada. O selo do ♡ no
 * cabeçalho já não depende do servidor: vive no navegador (lib/wish) e
 * muda no toque. O `revalidatePath("/", "layout")` que ficava aqui
 * redesenhava o site inteiro para trocar um dígito — e era isso que o
 * cliente esperava, segundos, depois de cada coração.
 */
function refreshWishViews() {
  revalidatePath("/wishlist");
}

/**
 * Liga/desliga o item na lista de desejos.
 *
 * Devolve `needsAuth` em vez de redirecionar: quem chama é um botão no
 * meio da grade, e arrancar a pessoa da listagem para uma tela de
 * login no meio da navegação é o jeito mais rápido de perder a visita.
 * O botão manda para o login guardando o caminho de volta.
 */
export async function toggleWish(productId: string): Promise<WishResult> {
  if (!productId) return { ok: false, wished: false };

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) return { ok: false, wished: false, needsAuth: true };

  const { data: existing } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
    refreshWishViews();
    return { ok: true, wished: false };
  }

  const { error } = await supabase
    .from("wishlists")
    .insert({ user_id: user.id, product_id: productId });
  // Falha silenciosa aqui foi o que impediu de enxergar o problema da
  // primeira vez: o coração voltava atrás e não sobrava rastro nenhum
  // no log para dizer por quê.
  if (error) {
    console.error(
      JSON.stringify({ at: "wish_insert", user: user.id, product: productId, code: error.code, message: error.message })
    );
    return { ok: false, wished: false };
  }

  refreshWishViews();
  return { ok: true, wished: true };
}

/**
 * Grava de uma vez os corações marcados antes do login.
 *
 * O botão guarda o id no aparelho quando não há sessão e manda para o
 * login; quem chama aqui é o WishClaim, assim que a sessão existe.
 * Vale para cadastro por e-mail e para o Google — nos dois o item
 * aparece na lista sem a pessoa precisar procurar o produto de novo.
 */
export async function claimWishes(
  productIds: string[]
): Promise<{ ok: boolean; saved: number; needsAuth?: boolean }> {
  const ids = [...new Set((productIds ?? []).filter((s) => typeof s === "string" && s))].slice(0, 50);
  if (ids.length === 0) return { ok: true, saved: 0 };

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  // Ainda sem sessão: devolve sem apagar a fila, para tentar de novo.
  if (!user) return { ok: false, saved: 0, needsAuth: true };

  // Um id morto na fila (produto saiu do catálogo) derrubaria o lote
  // inteiro pela chave estrangeira, e a pessoa perderia os outros
  // junto. Confere antes o que ainda existe e grava só isso.
  const { data: alive } = await supabase
    .from("products")
    .select("id")
    .in("id", ids)
    .eq("active", true);

  const rows = (alive ?? []).map((p) => ({ user_id: user.id, product_id: p.id as string }));
  if (rows.length === 0) return { ok: true, saved: 0 };

  const { error } = await supabase
    .from("wishlists")
    .upsert(rows, { onConflict: "user_id,product_id", ignoreDuplicates: true });

  if (error) {
    console.error(
      JSON.stringify({ at: "wish_claim", user: user.id, count: rows.length, code: error.code, message: error.message })
    );
    return { ok: false, saved: 0 };
  }

  refreshWishViews();
  return { ok: true, saved: rows.length };
}
