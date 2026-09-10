/**
 * O vocabulário do painel: o que a tabela de pedidos mostra sai daqui.
 * Relógio por parâmetro, como em lib/callstate — regra de tempo só se
 * testa com o relógio na mão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ABERTOS,
  PROXIMO,
  STATUS_PT,
  PUBLISH_HORIZON_DAYS,
  cents,
  deveriaTerPublicado,
  ehSobra,
  pilhaDaEscala,
  publicaEm,
  relativo,
} from "../lib/painel.ts";

const AGORA = Date.parse("2026-09-04T12:00:00Z");
const AG = new Date(AGORA);
/** ISO a N horas do relógio do teste. */
const h = (n) => new Date(AGORA + n * 3600e3).toISOString();

test("pilhaDaEscala: as cinco pilhas, com o relógio na mão", () => {
  assert.equal(pilhaDaEscala({ eta: h(24 * 5), cutoff_hours: 24, active: true }, AG), "vendendo");
  assert.equal(pilhaDaEscala({ eta: h(10), cutoff_hours: 24, active: true }, AG), "fechadas", "corte passado, navio ainda na escala");
  assert.equal(pilhaDaEscala({ eta: h(-72), cutoff_hours: 24, active: false }, AG), "fora", "zarpou e a rotação aposentou");
  assert.equal(pilhaDaEscala({ eta: h(-1), cutoff_hours: 24, active: false }, AG), "fora", "entrou no line-up tarde demais para vender");
  assert.equal(pilhaDaEscala({ eta: h(24 * 20), cutoff_hours: 24, active: false }, AG), "espera", "além do horizonte: publica sozinho");
  assert.equal(pilhaDaEscala({ eta: h(24 * 5), cutoff_hours: 24, active: false, hidden_at: h(-2) }, AG), "escondidas");
  assert.equal(pilhaDaEscala({ eta: h(24 * 5), cutoff_hours: 24, active: true, hidden_at: h(-2) }, AG), "vendendo", "publicada vence uma marca antiga de escondida");
  assert.equal(pilhaDaEscala({ eta: h(-72), cutoff_hours: 24, active: false, hidden_at: h(-100) }, AG), "fora", "escondida que zarpou está fora de cena, não escondida");
});

test("deveriaTerPublicado: só inativa, não escondida, dentro do horizonte — o contador vermelho", () => {
  assert.equal(deveriaTerPublicado({ eta: h(24 * 5), cutoff_hours: 24, active: false }, AG), true);
  assert.equal(deveriaTerPublicado({ eta: h(24 * 20), cutoff_hours: 24, active: false }, AG), false, "fora do horizonte só espera");
  assert.equal(deveriaTerPublicado({ eta: h(24 * 5), cutoff_hours: 24, active: false, hidden_at: h(-1) }, AG), false, "escondida é decisão, não anomalia");
  assert.equal(deveriaTerPublicado({ eta: h(24 * 5), cutoff_hours: 24, active: true }, AG), false);
  assert.equal(deveriaTerPublicado({ eta: h(-1), cutoff_hours: 24, active: false }, AG), false, "ETA no passado não é anomalia");
  assert.equal(publicaEm(h(24 * 20)).getTime(), AGORA + (20 - PUBLISH_HORIZON_DAYS) * 86400e3, "publica ETA − horizonte");
});

test("ehSobra: mercadoria comprada e não entregue", () => {
  const foi = { eta: h(-72), ata: null, cutoff_hours: 24 };
  const vem = { eta: h(24 * 5), ata: null, cutoff_hours: 24 };
  assert.equal(ehSobra({ status: "credited", previous_status: "preparing", ships: foi }, AG), true);
  assert.equal(ehSobra({ status: "credited", previous_status: "at_gangway", ships: foi }, AG), true);
  assert.equal(ehSobra({ status: "credited", previous_status: "deposit_paid", ships: foi }, AG), false, "nada comprado: o crédito resolve sozinho");
  assert.equal(ehSobra({ status: "preparing", previous_status: null, ships: foi }, AG), true, "aberto com navio que já foi");
  assert.equal(ehSobra({ status: "at_gangway", previous_status: "preparing", ships: vem }, AG), false, "navio ainda vem: pedido normal");
  assert.equal(ehSobra({ status: "at_gangway", previous_status: "preparing", ships: null }, AG), false, "sem escala não dá para dizer que o navio foi");
  assert.equal(ehSobra({ status: "delivered", previous_status: "at_gangway", ships: foi }, AG), false);
});

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
