// Grade de entrega por porto. O que se testa aqui é o que quebra em
// produção: fuso (a hora do servidor não é a hora do porto), borda de
// janela, rota fixa por dia da semana e o caso "nenhuma janela aberta".
import { test } from "node:test";
import assert from "node:assert/strict";

const { resolveDelivery, zonedParts, zonedTimeToUtc, minutesOfDay, promiseLabel, hoursToCutoff } =
  await import("../lib/delivery.ts");

const SANTOS = "America/Sao_Paulo";

// Grade do Santos como está semeada no banco.
const santos = [
  { label: "até 14:00", window_start: "00:00", window_end: "14:00", delivery_offset_days: 3, min_stay_hours: 6, sort_order: 10 },
  { label: "após 14:00", window_start: "14:00", window_end: "23:59", delivery_offset_days: 4, min_stay_hours: 6, sort_order: 20 },
];

test("hora do servidor não contamina a hora do porto", () => {
  // 16:00 UTC = 13:00 em Santos → ainda dentro da janela das 14:00
  const p = resolveDelivery(santos, new Date("2026-08-25T16:00:00Z"), SANTOS);
  assert.equal(p.rule.label, "até 14:00");
  assert.equal(p.deliveryDate, "2026-08-28");
  assert.equal(p.daysAhead, 3);
});

test("um minuto depois do corte cai na janela seguinte", () => {
  const antes = resolveDelivery(santos, new Date("2026-08-25T16:59:00Z"), SANTOS); // 13:59 local
  const depois = resolveDelivery(santos, new Date("2026-08-25T17:01:00Z"), SANTOS); // 14:01 local
  assert.equal(antes.rule.label, "até 14:00");
  assert.equal(depois.rule.label, "após 14:00");
  assert.equal(antes.deliveryDate, "2026-08-28");
  assert.equal(depois.deliveryDate, "2026-08-29"); // um dia a mais
});

test("14:00 em ponto pertence à janela da tarde, não à da manhã", () => {
  const p = resolveDelivery(santos, new Date("2026-08-25T17:00:00Z"), SANTOS);
  assert.equal(p.rule.label, "após 14:00");
});

test("23:59 significa fim do dia — não deixa buraco de um minuto", () => {
  const p = resolveDelivery(santos, new Date("2026-08-26T02:59:00Z"), SANTOS); // 23:59 local
  assert.ok(p, "23:59 local ficou sem janela");
  assert.equal(p.rule.label, "após 14:00");
});

test("o corte devolvido é o instante real em UTC", () => {
  const now = new Date("2026-08-25T16:00:00Z"); // 13:00 em Santos
  const p = resolveDelivery(santos, now, SANTOS);
  assert.equal(p.cutoffAt.toISOString(), "2026-08-25T17:00:00.000Z"); // 14:00 local
  assert.equal(hoursToCutoff(p, now), 1);
});

test("virada de mês e de ano", () => {
  const fim = resolveDelivery(santos, new Date("2026-12-30T12:00:00Z"), SANTOS);
  assert.equal(fim.deliveryDate, "2027-01-02");
  const mes = resolveDelivery(santos, new Date("2026-08-30T12:00:00Z"), SANTOS);
  assert.equal(mes.deliveryDate, "2026-09-02");
});

test("rota fixa vence o offset e avança até o próximo dia de rota", () => {
  // Caso alemão do Sunny: pede seg/qua, entrega ter/qui/sáb
  const alemanha = [{
    label: "rota", window_start: "00:00", window_end: "14:00",
    order_weekdays: [1, 3], delivery_offset_days: 1,
    delivery_weekdays: [2, 4, 6], sort_order: 10,
  }];
  // 2026-08-24 é uma segunda-feira
  const seg = resolveDelivery(alemanha, new Date("2026-08-24T09:00:00Z"), "Europe/Berlin");
  assert.equal(seg.deliveryDate, "2026-08-25"); // terça
  // quarta 2026-08-26 → offset 1 = quinta, que é dia de rota
  const qua = resolveDelivery(alemanha, new Date("2026-08-26T09:00:00Z"), "Europe/Berlin");
  assert.equal(qua.deliveryDate, "2026-08-27");
});

