/**
 * A troca de prefixo das chaves do navegador (lib/chaves.ts) não pode
 * apagar o carrinho, a indicação nem os desejos de quem já os tinha.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { migrarChaves, CHAVE_CARRINHO, CHAVE_INDICACAO, CHAVE_DESEJOS } = await import(
  "../lib/chaves.ts"
);

const armazem = (inicial = {}) => {
  const m = new Map(Object.entries(inicial));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

test("os valores antigos passam para as chaves novas e as antigas saem", () => {
  const s = armazem({
    "ms.cart.v2": '{"items":{"a":2}}',
    "ms.ref.v1": "AG-ANDRES-39",
    "ms.wish.pending": '["x"]',
  });
  migrarChaves(s);
  assert.equal(s.getItem(CHAVE_CARRINHO), '{"items":{"a":2}}');
  assert.equal(s.getItem(CHAVE_INDICACAO), "AG-ANDRES-39");
  assert.equal(s.getItem(CHAVE_DESEJOS), '["x"]');
  assert.deepEqual([...s.m.keys()].filter((k) => k.startsWith("ms.")), []);
});

test("a chave nova já preenchida vence — é o que a pessoa fez depois", () => {
  const s = armazem({ "ms.cart.v2": "velho", [CHAVE_CARRINHO]: "novo" });
  migrarChaves(s);
  assert.equal(s.getItem(CHAVE_CARRINHO), "novo");
  assert.equal(s.getItem("ms.cart.v2"), null);
});

test("sem nada antigo, nada muda; rodar duas vezes é igual a uma", () => {
  const s = armazem({ [CHAVE_DESEJOS]: "[]", outra: "1" });
  migrarChaves(s);
  migrarChaves(s);
  assert.deepEqual(Object.fromEntries(s.m), { [CHAVE_DESEJOS]: "[]", outra: "1" });
});

test("nenhum outro arquivo usa o prefixo antigo", () => {
  for (const f of ["lib/cart.tsx", "lib/wishstash.ts", "components/StoreReferral.tsx"]) {
    assert.doesNotMatch(readFileSync(f, "utf-8"), /"ms\./, `${f} voltou a usar ms.`);
  }
});
