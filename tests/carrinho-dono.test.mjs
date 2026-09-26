// O carrinho acompanha a conta, não o navegador.
import { test } from "node:test";
import assert from "node:assert/strict";

const { reconciliar } = await import("../lib/carrinho-dono.ts");

const itens = { "v-1": 2, "v-2": 1 };

test("visitante que entra leva o carrinho junto", () => {
  assert.deepEqual(reconciliar({ items: itens, dono: null }, "ana"), itens);
});

test("mesma conta mantém o carrinho", () => {
  assert.deepEqual(reconciliar({ items: itens, dono: "ana" }, "ana"), itens);
});

test("outra conta não vê o carrinho de quem saiu", () => {
  assert.deepEqual(reconciliar({ items: itens, dono: "ana" }, "bruno"), {});
});

test("sair da conta apaga o carrinho", () => {
  assert.deepEqual(reconciliar({ items: itens, dono: "ana" }, null), {});
});

test("visitante continua visitante", () => {
  assert.deepEqual(reconciliar({ items: itens, dono: null }, null), itens);
});
