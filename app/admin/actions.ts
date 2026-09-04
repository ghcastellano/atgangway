"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { localInputToIso } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mailer";
import type { EmailKind } from "@/lib/emails";
import { DELIVERY_BUCKET, type OrderStatus, type Ship } from "@/lib/types";
import type { TablesUpdate } from "@/lib/database.types";
import { PEDIDO_SELECT, type Pedido, type Resultado } from "@/lib/painel";

/**
 * As actions do painel devolvem a LINHA nova em vez de revalidar a
 * página inteira. Antes, cada clique reconstruía o board no servidor
 * (todas as consultas, todos os pedidos) só para trocar um status — e a
 * tela ficava idêntica até isso voltar, de meio segundo a três segundos
 * na rede do cais. Agora a tela troca o pedido na hora (otimista), a
 * action confirma com a linha real, e só as rotas do CLIENTE são
 * revalidadas, porque lá não há estado no navegador para atualizar.
 */

// Transições permitidas (a RLS garante que só admin atualiza)
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_deposit: ["deposit_paid", "cancelled"],
  deposit_paid: ["preparing", "credited", "cancelled"],
  preparing: ["at_gangway", "credited", "cancelled"],
  at_gangway: ["delivered", "credited"],
  delivered: [],
  credited: [],
  cancelled: [],
};

// Estados que valem um e-mail para o marinheiro. O livro-razão
// order_emails garante que cada um sai uma vez só.
const EMAIL_ON: Partial<Record<OrderStatus, EmailKind>> = {
  deposit_paid: "deposit_paid",
  at_gangway: "at_gangway",
  delivered: "delivered",
};

const SEM_ACESSO = "Sua sessão expirou ou esta conta não é da equipe.";

function revalidaCliente() {
  revalidatePath("/orders");
  revalidatePath("/admin/shopping-list");
}

async function lerPedido(supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>, id: string) {
  const { data } = await supabase.from("orders").select(PEDIDO_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Pedido | null) ?? null;
}

export async function mudarStatus(id: string, to: OrderStatus): Promise<Resultado<Pedido>> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: SEM_ACESSO };
  if (!id || !to) return { ok: false, error: "Pedido inválido." };

  const { data: order } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (!TRANSITIONS[order.status as OrderStatus]?.includes(to)) {
    return { ok: false, error: "Esse pedido já mudou de estado em outra tela. Atualize a lista." };
  }

  const patch: TablesUpdate<"orders"> = {
    status: to,
    previous_status: order.status,
    status_changed_at: new Date().toISOString(),
  };
  if (to === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: "O banco recusou a mudança. Tente de novo." };

  const kind = EMAIL_ON[to];
  if (kind) await sendOrderEmail(supabase, id, kind);

  revalidaCliente();
  const row = await lerPedido(supabase, id);
  return row ? { ok: true, row } : { ok: false, error: "Mudou, mas não consegui reler o pedido." };
}

/**
 * Um passo atrás. Restaura previous_status e o zera: um passo, não uma
 * pilha. Recusa quando o crédito do desvio já virou dinheiro no razão.
 */
export async function desfazerStatus(id: string): Promise<Resultado<Pedido>> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: SEM_ACESSO };

  const { data: order } = await supabase
    .from("orders")
    .select("status, previous_status")
    .eq("id", id)
    .maybeSingle();
  if (!order?.previous_status) return { ok: false, error: "Não há o que desfazer." };

  const { count } = await supabase
    .from("credits")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "O crédito já foi lançado na conta do cliente — desfazer exige estorno explícito." };
  }

  const patch: TablesUpdate<"orders"> = {
    status: order.previous_status,
    previous_status: null,
    status_changed_at: new Date().toISOString(),
  };
  if (order.status === "delivered") patch.delivered_at = null;

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: "O banco recusou. Tente de novo." };

  revalidaCliente();
  const row = await lerPedido(supabase, id);
  return row ? { ok: true, row } : { ok: false, error: "Desfez, mas não consegui reler o pedido." };
}

/**
 * Entrega com foto-comprovante. Sobe primeiro para o bucket privado e
 * só depois grava o caminho no pedido (é o pedido que autoriza o dono a
 * ver a imagem). Foto é desejável, não bloqueante.
 */
export async function entregar(formData: FormData): Promise<Resultado<Pedido>> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: SEM_ACESSO };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Pedido inválido." };

  const { data: order } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (!TRANSITIONS[order.status as OrderStatus]?.includes("delivered")) {
    return { ok: false, error: "Só pedido na escada pode ser entregue." };
  }

  const patch: TablesUpdate<"orders"> = {
    status: "delivered",
    previous_status: order.status,
    status_changed_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
  };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0 && photo.size <= 8 * 1024 * 1024) {
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const path = `orders/${id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(DELIVERY_BUCKET)
      .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: false });
    if (!upErr) patch.delivery_photo_path = path;
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: "O banco recusou a entrega. Tente de novo." };

  await sendOrderEmail(supabase, id, "delivered");
  revalidaCliente();
  const row = await lerPedido(supabase, id);
  return row ? { ok: true, row } : { ok: false, error: "Entregou, mas não consegui reler o pedido." };
}

/* ------------------------------------------------------------------ */
/* Navios                                                              */
/* ------------------------------------------------------------------ */

const SHIP_SELECT = "id, name, berth, eta, cutoff_hours, active, delay_hours, previous_eta, eta_source, ata";

export async function salvarNavio(formData: FormData): Promise<Resultado<Ship>> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: SEM_ACESSO };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().toUpperCase();
  const berth = String(formData.get("berth") ?? "").trim();
  const etaLocal = String(formData.get("eta") ?? "");
  const cutoff = Math.max(1, Math.min(240, Number(formData.get("cutoff_hours") ?? 72)));
  const active = formData.get("active") === "on";
  if (name.length < 3) return { ok: false, error: "Nome do navio precisa de 3 letras ou mais." };
  if (!etaLocal) return { ok: false, error: "Informe o ETA." };

  const row = { name, berth: berth || null, eta: localInputToIso(etaLocal), cutoff_hours: cutoff, active };

  const q = id
    ? supabase.from("ships").update(row).eq("id", id).select(SHIP_SELECT).single()
    : supabase.from("ships").insert(row).select(SHIP_SELECT).single();
  const { data, error } = await q;
  if (error || !data) return { ok: false, error: "O banco recusou a escala. Confira os campos." };

  revalidatePath("/");
  return { ok: true, row: data as Ship };
}

/** Publica ou esconde uma escala do line-up com um toque. */
export async function publicarNavio(id: string, active: boolean): Promise<Resultado<Ship>> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: SEM_ACESSO };
  if (!id) return { ok: false, error: "Escala inválida." };

  const { data, error } = await supabase
    .from("ships")
    .update({ active })
    .eq("id", id)
    .select(SHIP_SELECT)
    .single();
  if (error || !data) return { ok: false, error: "O banco recusou. Tente de novo." };

  revalidatePath("/");
  return { ok: true, row: data as Ship };
}
