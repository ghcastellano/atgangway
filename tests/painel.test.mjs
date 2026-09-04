/**
 * O vocabulário do painel: o que a tabela de pedidos mostra sai daqui.
 * Relógio por parâmetro, como em lib/callstate — regra de tempo só se
 * testa com o relógio na mão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ABERTOS, PROXIMO, STATUS_PT, cents, relativo } from "../lib/painel.ts";

const AGORA = Date.parse("2026-09-04T12:00:00Z");

test("relativo: minutos, horas e dias, para trás e para a frente", () => {
  assert.equal(relativo("2026-09-04T11:50:00Z", AGORA), "há 10 min");
  assert.equal(relativo("2026-09-04T09:00:00Z", AGORA), "há 3 h");
  assert.equal(relativo("2026-09-01T12:00:00Z", AGORA), "há 3 d");
  assert.equal(relativo("2026-09-06T12:00:00Z", AGORA), "em 2 d");
  assert.equal(relativo("2026-09-04T12:00:20Z", AGORA), "em 1 min", "nunca '0 min'");
  assert.equal(relativo(null, AGORA), "—");
});

test("cents: a coluna em centavos vence; a _usd legada é retaguarda", () => {
  assert.equal(cents(1250, 99.99), 1250);
  assert.equal(cents(null, 12.5), 1250);
  assert.equal(cents(undefined, "7.10"), 710);
  assert.equal(cents(null, null), 0);
});

test("todo estado aberto tem rótulo e um próximo passo (menos a escada, que é entrega com foto)", () => {
  for (const s of ABERTOS) assert.ok(STATUS_PT[s], `sem rótulo PT para ${s}`);
  assert.deepEqual(Object.keys(PROXIMO).sort(), ["awaiting_deposit", "deposit_paid", "preparing"]);
  assert.equal(PROXIMO.awaiting_deposit.to, "deposit_paid");
  assert.equal(PROXIMO.deposit_paid.to, "preparing");
  assert.equal(PROXIMO.preparing.to, "at_gangway");
});
