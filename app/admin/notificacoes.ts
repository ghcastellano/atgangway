"use server";

import { requireAdmin } from "@/lib/admin";

/** Marca avisos como lidos. Otimista na tela; aqui só confirma. */
export async function marcarNotificacoesLidas(ids: string[]): Promise<{ ok: boolean }> {
  const supabase = await requireAdmin();
  if (!supabase || ids.length === 0) return { ok: false };
  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids.slice(0, 200))
    .is("read_at", null);
  return { ok: !error };
}
