// A regra do que o checkout exige. Três telas perguntam a mesma coisa
// (a ação que salva, a conta e o retorno do Google) — se ela divergir,
// quem descobre é o cliente na hora de pagar. Roda com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const p = await import("../lib/profile.ts");

const COMPLETO = {
  full_name: "Gustavo Castellano",
  vessel_name: "MV OCEAN TRADER",
  port_id: "da17e752-f872-4950-94c0-3cba8b5db9b9",
  whatsapp: "+5511987654321",
};

test("cadastro completo não cobra nada", () => {
  assert.deepEqual(p.missingProfileFields(COMPLETO), []);
  assert.equal(p.profileIsComplete(COMPLETO), true);
});

test("conta recém-criada pelo Google cobra tudo menos o nome", () => {
  // É o que o Google entrega: nome e e-mail, mais nada.
  const google = { full_name: "Gustavo Castellano" };
  assert.deepEqual(p.missingProfileFields(google), ["vessel", "home port", "telephone"]);
  assert.equal(p.profileIsComplete(google), false);
});

test("perfil inexistente cobra os quatro", () => {
  assert.deepEqual(p.missingProfileFields(null), ["name", "vessel", "home port", "telephone"]);
  assert.deepEqual(p.missingProfileFields(undefined), ["name", "vessel", "home port", "telephone"]);
});

test("espaço em branco não conta como preenchido", () => {
  // full_name " " veio de cadastro que salvou nome vazio com espaço.
  assert.ok(p.missingProfileFields({ ...COMPLETO, full_name: "   " }).includes("name"));
  assert.ok(p.missingProfileFields({ ...COMPLETO, whatsapp: "" }).includes("telephone"));
});

test("o porto é cobrado — era o campo que faltava no cadastro", () => {
  const semPorto = { ...COMPLETO, port_id: null };
  assert.deepEqual(p.missingProfileFields(semPorto), ["home port"]);
  assert.equal(p.profileIsComplete(semPorto), false);
});

test("rank e nacionalidade não bloqueiam pagamento", () => {
  // São recomendados. Cobrar o que não trava ensina a ignorar o aviso.
  assert.deepEqual(p.missingProfileFields({ ...COMPLETO, rank_slug: null, nationality: null }), []);
});

test("a ordem é a do formulário", () => {
  assert.deepEqual(p.missingProfileFields({}), ["name", "vessel", "home port", "telephone"]);
});
