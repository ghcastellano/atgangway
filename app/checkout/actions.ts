"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { depositIdempotencyKey, getStripe, stripeConfigured } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";
import { usd } from "@/lib/format";
import { placeOrderErrorMessage, type PlaceOrderRpcError } from "@/lib/pedido";
import { sessionUser } from "@/lib/supabase/session";
import { cronometrar, medir } from "@/lib/metricas";

export type PlaceOrderInput = {
  /** Uma por TENTATIVA de compra, gerada no navegador: reenviar a mesma
   *  tentativa (retry de rede, clique duplo) devolve o MESMO pedido;
   *  carrinho editado gera chave nova e pedido novo. */
  idempotencyKey: string;
  /** Opcional: a grade do porto manda na promessa, não o navio. */
  shipId?: string | null;
  applyCredit: boolean;
  contactName: string;
  contactWhatsapp: string;
  note: string;
  items: { id: string; qty: number }[];
};

export type PlaceOrderResult =
  | { ok: true; code: string; payUrl?: string; creditApplied: number; paid: boolean }
  | { ok: false; error: string };

const round2 = (v: number) => Math.round(v * 100) / 100;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? SITE_URL;
}

type SessionInput = {
  orderId: string;
  code: string;
  shipName: string;
  amountUsd: number;
  balanceUsd: number;
  email?: string;
};

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Sessão do Stripe Checkout em DÓLAR.
 *
 * Era em real, convertido por uma constante de build. Três problemas de
 * uma vez: a constante ficou 3% fora do câmbio real e isso virou
 * sobrepreço; o público é estrangeiro e pensa em dólar; e a isenção
 * federal de PIS/COFINS do fornecimento de bordo (MP 2.158-35, art. 14,
 * IV) exige pagamento em moeda conversível — cobrar em real a perde.
 *
 * O preço do catálogo já é em centavos de dólar, então aqui não há
 * conversão nenhuma: some a fonte de erro junto com o câmbio.
 */
