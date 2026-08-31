// A régua única da escala: aberta, fechando, fechada, partida. O que
// importa são as fronteiras — é nelas que quatro réguas divergentes
// deixavam pedido entrar com a janela morta.
import { test } from "node:test";
import assert from "node:assert/strict";

const { callState, canOrder, CLOSING_HOURS } = await import("../lib/callstate.ts");

const H = 3600e3;
const agora = new Date("2026-09-10T12:00:00Z");
const iso = (msDaquiAte) => new Date(agora.getTime() + msDaquiAte).toISOString();

test("janela aberta: corte bem à frente", () => {
  assert.equal(callState({ eta: iso(72 * H), cutoff_hours: 24 }, agora), "open");
});

test("closing: dentro das últimas 12h antes do corte", () => {
  // eta em 35h, cutoff 24 → corte em 11h
  assert.equal(callState({ eta: iso(35 * H), cutoff_hours: 24 }, agora), "closing");
});

test("fronteira: exatamente 12h antes do corte já é closing", () => {
  assert.equal(
    callState({ eta: iso((24 + CLOSING_HOURS) * H), cutoff_hours: 24 }, agora),
    "closing"
  );
});

test("closed: o corte passou, navio ainda na escala", () => {
  assert.equal(callState({ eta: iso(10 * H), cutoff_hours: 24 }, agora), "closed");
});

test("fronteira: no instante exato do corte está fechado", () => {
  assert.equal(callState({ eta: iso(24 * H), cutoff_hours: 24 }, agora), "closed");
});

test("sailed: eta + 48h passou e não há ATA", () => {
  assert.equal(callState({ eta: iso(-49 * H), cutoff_hours: 24 }, agora), "sailed");
});

test("a ATA vence a ETA: atracou tarde, ainda no porto — closed, não sailed", () => {
  assert.equal(
    callState({ eta: iso(-60 * H), ata: iso(-20 * H), cutoff_hours: 24 }, agora),
    "closed"
  );
});

test("cutoff nulo cai no padrão de 24h", () => {
  assert.equal(callState({ eta: iso(20 * H), cutoff_hours: null }, agora), "closed");
});

test("canOrder: só open e closing compram", () => {
  assert.equal(canOrder("open"), true);
  assert.equal(canOrder("closing"), true);
  assert.equal(canOrder("closed"), false);
  assert.equal(canOrder("sailed"), false);
});
