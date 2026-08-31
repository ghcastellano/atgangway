import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../../../lib/env.ts";
import { webhookOutcomeStatus } from "../../../../lib/stripe.ts";
import { sendOrderEmail } from "../../../../lib/mailer.ts";

// Webhook do Stripe: confirma o depósito quando o pagamento aprova.
// A assinatura do evento é verificada com o signing secret; a chamada
// ao banco é autorizada por um segredo PRÓPRIO (STRIPE_CONFIRM_SECRET =
// app_secrets.stripe_confirm_secret) — o signing secret já foi usado
// para os dois papéis, o que deixava qualquer portador dele marcar
// pedido como pago direto no PostgREST e amarrava a rotação de um ao
// outro. Enquanto a env nova não existe na Vercel, o banco ainda aceita
// o signing secret (cai na fase B).
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !signingSecret) {
    // 503 DE PROPÓSITO — o oposto do cron. Aqui devolver 200 faria o
    // Stripe marcar o evento como entregue e a confirmação de pagamento
    // se perderia para sempre: o cliente pagaria e o pedido ficaria
    // "aguardando depósito". Com 5xx o Stripe reentrega por até 3 dias,
    // dando tempo de corrigir a configuração sem perder dinheiro.
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing signature" }, { status: 400 });

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = new Stripe(secretKey).webhooks.constructEvent(body, signature, signingSecret);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  // completed cobre cartão/wallet; async_payment_succeeded cobre PIX
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id ?? session.client_reference_id;

    if (orderId && session.payment_status === "paid") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const confirmSecret = process.env.STRIPE_CONFIRM_SECRET || signingSecret;

      // A RPC reivindica o event.id (replay do mesmo evento vira no-op)
      // e devolve um OUTCOME em vez de boolean: era o boolean ignorado
      // que fazia um depósito pago e não gravado responder 200 — e o
      // Stripe nunca mais reentregava.
      const { data: outcome, error } = await supabase.rpc("confirm_stripe_deposit", {
        p_order: orderId,
        p_secret: confirmSecret,
        p_event: event.id,
        p_session: session.id,
      });
      if (error) {
        // 500 faz o Stripe reentregar o evento
        return Response.json({ error: "db update failed" }, { status: 500 });
      }

      const status = webhookOutcomeStatus(String(outcome));
      if (status !== 200 || outcome === "no_order") {
        // unauthorized (segredo dessincronizado) reentrega até alguém
        // corrigir; no_order (metadata apontando para o nada) não se
        // conserta reentregando — registra alto e devolve 200.
        console.error(
          JSON.stringify({ at: "stripe_webhook", event: event.id, order: orderId, outcome })
        );
        if (status !== 200) return Response.json({ outcome }, { status });
      }

      if (outcome === "confirmed") {
        // Confirmação para o marinheiro. Esperamos o envio (o Stripe dá
        // ~10s e o transporte está calibrado bem abaixo disso), mas a
        // falha não derruba o webhook: o depósito já está registrado e
        // a reivindicação foi devolvida, então a reentrega do Stripe
        // tenta o e-mail de novo sem duplicar nada.
        await sendOrderEmail(supabase, orderId, "deposit_paid", confirmSecret);
      }
    }
  }

  return Response.json({ received: true });
}