async function createDepositSession(db: Db, input: SessionInput, origin: string) {
  const stripe = getStripe();
  const usdCents = Math.max(50, Math.round(input.amountUsd * 100));
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: input.orderId,
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: usdCents,
            product_data: {
              name: `Deposit — Order ${input.code}`,
              description: `${input.shipName} · gangway delivery in Santos · balance ${usd(
                input.balanceUsd
              )} on delivery`,
            },
          },
        },
      ],
      metadata: {
        order_id: input.orderId,
        order_code: input.code,
        amount_usd: String(input.amountUsd),
      },
      success_url: `${origin}/orders/${input.code}?paid=1`,
      // cancelled=1: quem fechou o Stripe sem pagar não pode ler
      // "Order confirmed" — a página do pedido mostra "reserved" e o
      // botão de pagar.
      cancel_url: `${origin}/orders/${input.code}?placed=1&cancelled=1`,
    },
    // Mesmo pedido + mesmo valor = a MESMA session de volta por 24h: o
    // clique duplo e o retry caem na mesma página de pagamento em vez
    // de abrir duas cobranças paralelas.
    { idempotencyKey: depositIdempotencyKey(input.orderId, usdCents) }
  );

  // O id da session fica no pedido, para o webhook e a conciliação.
  // Best-effort — mas com o erro LOGADO, não engolido: o webhook também
  // grava o id quando confirma, então falhar aqui não perde dinheiro.
  const { error } = await db.rpc("set_order_stripe_session", {
    p_order: input.orderId,
    p_session: session.id,
  });
  if (error) {
    console.error(
      JSON.stringify({ at: "set_order_stripe_session", order: input.orderId, message: error.message })
    );
  }
  return session;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const user = await sessionUser(supabase);
  if (!user) return { ok: false, error: "You need to sign in to place an order." };

  // Sem chave de idempotência (ou fora do formato) não há como prometer
  // "reenviar não duplica" — e isso é promessa, não otimização.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.idempotencyKey ?? ""
    )
  ) {
    return { ok: false, error: "Couldn't place the order — refresh and try again." };
  }

  const items = (input.items ?? []).filter(
    (i) => typeof i.id === "string" && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 99
  );
  if (items.length === 0) return { ok: false, error: "Your kit is empty." };

  /* O pedido INTEIRO acontece numa transação só, dentro da RPC
     place_order: janela da escala (falha fechado), catálogo vivo, preço
     SEMPRE do banco, mínimo do porto, inserts de pedido+itens e o
     crédito Captain — que agora aborta tudo se falhar, em vez de ser
     engolido e cobrar o depósito cheio em silêncio. O que existia aqui
     (quatro escritas soltas e um delete compensatório com resultado
     ignorado) foi aposentado junto com a chance de um reenvio criar
     dois pedidos: a mesma chave devolve o MESMO pedido, inclusive na
     corrida de duas chamadas simultâneas. Aqui fica a tradução dos
     códigos da RPC nas frases de sempre — lib/pedido.ts. */
  const { data, error } = await cronometrar("pedido.rpc_ms", async () =>
    supabase.rpc("place_order", {
    p_key: input.idempotencyKey,
    p_ship: input.shipId ?? undefined,
    p_apply_credit: Boolean(input.applyCredit),
    p_contact_name: input.contactName ?? undefined,
    p_contact_whatsapp: input.contactWhatsapp ?? undefined,
    p_note: input.note ?? undefined,
    p_items: items,
    }));
  if (error || !data) {
    console.error(
      JSON.stringify({ at: "place_order", user: user.id, message: error?.message ?? "sem retorno" })
    );
    // Falha de infraestrutura: o pedido não existiu. Vale um alarme.
    medir("pedido.tentativa", 1, { resultado: "falha_rpc" });
    return { ok: false, error: "Couldn't place the order — try again." };
  }

  const r = data as
    | {
        ok: true;
        duplicate: boolean;
        id: string;
        code: string;
        status: string;
        deposit_usd: number | string;
        balance_usd: number | string;
        credit_applied_usd: number | string;
        vessel_name: string | null;
      }
    | PlaceOrderRpcError;
  if (!r.ok) {
    // r.error é um conjunto FECHADO de códigos da RPC (out_of_stock,
    // no_window, below_minimum…), então serve de tag; a mensagem em
    // inglês que o cliente lê, não.
    medir("pedido.tentativa", 1, { resultado: r.error });
    return { ok: false, error: placeOrderErrorMessage(r) };
  }

  const applied = Number(r.credit_applied_usd ?? 0);
  const dueNow = round2(Number(r.deposit_usd) - applied);

  // Pedido de verdade. `duplicate` é o reenvio da mesma chave de
  // idempotência — conta como tentativa, não como venda nova.
  medir("pedido.tentativa", 1, { resultado: r.duplicate ? "duplicado" : "criado" });
  if (!r.duplicate) {
    medir("pedido.deposito_usd", dueNow);
    medir("pedido.saldo_usd", Number(r.balance_usd ?? 0));
  }

  if (r.status === "deposit_paid" || dueNow <= 0.009) {
    // Crédito cobriu tudo (ou o reenvio achou um pedido já pago):
    // nada a cobrar agora.
    return { ok: true, code: r.code, creditApplied: applied, paid: true };
  }

  if (stripeConfigured()) {
    try {
      const session = await createDepositSession(
        supabase,
        {
          orderId: r.id,
          code: r.code,
          shipName: r.vessel_name ?? "your vessel",
          amountUsd: dueNow,
          balanceUsd: Number(r.balance_usd),
          email: user.email ?? undefined,
        },
        await siteOrigin()
      );
      if (session.url) {
        return {
          ok: true,
          code: r.code,
          payUrl: session.url,
          creditApplied: applied,
          paid: false,
        };
      }
    } catch {
      // Stripe indisponível não pode matar o pedido — cai no fluxo manual
    }
  }

  return { ok: true, code: r.code, creditApplied: applied, paid: false };
}

// Retomada de pagamento (ex.: fechou o Stripe no meio) a partir da página do pedido
export async function payOrderDeposit(code: string): Promise<{ url?: string; error?: string }> {
  if (!stripeConfigured()) return { error: "Online payment isn't enabled yet." };

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) return { error: "Sign in first." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, code, status, deposit_usd, credit_applied_usd, balance_usd, ships(name)")
    .eq("code", code.toUpperCase())
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status !== "awaiting_deposit") return { error: "This deposit is already settled." };

  const dueNow = round2(Number(order.deposit_usd) - Number(order.credit_applied_usd));
  if (dueNow <= 0.009) return { error: "This deposit is already covered by credit." };

  const shipName =
    (order.ships as unknown as { name: string } | null)?.name ?? "your vessel";

  try {
    const session = await createDepositSession(
      supabase,
      {
        orderId: order.id,
        code: order.code,
        shipName,
        amountUsd: dueNow,
        balanceUsd: Number(order.balance_usd),
        email: user.email ?? undefined,
      },
      await siteOrigin()
    );
    if (session.url) return { url: session.url };
    return { error: "Couldn't start the payment — try again." };
  } catch {
    return { error: "Couldn't start the payment — try again." };
  }
}
