/**
 * Vocabulário do painel (staff, em português) e a forma dos dados que
 * a tela de pedidos consome. Sem next/headers aqui: este módulo é
 * importado pelo servidor E pelos componentes de cliente do painel.
 */
import type { OrderStatus } from "./types";

export const STATUS_PT: Record<OrderStatus, string> = {
  awaiting_deposit: "Aguardando depósito",
  deposit_paid: "Depósito recebido",
  preparing: "Em separação",
  at_gangway: "Na escada",
  delivered: "Entregue",
  credited: "Creditado (desvio)",
  cancelled: "Cancelado",
};

/** Tom do selo: quanto mais perto do dinheiro entrar, mais quente. */
export const STATUS_TOM: Record<OrderStatus, "amber" | "teal" | "danger" | "faint" | "ok"> = {
  awaiting_deposit: "amber",
  deposit_paid: "teal",
  preparing: "teal",
  at_gangway: "ok",
  delivered: "faint",
  credited: "faint",
  cancelled: "danger",
};

/** O próximo passo natural de cada estado — o botão grande do pedido. */
export const PROXIMO: Partial<Record<OrderStatus, { to: OrderStatus; rotulo: string; ocupado: string }>> = {
  awaiting_deposit: { to: "deposit_paid", rotulo: "Confirmar depósito", ocupado: "Confirmando…" },
  deposit_paid: { to: "preparing", rotulo: "Iniciar separação", ocupado: "Iniciando…" },
  preparing: { to: "at_gangway", rotulo: "Levar à escada", ocupado: "Registrando…" },
};

export const ABERTOS: OrderStatus[] = ["awaiting_deposit", "deposit_paid", "preparing", "at_gangway"];

/** Colunas que a tela de pedidos precisa — uma só string, usada pela
 *  página e pelas actions, para a linha devolvida pela action ter a
 *  MESMA forma da linha carregada pela página. */
export const PEDIDO_SELECT =
  "id, code, status, previous_status, payment_method, subtotal_cents, subtotal_usd, deposit_cents, deposit_usd, balance_cents, balance_usd, credit_applied_usd, contact_name, contact_whatsapp, contact_rank, note, created_at, status_changed_at, delivered_at, delivery_photo_path, delivery_date, vessel_name, vessel_berth, ships(name, berth, eta, cutoff_hours, delay_hours, ata), order_items(name, sku, qty, unit_price_cents, unit_price_usd, image_path)";

export type PedidoItem = {
  name: string;
  sku: string | null;
  qty: number;
  unit_price_cents: number | null;
  unit_price_usd: number;
  image_path: string | null;
};

export type Pedido = {
  id: string;
  code: string;
  status: OrderStatus;
  previous_status: OrderStatus | null;
  payment_method: string | null;
  subtotal_cents: number | null;
  subtotal_usd: number;
  deposit_cents: number | null;
  deposit_usd: number;
  balance_cents: number | null;
  balance_usd: number;
  credit_applied_usd: number | null;
  contact_name: string | null;
  contact_whatsapp: string | null;
  contact_rank: string | null;
  note: string | null;
  created_at: string;
  status_changed_at: string | null;
  delivered_at: string | null;
  delivery_photo_path: string | null;
  delivery_date: string | null;
  vessel_name: string | null;
  vessel_berth: string | null;
  ships: {
    name: string;
    berth: string | null;
    eta: string;
    cutoff_hours: number | null;
    delay_hours: number | null;
    ata: string | null;
  } | null;
  order_items: PedidoItem[];
};

/** Resultado padrão das actions do painel: a linha nova vem junto, para
 *  a tela trocar só aquele pedido em vez de recarregar a página. */
export type Resultado<T> = { ok: true; row: T } | { ok: false; error: string };

const FUSO = "America/Sao_Paulo";

/** "04 set, 14:30" — sempre no relógio de Santos, onde a entrega acontece. */
export const quando = (iso: string | Date | null | undefined) =>
  iso
    ? new Date(iso)
        .toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        .replace(".", "")
    : "—";

/** "04 set" */
export const dia = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short" }).replace(".", "") : "—";

/** "há 3 h" / "em 2 d" — para a coluna de atualizado e para o corte. */
export function relativo(iso: string | Date | null | undefined, agora = Date.now()): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - agora;
  const abs = Math.abs(ms);
  const fut = ms > 0;
  const n =
    abs < 3600e3 ? `${Math.max(1, Math.round(abs / 60e3))} min` :
    abs < 48 * 3600e3 ? `${Math.round(abs / 3600e3)} h` :
    `${Math.round(abs / 86400e3)} d`;
  return fut ? `em ${n}` : `há ${n}`;
}

/** Centavos, com retaguarda para pedido gravado antes da virada para inteiro. */
export const cents = (c: number | null | undefined, usdLegado: number | string | null | undefined) =>
  c ?? Math.round(Number(usdLegado ?? 0) * 100);

export const brlUsd = (c: number) => `US$ ${(c / 100).toFixed(2)}`;
