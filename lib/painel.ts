/**
 * Vocabulário do painel (staff, em português) e a forma dos dados que
 * a tela de pedidos consome. Sem next/headers aqui: este módulo é
 * importado pelo servidor E pelos componentes de cliente do painel.
 */
import type { OrderStatus } from "./types";
import { callState, canOrder, type CallFacts } from "./callstate.ts";

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

/* ------------------------------------------------------------------ */
/* Navios: as pilhas da tela, com a régua única de lib/callstate      */
/* ------------------------------------------------------------------ */

/** Horizonte da publicação automática — o mesmo 14 de rotate_ship_calls. */
export const PUBLISH_HORIZON_DAYS = 14;

export type Pilha = "espera" | "vendendo" | "fechadas" | "fora" | "escondidas";

export const PILHA_PT: Record<Pilha, string> = {
  espera: "Publica sozinho",
  vendendo: "Vendendo",
  fechadas: "Corte passado",
  fora: "Fora de cena",
  escondidas: "Escondidas",
};

export type EscalaFacts = CallFacts & { active: boolean; hidden_at?: string | null };

/**
 * Em que pilha uma escala está.
 *
 * Publicada: vendendo, ou corte passado (o navio ainda está na escala;
 * a rotação a aposenta 48 h depois da ETA). Não publicada: se a janela
 * já fechou, está FORA DE CENA — zarpou, ou entrou no line-up tarde
 * demais para vender; ninguém "perdeu" essa escala, ela acabou. Se
 * ainda vende, ou a equipe escondeu, ou ela só espera o horizonte de
 * 14 dias para a rotação publicar sozinha.
 *
 * Havia três pilhas e as escalas aposentadas não caíam em nenhuma:
 * sumiam da tela sem deixar rastro. Agora toda escala tem uma pilha.
 */
export function pilhaDaEscala(s: EscalaFacts, agora = new Date()): Pilha {
  const aberta = canOrder(callState(s, agora));
  if (s.active) return aberta ? "vendendo" : "fechadas";
  if (!aberta) return "fora";
  return s.hidden_at ? "escondidas" : "espera";
}

/** Quando a rotação publica sozinha: ETA − horizonte. */
export const publicaEm = (eta: string | Date) =>
  new Date(new Date(eta).getTime() - PUBLISH_HORIZON_DAYS * 86400e3);

/**
 * Deveria estar publicada e não está: ETA dentro do horizonte, ninguém
 * escondeu, e continua inativa. A rotação roda de hora em hora, na mesma
 * chamada do sync que cria a escala — se isto for maior que zero, o
 * cron parou. É o único contador vermelho da tela.
 */
export function deveriaTerPublicado(s: EscalaFacts, agora = new Date()): boolean {
  if (s.active || s.hidden_at) return false;
  const eta = new Date(s.eta).getTime();
  return eta > agora.getTime() && eta < agora.getTime() + PUBLISH_HORIZON_DAYS * 86400e3;
}

/* ------------------------------------------------------------------ */
/* Não entregues: mercadoria comprada para navio que não veio         */
/* ------------------------------------------------------------------ */

export const SOBRA_SELECT =
  "id, code, status, previous_status, user_id, subtotal_cents, subtotal_usd, deposit_cents, deposit_usd, contact_name, contact_rank, contact_whatsapp, created_at, status_changed_at, leftover_note, leftover_resolved_at, vessel_name, ships(name, eta, ata, cutoff_hours), credits(amount_usd, kind, created_at), order_items(name, sku, qty, unit_price_cents, unit_price_usd, image_path)";

export type ProximaEscala = {
  name: string;
  eta: string;
  ata: string | null;
  berth: string | null;
  cutoff_hours: number | null;
  active: boolean;
};

export type SobraBruta = {
  id: string;
  code: string;
  status: OrderStatus;
  previous_status: OrderStatus | null;
  user_id: string;
  subtotal_cents: number | null;
  subtotal_usd: number;
  deposit_cents: number | null;
  deposit_usd: number;
  contact_name: string | null;
  contact_rank: string | null;
  contact_whatsapp: string | null;
  created_at: string;
  status_changed_at: string | null;
  leftover_note: string | null;
  leftover_resolved_at: string | null;
  vessel_name: string | null;
  ships: { name: string; eta: string; ata: string | null; cutoff_hours: number | null } | null;
  credits: { amount_usd: number; kind: string; created_at: string }[];
  order_items: PedidoItem[];
};

/** A sobra como a tela consome: o pedido, mais quem é o cliente hoje
 *  (perfil e próxima escala conhecida) e quanto crédito ele tem. */
export type Sobra = SobraBruta & {
  cliente: {
    full_name: string | null;
    email: string | null;
    whatsapp: string | null;
    vessel_name: string | null;
    proxima: ProximaEscala | null;
  } | null;
  saldo_usd: number;
};

/**
 * Um pedido é sobra quando a mercadoria foi comprada — chegou a "em
 * separação" ou "na escada" — e não foi entregue: creditado vindo de um
 * desses estados, ou ainda aberto num deles com o navio já ido.
 * Depósito pago sem separação não é sobra: nada foi comprado, o crédito
 * resolve sozinho.
 */
export function ehSobra(
  o: { status: OrderStatus; previous_status: OrderStatus | null; ships: CallFacts | null },
  agora = new Date()
): boolean {
  if (o.status === "credited") return o.previous_status === "preparing" || o.previous_status === "at_gangway";
  if (o.status === "preparing" || o.status === "at_gangway") return !!o.ships && callState(o.ships, agora) === "sailed";
  return false;
}
