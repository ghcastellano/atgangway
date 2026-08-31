export type Ship = {
  id: string;
  name: string;
  berth: string | null;
  eta: string;
  cutoff_hours: number;
  active: boolean;
  delay_hours?: number | null;
  previous_eta?: string | null;
  eta_source?: string | null;
  ata?: string | null;
};

/** Atraso só é notícia para o cliente a partir de 2h. */
export const delayLabel = (s: { delay_hours?: number | null }) => {
  const h = Number(s.delay_hours ?? 0);
  if (h >= 2) return `DELAYED +${Math.round(h)}H`;
  if (h <= -2) return `EARLY ${Math.abs(Math.round(h))}H`;
  return null;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  category: string;
  price_usd: number;
  active: boolean;
  sort_order: number;
};

/** Bucket privado das fotos de entrega. */
export const DELIVERY_BUCKET = "delivery-proofs";

export type OrderStatus =
  | "awaiting_deposit"
  | "deposit_paid"
  | "preparing"
  | "at_gangway"
  | "delivered"
  | "credited"
  | "cancelled";

export type PaymentMethod = "card" | "wallet" | "pix";

export type Order = {
  id: string;
  code: string;
  user_id: string;
  ship_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  subtotal_usd: number;
  deposit_usd: number;
  balance_usd: number;
  contact_name: string | null;
  contact_whatsapp: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  emoji: string | null;
  unit_price_usd: number;
  qty: number;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "admin";
};

export const ORDER_FLOW: OrderStatus[] = [
  "awaiting_deposit",
  "deposit_paid",
  "preparing",
  "at_gangway",
  "delivered",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  deposit_paid: "Deposit received",
  preparing: "Shopping & packing",
  at_gangway: "At the gangway",
  delivered: "Delivered on board",
  credited: "Credited (ship diverted)",
  cancelled: "Cancelled",
};

export const STATUS_PILL: Record<OrderStatus, "amber" | "teal" | "danger" | "faint"> = {
  awaiting_deposit: "amber",
  deposit_paid: "teal",
  preparing: "amber",
  at_gangway: "teal",
  delivered: "faint",
  credited: "teal",
  cancelled: "danger",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  card: "International card",
  wallet: "Apple Pay / Google Pay",
  pix: "PIX",
};
