// Fila de desejos marcados antes do login: o que o aparelho guarda
// enquanto não há sessão. Roda com o runner nativo: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const w = await import("../lib/wishstash.ts");

const A = "e6ccd6e7-001c-4fd8-b241-5afed2df1d8f";
const B = "fc6ce5ee-6d53-4b7e-a95b-39576888b04f";

test("fila vazia quando não há nada guardado", () => {
  assert.deepEqual(w.readPending(null), []);
  assert.deepEqual(w.readPending(undefined), []);
  assert.deepEqual(w.readPending(""), []);
});

test("armazenamento corrompido não derruba a vitrine", () => {
  assert.deepEqual(w.readPending("{isso não é json"), []);
  assert.deepEqual(w.readPending('"texto solto"'), []);
  assert.deepEqual(w.readPending("42"), []);
});

test("só aceita id de produto, não o que escreverem no console", () => {
  assert.deepEqual(w.readPending(JSON.stringify([A, "drop table", 7, null, B])), [A, B]);
});

test("marcar deslogado enfileira; marcar de novo é arrependimento", () => {
  const um = w.togglePending(null, A);
  assert.deepEqual(JSON.parse(um), [A]);

  const dois = w.togglePending(um, B);
  assert.deepEqual(JSON.parse(dois), [A, B]);

  // Segundo toque no mesmo coração tira da fila — senão a pessoa faz
  // login e recebe de volta o item que acabou de desmarcar.
  assert.deepEqual(JSON.parse(w.togglePending(dois, A)), [B]);
});

test("id inválido não entra na fila", () => {
  assert.deepEqual(JSON.parse(w.togglePending(null, "nope")), []);
  assert.deepEqual(JSON.parse(w.togglePending(null, "")), []);
});

test("fila tem teto — é intenção recente, não histórico", () => {
  const cheia = Array.from({ length: w.WISH_MAX }, (_, i) =>
    `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`
  );
  const raw = JSON.stringify(cheia);
  assert.equal(w.readPending(raw).length, w.WISH_MAX);
  assert.equal(JSON.parse(w.togglePending(raw, A)).length, w.WISH_MAX);
});

test("duplicata guardada duas vezes conta uma só", () => {
  assert.deepEqual(w.readPending(JSON.stringify([A, A, A])), [A]);
});
