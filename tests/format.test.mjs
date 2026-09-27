// Testes do núcleo puro de regras (dinheiro, janelas, navegação).
// Roda com o runner nativo: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const fmt = await import("../lib/format.ts");
const money = await import("../lib/money.ts");

test("usd formata com 2 casas", () => {
  assert.equal(fmt.usd(36), "USD 36.00");
  assert.equal(fmt.usd(10.8), "USD 10.80");
  assert.equal(fmt.usd(0), "USD 0.00");
});

test("depósito de 30% bate com o protótipo (36 → 10.80 / 25.20)", () => {
  // A constante vem de lib/money.ts, que é a que o carrinho, o checkout,
  // os Termos e o FAQ usam. Antes vinha de lib/format.ts, uma segunda
  // DEPOSIT_PCT com o MESMO nome e outra unidade (0.3 contra 30) que a
  // produção não importava: trocar os 30% no lugar certo deixaria este
  // teste passando em 30% para sempre. A duplicata foi removida.
  const subtotal = 36;
  const dep = (subtotal * money.DEPOSIT_PCT) / 100;
  assert.equal(fmt.usd(dep), "USD 10.80");
  assert.equal(fmt.usd(subtotal - dep), "USD 25.20");
});

test("hoursUntil nunca é negativo e arredonda", () => {
  // 100min = 1.67h → 2. Evita o limite exato de .5, que oscilaria com
  // os milissegundos de execução do próprio teste.
  const in100m = new Date(Date.now() + 100 * 60e3).toISOString();
  assert.equal(fmt.hoursUntil(in100m), 2);
  const past = new Date(Date.now() - 3600e3).toISOString();
  assert.equal(fmt.hoursUntil(past), 0);
});

test("janela de pedido fecha exatamente cutoff horas antes do ETA", () => {
  const eta = new Date(Date.now() + 30 * 3600e3); // 30h
  assert.equal(fmt.orderWindowOpen(eta, 26), true); // fecha em 4h
  assert.equal(fmt.orderWindowOpen(eta, 31), false); // já fechou
  const close = fmt.orderCloseAt(eta, 26);
  assert.equal(eta.getTime() - close.getTime(), 26 * 3600e3);
});

test("shortShipName pega a última palavra", () => {
  assert.equal(fmt.shortShipName("CMA CGM MELODY"), "MELODY");
  assert.equal(fmt.shortShipName("MSC LORENA"), "LORENA");
  assert.equal(fmt.shortShipName("  NYK  CONSTELLATION  "), "CONSTELLATION");
});

test("safeNext só aceita caminhos internos", () => {
  assert.equal(fmt.safeNext("/checkout"), "/checkout");
  assert.equal(fmt.safeNext("/orders/MS-1"), "/orders/MS-1");
  assert.equal(fmt.safeNext("//evil.com"), "/");
  assert.equal(fmt.safeNext("https://evil.com"), "/");
  assert.equal(fmt.safeNext(null), "/");
  assert.equal(fmt.safeNext(undefined, "/"), "/");
  // Vetores que a versao anterior deixava passar: barra invertida
  // (o navegador le "/\\evil.com" como "//evil.com") e caracteres de
  // controle que quebram a analise de URL.
  assert.equal(fmt.safeNext("/\\evil.com"), "/");
  assert.equal(fmt.safeNext("/\tevil"), "/");
  assert.equal(fmt.safeNext("/\r\n//evil.com"), "/");
  assert.equal(fmt.safeNext("/account?next=/orders"), "/account?next=/orders");
});

test("ETA ida-e-volta no fuso de Santos (UTC-3, sem DST)", () => {
  const local = "2026-12-24T18:30";
  const iso = fmt.localInputToIso(local);
  assert.equal(iso, "2026-12-24T21:30:00.000Z");
  assert.equal(fmt.etaToLocalInput(iso), local);
});

test("diaLocal: instante UTC vira data de Santos (UTC-3)", async () => {
  const { diaLocal, diaCurto } = await import("../lib/format.ts");
  assert.equal(diaLocal("2026-10-08T01:30:00.000Z"), "2026-10-07", "01:30 UTC ainda é dia 7 em Santos");
  assert.equal(diaLocal("2026-10-08T15:00:00.000Z"), "2026-10-08");
  assert.equal(diaCurto("2026-10-08"), "08 Oct");
});
