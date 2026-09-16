// Dinheiro em centavos: o objetivo dos testes é provar que nada aqui
// passa por float, inclusive quando o Postgres entrega numeric como
// string.
import { test } from "node:test";
import assert from "node:assert/strict";

const { fromDb, toCents, usd, sumCents, discountPercent, depositCents, splitOrder } =
  await import("../lib/money.ts");

test("numeric do Postgres chega como string e não vira float", () => {
  assert.equal(toCents("18.50"), 1850);
  assert.equal(toCents("0.1"), 10);
  assert.equal(toCents(0.1) + toCents(0.2), 30); // 0.1+0.2 em float daria 0.30000000000000004
  assert.equal(toCents("1.005"), 101);           // meio centavo arredonda para cima
  assert.equal(toCents("10,90"), 1090);          // vírgula decimal
});

test("entrada inválida vira zero em vez de NaN", () => {
  for (const v of [null, undefined, "", "abc", NaN]) {
    assert.equal(fromDb(v), 0, String(v));
    assert.equal(toCents(v), 0, String(v));
  }
});

test("formatação", () => {
  assert.equal(usd(6490), "USD 64.90");
  assert.equal(usd(0), "USD 0.00");
  assert.equal(usd("1800"), "USD 18.00");
});

test("soma de carrinho não acumula erro", () => {
  const linhas = Array.from({ length: 100 }, () => "0.07"); // 7 centavos ×100
  assert.equal(sumCents(linhas.map(toCents)), 700);
});

test("desconto só existe quando o preço anterior é maior", () => {
  assert.equal(discountPercent(6490, 10500), 38);
  assert.equal(discountPercent(1000, 1000), null); // igual não é promoção
  assert.equal(discountPercent(1200, 1000), null); // menor é erro de cadastro
  assert.equal(discountPercent(1000, null), null);
  assert.equal(discountPercent(1000, 1005), null); // 0,5% arredonda para 0 → some
});

test("depósito de 30% fecha com o saldo", () => {
  for (const subtotal of [1, 999, 1000, 14850, 20399, 123456]) {
    const s = splitOrder(subtotal);
    assert.equal(s.deposit + s.balance, subtotal, `subtotal ${subtotal}`);
    assert.equal(s.deposit, depositCents(subtotal));
  }
});

test("crédito Captain nunca passa do depósito", () => {
  const s = splitOrder(10000, 99999);
  assert.equal(s.credit, s.deposit);
  assert.equal(s.dueNow, 0);
  assert.equal(s.balance, 7000);
});

test("crédito parcial abate só o que deve", () => {
  const s = splitOrder(10000, 1000);
  assert.equal(s.deposit, 3000);
  assert.equal(s.credit, 1000);
  assert.equal(s.dueNow, 2000);
  assert.equal(s.balance, 7000);
});

// ---- bloqueioDoCheckout: a precedência escrita uma vez ----
const { bloqueioDoCheckout } = await import("../lib/money.ts");

test("checkout livre: nenhum bloqueio", () => {
  assert.equal(
    bloqueioDoCheckout({ subtotalCents: 5000, minOrderCents: 3000, temItens: true, perfilIncompleto: false }),
    null
  );
});

test("abaixo do mínimo: o botão diz quanto falta e a frase diz o mínimo", () => {
  const b = bloqueioDoCheckout({ subtotalCents: 1800, minOrderCents: 3000, temItens: true, perfilIncompleto: false });
  assert.equal(b?.motivo, "minimo");
  assert.equal(b.botao, "Add USD 12.00 more to check out");
  assert.equal(b.minimo, 3000); // centavos, como o resto da folha
});

test("perfil incompleto: bloqueia sem trocar o rótulo do botão", () => {
  assert.deepEqual(
    bloqueioDoCheckout({ subtotalCents: 5000, minOrderCents: 3000, temItens: true, perfilIncompleto: true }),
    { motivo: "perfil", botao: null }
  );
});

test("os dois ao mesmo tempo: o mínimo vence", () => {
  const b = bloqueioDoCheckout({ subtotalCents: 1000, minOrderCents: 3000, temItens: true, perfilIncompleto: true });
  assert.equal(b?.motivo, "minimo");
});

test("carrinho vazio não é 'abaixo do mínimo'", () => {
  assert.equal(
    bloqueioDoCheckout({ subtotalCents: 0, minOrderCents: 3000, temItens: false, perfilIncompleto: false }),
    null
  );
});

test("porto sem mínimo nunca bloqueia pelo mínimo", () => {
  assert.equal(
    bloqueioDoCheckout({ subtotalCents: 100, minOrderCents: 0, temItens: true, perfilIncompleto: false }),
    null
  );
});
