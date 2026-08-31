// Testa a rota do webhook Stripe de verdade: assinatura válida passa,
// inválida é rejeitada — usando o gerador oficial de header de teste.
import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_unit";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_test_secret_123";

const { POST } = await import("../app/api/stripe/webhook/route.ts");

const stripe = new Stripe("sk_test_dummy_for_unit");

function eventBody(type, payment_status) {
  return JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status,
        client_reference_id: null,
        metadata: {}, // sem order_id: rota valida assinatura e responde 200 sem tocar no banco
      },
    },
  });
}

function makeRequest(body, signature) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body,
  });
}

test("assinatura válida → 200", async () => {
  const body = eventBody("checkout.session.completed", "paid");
  const sig = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const res = await POST(makeRequest(body, sig));
  assert.equal(res.status, 200);
});

test("assinatura inválida → 400", async () => {
  const body = eventBody("checkout.session.completed", "paid");
  const res = await POST(makeRequest(body, "t=1,v1=deadbeef"));
  assert.equal(res.status, 400);
});

test("sem assinatura → 400", async () => {
  const res = await POST(makeRequest(eventBody("checkout.session.completed", "paid"), null));
  assert.equal(res.status, 400);
});

test("evento não relacionado → 200 sem efeito", async () => {
  const body = eventBody("payment_intent.created", "unpaid");
  const sig = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const res = await POST(makeRequest(body, sig));
  assert.equal(res.status, 200);
});
