"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localInputToIso } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mailer";
import type { EmailKind } from "@/lib/emails";
import { DELIVERY_BUCKET, type OrderStatus } from "@/lib/types";
import type { TablesUpdate } from "@/lib/database.types";

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return null;
  return supabase;
}

// Transições permitidas no board (RLS garante que só admin atualiza)
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
// order_emails garante que cada um sai uma vez só, mesmo quando o
// webhook do Stripe e o admin marcam o mesmo estado.
const EMAIL_ON: Partial<Record<OrderStatus, EmailKind>> = {
  deposit_paid: "deposit_paid",
  at_gangway: "at_gangway",
  delivered: "delivered",
};

export async function setOrderStatus(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as OrderStatus;
  if (!id || !to) return;

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!order) return;
  if (!TRANSITIONS[order.status as OrderStatus]?.includes(to)) return;

  /* O estado anterior fica gravado a cada mudança: é o que o botão
     "Undo" restaura. Sem isto, `credited`/`cancelled`/`delivered` eram
     becos sem saída — e o clique errado só se desfazia com SQL na mão. */
  const patch: TablesUpdate<"orders"> = {
    status: to,
    previous_status: order.status,
    status_changed_at: new Date().toISOString(),
  };
  if (to === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return;

  const kind = EMAIL_ON[to];
  if (kind) await sendOrderEmail(supabase, id, kind);

  revalidatePath("/admin");
  revalidatePath("/admin/shopping-list");
  revalidatePath(`/orders`);
}

/**
 * Um passo atrás.
 *
 * Restaura o estado que `previous_status` guardou e zera a coluna: um
 * passo, não uma pilha — desfazer em cadeia esconderia de quem olha o
 * board o que de fato aconteceu com o pedido.
 *
 * Recusa quando o crédito do desvio já virou dinheiro no razão: aí não
 * é mais um clique errado de status, é saldo na conta de alguém, e
 * desfazer em silêncio deixaria o crédito órfão. Esse caso pede
 * estorno explícito, não um botão.
 *
 * O e-mail já enviado NÃO é desreivindicado de propósito: se o cliente
 * recebeu "entregue", mandar de novo depois do conserto é pior que
 * calar. O livro-razão continua sendo a memória do que saiu.
 */
export async function revertOrderStatus(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: order } = await supabase
    .from("orders")
    .select("status, previous_status")
    .eq("id", id)
    .maybeSingle();
  if (!order?.previous_status) return;

  // Dinheiro já lançado no razão: não se desfaz por botão.
  const { count } = await supabase
    .from("credits")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);
  if ((count ?? 0) > 0) return;

  const patch: TablesUpdate<"orders"> = {
    status: order.previous_status,
    previous_status: null,
    status_changed_at: new Date().toISOString(),
  };
  // Saiu de "entregue": a data da entrega deixa de valer.
  if (order.status === "delivered") patch.delivered_at = null;

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return;

  revalidatePath("/admin");
  revalidatePath("/admin/shopping-list");
  revalidatePath("/orders");
}

/**
 * Entrega com foto-comprovante.
 *
 * A foto é a prova de que a caixa chegou na prancha — é o que separa
 * "entreguei" de "diz que entregou" quando o comandante contesta. Sobe
 * primeiro para o bucket privado, e só depois o caminho é gravado no
 * pedido: é o registro no pedido que autoriza o dono a ver a imagem
 * (policy de storage), então arquivo órfão não vaza para ninguém.
 */
export async function markDelivered(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!order) return;
  if (!TRANSITIONS[order.status as OrderStatus]?.includes("delivered")) return;

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
    // Foto é desejável, não bloqueante: sem ela a entrega ainda fecha.
    if (!upErr) patch.delivery_photo_path = path;
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return;

  await sendOrderEmail(supabase, id, "delivered");

  revalidatePath("/admin");
  revalidatePath("/admin/shopping-list");
  revalidatePath("/orders");
}

export async function saveShip(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().toUpperCase();
  const berth = String(formData.get("berth") ?? "").trim();
  const etaLocal = String(formData.get("eta") ?? "");
  const cutoff = Math.max(1, Math.min(240, Number(formData.get("cutoff_hours") ?? 72)));
  const active = formData.get("active") === "on";
  if (!name || !etaLocal) return;

  const row = {
    name,
    berth: berth || null,
    eta: localInputToIso(etaLocal),
    cutoff_hours: cutoff,
    active,
  };

  if (id) await supabase.from("ships").update(row).eq("id", id);
  else await supabase.from("ships").insert(row);

  revalidatePath("/admin/ships");
  revalidatePath("/");
}

export async function saveProduct(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "📦").trim() || "📦";
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim() || "General";
  const price = Number(formData.get("price_usd") ?? 0);
  const sort = Number.isFinite(Number(formData.get("sort_order")))
    ? Number(formData.get("sort_order"))
    : 100;
  const active = formData.get("active") === "on";
  if (!name || !Number.isFinite(price) || price < 0) return;

  const row = {
    name,
    emoji,
    description: description || null,
    category,
    price_usd: Math.round(price * 100) / 100,
    sort_order: sort,
    active,
  };

  if (id) await supabase.from("products").update(row).eq("id", id);
  else await supabase.from("products").insert(row);

  revalidatePath("/admin/products");
}

/** Publica ou esconde um navio do line-up com um toque (fila de curadoria). */
export async function toggleShipActive(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (!id) return;

  await supabase.from("ships").update({ active }).eq("id", id);
  revalidatePath("/admin/ships");
  revalidatePath("/");
}
