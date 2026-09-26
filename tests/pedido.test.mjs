/**
 * A voz do place_order e as pontas puras do caminho de pagamento.
 *
 * A RPC devolve códigos; o cliente lê frases. Este arquivo prega cada
 * tradução (lib/pedido.ts) e as duas regras puras de lib/stripe.ts: a
 * chave de idempotência do Stripe e o mapa outcome→status do webhook.
 * São as peças que decidem dinheiro sem tocar rede — exatamente as que
 * têm de quebrar em teste, nunca em produção.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { placeOrderErrorMessage, orderReturn } = await import("../lib/pedido.ts");
const { depositIdempotencyKey, webhookOutcomeStatus } = await import("../lib/stripe.ts");
const { depositCents } = await import("../lib/money.ts");

test("cada código da RPC vira a frase de sempre", () => {
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "auth" }),
    "You need to sign in to place an order."
  );
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "bad_whatsapp" }),
    "A valid WhatsApp number is required."
  );
  assert.equal(placeOrderErrorMessage({ ok: false, error: "empty_kit" }), "Your kit is empty.");
  assert.match(
    placeOrderErrorMessage({ ok: false, error: "no_window" }),
    /couldn't verify your vessel's order window/i
  );
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "sailed", ship: "BOW COUGAR" }),
    "BOW COUGAR has sailed. Pick your current vessel in My Account — your kit is saved and will be waiting."
  );
  assert.match(
    placeOrderErrorMessage({ ok: false, error: "unavailable" }),
    /no longer available — review your cart/
  );
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "out_of_stock", name: "Dove Soap", left: 2 }),
    "Dove Soap — only 2 left. Adjust your cart."
  );
});

test("janela fechada carrega o horário de Santos quando a RPC manda", () => {
  const m = placeOrderErrorMessage({
    ok: false,
    error: "window_closed",
    ship: "LOG-IN PANTANAL",
    closed_at: "2026-08-30T12:00:00Z",
  });
  assert.match(m, /^The order window for LOG-IN PANTANAL closed on /);
  assert.match(m, /Pick your next call in My Account/);
  // sem closed_at a frase fica inteira mesmo assim
  assert.match(
    placeOrderErrorMessage({ ok: false, error: "window_closed", ship: null }),
    /The order window for this call closed\./
  );
});

test("mínimo do porto diz quanto falta, em dólar", () => {
  const m = placeOrderErrorMessage({
    ok: false,
    error: "min_order",
    port: "Porto de Santos",
    minimum_cents: 6000,
    missing_cents: 1200,
  });
  assert.match(m, /Minimum order for Porto de Santos is USD 60\.00/);
  assert.match(m, /add USD 12\.00 more/);
});

test("código desconhecido cai na frase genérica, nunca em undefined", () => {
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "bad_items" }),
    "Couldn't place the order — try again."
  );
  assert.equal(
    placeOrderErrorMessage({ ok: false, error: "algo_novo_do_futuro" }),
    "Couldn't place the order — try again."
  );
});

test("chave de idempotência do Stripe: presa ao pedido E ao valor", () => {
  const a = depositIdempotencyKey("11111111-2222-4333-8444-555555555555", 2880);
  assert.equal(a, "deposit-11111111-2222-4333-8444-555555555555-2880");
  // mesmo pedido, mesmo valor → mesma chave (retry cai na mesma session)
  assert.equal(a, depositIdempotencyKey("11111111-2222-4333-8444-555555555555", 2880));
  // valor mudou (crédito aplicado) → chave nova, sem erro de params do Stripe
  assert.notEqual(a, depositIdempotencyKey("11111111-2222-4333-8444-555555555555", 1880));
});

test("webhook: 500 só onde a reentrega do Stripe ajuda", () => {
  assert.equal(webhookOutcomeStatus("confirmed"), 200);
  assert.equal(webhookOutcomeStatus("duplicate_event"), 200);
  assert.equal(webhookOutcomeStatus("already_paid"), 200);
  assert.equal(webhookOutcomeStatus("no_order"), 200);
  assert.equal(webhookOutcomeStatus("unauthorized"), 500);
  // outcome que este código não conhece: reentregar é o lado seguro
  assert.equal(webhookOutcomeStatus("undefined"), 500);
  assert.equal(webhookOutcomeStatus(""), 500);
});

test("paridade do depósito com o SQL: meio centavo arredonda para cima", () => {
  // A RPC calcula round(subtotal * 30 / 100.0) — half away from zero.
  // Se depositCents um dia virar arredondamento bancário, este teste
  // quebra ANTES de a UI divergir um centavo do banco.
  assert.equal(depositCents(9600), 2880); // o caso provado ao vivo (MS-1201)
  assert.equal(depositCents(5), 2); // 1.5 → 2
  assert.equal(depositCents(15), 5); // 4.5 → 5
  assert.equal(depositCents(105), 32); // 31.5 → 32
  assert.equal(depositCents(6000), 1800);
});

test("volta do Stripe: pagou, desistiu ou só pediu — cada porta tem seu título", () => {
  // success_url: confirmação independe do webhook já ter chegado…
  const pago = orderReturn({ paid: "1" }, "awaiting_deposit");
  assert.equal(pago.kind, "paid");
  assert.equal(pago.title, "Deposit received — see you at the gangway");
  // …mas só fica "confirming" (auto-refresh) enquanto o status não virou
  assert.equal(pago.confirming, true);
  assert.equal(orderReturn({ paid: "1" }, "deposit_paid").confirming, false);

  // cancel_url: fechou o Stripe sem pagar — reservado, NÃO confirmado
  const desistiu = orderReturn({ placed: "1", cancelled: "1" }, "awaiting_deposit");
  assert.equal(desistiu.kind, "cancelled");
  assert.equal(desistiu.title, "Your order is reserved — pay the deposit to confirm it");
  // cancelou mas o depósito já entrou (webhook de tentativa anterior):
  // volta a ser "confirmed", sem pedir pagamento de novo
  assert.equal(orderReturn({ placed: "1", cancelled: "1" }, "deposit_paid").kind, "placed");

  // pedido recém-feito sem Stripe (crédito cobriu): a frase de sempre
  assert.equal(orderReturn({ placed: "1" }, "deposit_paid").title, "Order confirmed, sailor.");
  // chegou pelo link do e-mail: tela comum
  assert.equal(orderReturn({}, "preparing").kind, "plain");
});
