"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";
import { orderCloseAt, santosTime, usd } from "@/lib/format";
import { callState, canOrder } from "@/lib/callstate";
import { splitOrder } from "@/lib/money";

export type PlaceOrderInput = {
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
async function createDepositSession(input: SessionInput, origin: string) {
  const stripe = getStripe();
  const usdCents = Math.max(50, Math.round(input.amountUsd * 100));
  return stripe.checkout.sessions.create({
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
    cancel_url: `${origin}/orders/${input.code}?placed=1`,
  });
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to sign in to place an order." };

  // WhatsApp é obrigatório: é o único canal que alcança um tripulante
  // que já embarcou. Validado no servidor, não só na tela.
  const wa = (input.contactWhatsapp ?? "").replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(wa)) {
    return { ok: false, error: "A valid WhatsApp number is required." };
  }

  const items = (input.items ?? []).filter(
    (i) => typeof i.id === "string" && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 99
  );
  if (items.length === 0) return { ok: false, error: "Your kit is empty." };

  // Navio, posto e porto vêm do PERFIL, que é onde o marinheiro os
  // mantém — o checkout só confirma. Ler daqui, e não de `ships`,
  // também conserta um bug real: a policy de ships escondia o navio
  // que ainda está na fila de curadoria, e o pedido era gravado sem
  // navio nenhum. O perfil guarda nome e bandeira desnormalizados
  // justamente para o pedido nunca depender dessa visibilidade.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, rank_slug, whatsapp, port_id, ship_id, vessel_name, vessel_imo, vessel_flag")
    .eq("id", user.id)
    .maybeSingle();

  const shipId = profile?.ship_id ?? input.shipId ?? null;
  let vesselName = profile?.vessel_name ?? null;
  if (shipId) {
    // A janela fecha NO SERVIDOR, não só no painel — e o guard falha
    // FECHADO: se a escala não pôde ser lida, não dá para provar que a
    // janela está aberta, e pedido aceito sem janela é promessa que a
    // operação não consegue cumprir (o chandler compra contra o pedido,
    // e a compra precisa da janela). A versão anterior pulava a
    // verificação em silêncio quando o select voltava vazio.
    const { data: navio } = await supabase
      .from("ships")
      .select("name, eta, ata, cutoff_hours")
      .eq("id", shipId)
      .maybeSingle();
    if (!vesselName) vesselName = navio?.name ?? null;

    if (!navio?.eta) {
      return {
        ok: false,
        error:
          "We couldn't verify your vessel's order window. Refresh and try again — " +
          "or pick your call again in My Account.",
      };
    }

    const estado = callState(navio);
    if (estado === "sailed") {
      // Escala morta não é "janela fechada" — é vínculo envelhecido. A
      // mensagem aponta o gesto certo (trocar de navio), não a espera
      // por uma janela que nunca reabre.
      return {
        ok: false,
        error:
          `${navio.name ?? "Your vessel"} has sailed. Pick your current vessel in ` +
          "My Account — your kit is saved and will be waiting.",
      };
    }
    if (!canOrder(estado)) {
      const fecha = orderCloseAt(navio.eta, navio.cutoff_hours ?? 24);
      return {
        ok: false,
        error:
          `The order window for ${navio.name ?? "this call"} closed on ${santosTime(fecha)}. ` +
          "Pick your next call in My Account and your kit will be waiting.",
      };
    }
  }

  // Preço e estoque moram na VARIANTE. O carrinho manda ids de
  // variante; o produto entra pelo join só para nome e foto.
  const ids = items.map((i) => i.id);
  const { data: variants, error: prodErr } = await supabase
    .from("product_variants")
    .select(
      `id, sku, option_label, price_cents, stock_qty, track_stock, active, image_path,
       products!product_variants_product_id_fkey!inner(id, name, emoji, slug, active, primary_image_path)`
    )
    .in("id", ids);
  if (prodErr) return { ok: false, error: "Couldn't validate the catalog — try again." };

  type Row = {
    id: string; sku: string; option_label: string | null;
    price_cents: number; stock_qty: number; track_stock: boolean;
    active: boolean; image_path: string | null;
    products: { id: string; name: string; emoji: string | null;
                slug: string; active: boolean; primary_image_path: string | null };
  };
  const byId = new Map(((variants ?? []) as unknown as Row[]).map((v) => [v.id, v]));

  for (const i of items) {
    const v = byId.get(i.id);
    if (!v || !v.active || !v.products?.active)
      return { ok: false, error: "An item in your kit is no longer available — review your cart." };
    // Estoque conferido no servidor: entre adicionar e fechar podem ter
    // passado dias, e prometer o que não existe é o pior jeito de
    // descobrir que acabou.
    if (v.track_stock && v.stock_qty < i.qty)
      return {
        ok: false,
        error: `${v.products.name} — only ${v.stock_qty} left. Adjust your cart.`,
      };
  }

  // Preços SEMPRE do banco, nunca do cliente. Em centavos inteiros.
  const subtotalCents = items.reduce((s, i) => s + byId.get(i.id)!.price_cents * i.qty, 0);
  const split = splitOrder(subtotalCents);
  const subtotal = round2(subtotalCents / 100);
  const deposit = round2(split.deposit / 100);
  const balance = round2(split.balance / 100);

  // Porto do perfil, com Santos como retaguarda para quem ainda não
  // escolheu. É o porto que define a promessa de entrega e o mínimo.
  const { data: port } = profile?.port_id
    ? await supabase
        .from("ports")
        .select("id, name, min_order_cents")
        .eq("id", profile.port_id)
        .maybeSingle()
    : await supabase
        .from("ports")
        .select("id, name, min_order_cents")
        .eq("slug", "santos")
        .maybeSingle();

  // Pedido mínimo conferido no SERVIDOR. O carrinho mostra o aviso,
  // mas aviso que só existe na tela é decoração: quem chama a ação
  // direto passaria por baixo dele.
  const minimum = Number(port?.min_order_cents ?? 0);
  if (minimum > 0 && subtotalCents < minimum) {
    return {
      ok: false,
      error: `Minimum order for ${port?.name ?? "this port"} is ${usd(
        minimum / 100
      )} — add ${usd((minimum - subtotalCents) / 100)} more.`,
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = "MS-" + Math.floor(1000 + Math.random() * 9000);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        code,
        user_id: user.id,
        ship_id: shipId,
        port_id: port?.id ?? null,
        status: "awaiting_deposit",
        subtotal_usd: subtotal,
        deposit_usd: deposit,
        balance_usd: balance,
        subtotal_cents: subtotalCents,
        deposit_cents: split.deposit,
        balance_cents: split.balance,
        vessel_name: vesselName,
        vessel_imo: profile?.vessel_imo ?? null,
        vessel_flag: profile?.vessel_flag ?? null,
        contact_rank: profile?.rank_slug ?? null,
        contact_name: (input.contactName || profile?.full_name)?.slice(0, 120) || null,
        contact_whatsapp: wa,
        note: input.note?.slice(0, 500) || null,
      })
      .select("id, code")
      .single();

    if (error) {
      if (error.code === "23505") continue; // código repetido — tenta outro
      return { ok: false, error: "Couldn't place the order — try again." };
    }

    const rows = items.map((i) => {
      const v = byId.get(i.id)!;
      return {
        order_id: order.id,
        product_id: v.products.id,
        variant_id: v.id,
        sku: v.sku,
        name: v.option_label ? `${v.products.name} — ${v.option_label}` : v.products.name,
        emoji: v.products.emoji,
        image_path: v.image_path ?? v.products.primary_image_path,
        unit_price_usd: round2(v.price_cents / 100),
        unit_price_cents: v.price_cents,
        qty: i.qty,
      };
    });
    const { error: itemsErr } = await supabase.from("order_items").insert(rows);
    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      return { ok: false, error: "Couldn't save your items — try again." };
    }

    // Abatimento do crédito Captain (função atômica no banco)
    let applied = 0;
    if (input.applyCredit) {
      const { data: appliedData } = await supabase.rpc("apply_order_credit", {
        p_order: order.id,
      });
      applied = Number(appliedData ?? 0);
    }
    const dueNow = round2(deposit - applied);

    if (dueNow <= 0.009) {
      // crédito cobriu tudo — pedido já está deposit_paid
      return { ok: true, code: order.code, creditApplied: applied, paid: true };
    }

    if (stripeConfigured) {
      try {
        const session = await createDepositSession(
          {
            orderId: order.id,
            code: order.code,
            shipName: vesselName ?? "your vessel",
            amountUsd: dueNow,
            balanceUsd: balance,
            email: user.email ?? undefined,
          },
          await siteOrigin()
        );
        if (session.url) {
          return {
            ok: true,
            code: order.code,
            payUrl: session.url,
            creditApplied: applied,
            paid: false,
          };
        }
      } catch {
        // Stripe indisponível não pode matar o pedido — cai no fluxo manual
      }
    }

    return { ok: true, code: order.code, creditApplied: applied, paid: false };
  }

  return { ok: false, error: "Couldn't generate an order code — try again." };
}

// Retomada de pagamento (ex.: fechou o Stripe no meio) a partir da página do pedido
export async function payOrderDeposit(code: string): Promise<{ url?: string; error?: string }> {
  if (!stripeConfigured) return { error: "Online payment isn't enabled yet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