test("dia sem janela devolve null em vez de inventar data", () => {
  const soDiaUtil = [{
    window_start: "00:00", window_end: "14:00",
    order_weekdays: [1, 2, 3, 4, 5], delivery_offset_days: 1,
  }];
  // 2026-08-23 é domingo
  assert.equal(resolveDelivery(soDiaUtil, new Date("2026-08-23T12:00:00Z"), SANTOS), null);
  assert.ok(resolveDelivery(soDiaUtil, new Date("2026-08-24T12:00:00Z"), SANTOS));
});

test("regra inativa é ignorada", () => {
  const r = [{ ...santos[0], active: false }, santos[1]];
  const p = resolveDelivery(r, new Date("2026-08-25T16:00:00Z"), SANTOS);
  assert.equal(p, null); // 13:00 local: só a regra da manhã cobriria
});

test("sort_order desempata janelas sobrepostas", () => {
  const sobreposto = [
    { label: "genérica", window_start: "00:00", window_end: "23:59", delivery_offset_days: 5, sort_order: 90 },
    { label: "específica", window_start: "08:00", window_end: "12:00", delivery_offset_days: 1, sort_order: 10 },
  ];
  const dentro = resolveDelivery(sobreposto, new Date("2026-08-25T13:00:00Z"), SANTOS); // 10:00 local
  assert.equal(dentro.rule.label, "específica");
  const fora = resolveDelivery(sobreposto, new Date("2026-08-25T19:00:00Z"), SANTOS); // 16:00 local
  assert.equal(fora.rule.label, "genérica");
});

test("horário de verão europeu não desloca o corte", () => {
  // Roterdã: 2026-03-29 é a virada para o horário de verão (CEST, +2)
  const nl = [{ window_start: "00:00", window_end: "12:00", delivery_offset_days: 0, sort_order: 10 }];
  const verao = resolveDelivery(nl, new Date("2026-03-30T08:00:00Z"), "Europe/Amsterdam"); // 10:00 CEST
  assert.equal(verao.cutoffAt.toISOString(), "2026-03-30T10:00:00.000Z"); // 12:00 CEST = 10:00Z
  const inverno = resolveDelivery(nl, new Date("2026-03-27T09:00:00Z"), "Europe/Amsterdam"); // 10:00 CET
  assert.equal(inverno.cutoffAt.toISOString(), "2026-03-27T11:00:00.000Z"); // 12:00 CET = 11:00Z
});

test("zonedTimeToUtc é o inverso de zonedParts", () => {
  for (const iso of ["2026-08-25T16:00:00Z", "2026-01-15T03:30:00Z", "2026-03-30T00:30:00Z"]) {
    for (const tz of [SANTOS, "Europe/Amsterdam", "Asia/Manila"]) {
      const d = new Date(iso);
      const p = zonedParts(d, tz);
      const back = zonedTimeToUtc(p.year, p.month, p.day, p.hour, p.minute, tz);
      assert.equal(back.toISOString().slice(0, 16), iso.slice(0, 16), `${iso} ${tz}`);
    }
  }
});

test("minutesOfDay aceita os dois formatos do Postgres", () => {
  assert.equal(minutesOfDay("14:00"), 840);
  assert.equal(minutesOfDay("14:00:00"), 840);
  assert.equal(minutesOfDay("00:00"), 0);
  assert.equal(minutesOfDay(""), 0);
});

test("rótulo da promessa fala a língua do cliente", () => {
  assert.equal(promiseLabel(null), "Next delivery window opens soon");
  assert.equal(promiseLabel({ daysAhead: 0 }), "Delivered today");
  assert.equal(promiseLabel({ daysAhead: 1 }), "Delivered tomorrow");
  assert.equal(promiseLabel({ daysAhead: 3 }), "Delivered in 3 days");
});
