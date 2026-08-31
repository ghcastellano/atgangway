/**
 * Marcas que têm ao menos um produto ativo.
 *
 * Mora aqui, e não em lib/catalog.ts, pelo mesmo motivo de
 * lib/wishlist.ts: abre o cliente do Supabase, e catalog.ts é
 * importado por componentes de cliente.
 *
 * Listar marca sem produto é oferecer um filtro que devolve tela
 * vazia — a lista de marcas de um chandler cresce com o catálogo,
 * não com o que está à venda hoje.
 *
 * Duas consultas baratas em vez de um embed !inner: o embed traria a
 * lista inteira de produtos de cada marca só para descobrir se ela tem
 * algum. A segunda lê uma coluna só.
 */

import { createClient } from "@/lib/supabase/server";
import type { BrandOption } from "@/lib/catalog";

export async function listBrandsInUse(): Promise<BrandOption[]> {
  try {
    const supabase = await createClient();
    const [marcas, usadas] = await Promise.all([
      supabase.from("brands").select("id, slug, name").eq("active", true).order("sort_order"),
      supabase.from("products").select("brand_id").eq("active", true).not("brand_id", "is", null),
    ]);
    const emUso = new Set(
      ((usadas.data ?? []) as { brand_id: string | null }[]).map((p) => p.brand_id)
    );
    return ((marcas.data ?? []) as BrandOption[]).filter((b) => emUso.has(b.id));
  } catch {
    // Filtro é conveniência: sem marcas a listagem segue inteira.
    return [];
  }
}
