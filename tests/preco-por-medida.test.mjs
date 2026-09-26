// Preço por medida: comparar embalagens sem calculadora.
import { test } from "node:test";
import assert from "node:assert/strict";

const { precoPorMedida, packSize } = await import("../lib/catalog.ts");

test("peso e volume viram por 100 g / 100 ml", () => {
  assert.equal(precoPorMedida(200, "60 g"), "USD 3.33 / 100 g");
  assert.equal(precoPorMedida(1000, "1 kg"), "USD 1.00 / 100 g");
  assert.equal(precoPorMedida(250, "200 ml"), "USD 1.25 / 100 ml");
  assert.equal(precoPorMedida(300, "1.5 l"), "USD 0.20 / 100 ml");
  assert.equal(precoPorMedida(300, "33 cl"), "USD 0.91 / 100 ml");
});

test("pack vira por unidade", () => {
  assert.equal(precoPorMedida(1200, "6 x 330 ml"), "USD 2.00 each");
  assert.equal(precoPorMedida(900, "12 un"), "USD 0.75 each");
  assert.equal(precoPorMedida(900, "1 un"), null, "uma unidade não tem o que comparar");
});

test("sem tamanho reconhecível, nada", () => {
  assert.equal(precoPorMedida(500, null), null);
  assert.equal(precoPorMedida(500, "grande"), null);
  assert.equal(precoPorMedida(0, "60 g"), null);
  assert.equal(precoPorMedida(200, packSize("Cheetos Lua Parmesan 125 g").unit), "USD 1.60 / 100 g");
});
