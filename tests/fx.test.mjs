// Câmbio: o que o site mostra em real vem daqui. Roda com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const fx = await import("../lib/fx.ts");

const PTAX = { quoteDate: "2026-08-25", buy: 5.1484, sell: 5.149 };

test("data no formato que o Olinda exige (MM-DD-AAAA)", () => {
  assert.equal(fx.bcbDate(new Date("2026-08-26T10:00:00Z")), "08-26-2026");
  assert.equal(fx.bcbDate(new Date("2026-01-05T10:00:00Z")), "01-05-2026");
});

test("a URL pede período, nunca um dia só", () => {
  // Pedir "hoje" num feriado devolve lista vazia — período sempre traz
  // o último dia útil.
  const u = fx.ptaxUrl(new Date("2026-08-19T00:00:00Z"), new Date("2026-08-26T00:00:00Z"));
  assert.ok(u.includes("CotacaoDolarPeriodo"));
  assert.ok(u.includes("08-19-2026"));
  assert.ok(u.includes("08-26-2026"));
});

test("os parâmetros OData vão literais — @ e $ encodados dão 400", () => {
  // Este teste existe porque a primeira versão usava URLSearchParams,
  // que vira %40dataInicial e %24top, e o Olinda respondeu 400 em
  // produção. O teste antigo só checava se a data aparecia na string.
  const u = fx.ptaxUrl(new Date("2026-08-19T00:00:00Z"), new Date("2026-08-26T00:00:00Z"));
  assert.ok(u.includes("?@dataInicial='08-19-2026'"), u);
  assert.ok(u.includes("&@dataFinalCotacao='08-26-2026'"), u);
  assert.ok(u.includes("&$top=10"), u);
  assert.ok(u.includes("&$format=json"), u);
  assert.ok(!u.includes("%40"), "não pode encodar o @");
  assert.ok(!u.includes("%24"), "não pode encodar o $");
});

test("pega a cotação mais recente do lote, fora de ordem inclusive", () => {
  const r = fx.latestPtax([
    { cotacaoCompra: 5.18, cotacaoVenda: 5.181, dataHoraCotacao: "2026-08-20 13:06:16.5" },
    { cotacaoCompra: 5.1484, cotacaoVenda: 5.149, dataHoraCotacao: "2026-08-25 13:04:44.7" },
    { cotacaoCompra: 5.16, cotacaoVenda: 5.162, dataHoraCotacao: "2026-08-21 13:07:28.2" },
  ]);
  assert.equal(r.quoteDate, "2026-08-25");
  assert.equal(r.sell, 5.149);
});

test("payload vazio ou torto não vira cotação", () => {
  assert.equal(fx.latestPtax([]), null);
  assert.equal(fx.latestPtax(null), null);
  assert.equal(fx.latestPtax(undefined), null);
  assert.equal(fx.latestPtax([{ cotacaoCompra: 0, cotacaoVenda: 0, dataHoraCotacao: "2026-08-25 13:00" }]), null);
  assert.equal(fx.latestPtax([{ cotacaoVenda: 5.1, dataHoraCotacao: "x" }]), null);
});

test("converte pela VENDA, que é o que a pessoa paga", () => {
  // USD 32,00 pelo PTAX de venda 5,149 = R$ 164,77 → R$ 165.
  assert.equal(fx.usdCentsToBrl(3200, PTAX), 165);
  // Com a constante velha de 5,30 dava R$ 170 — 3% a mais.
  assert.equal(fx.usdCentsToBrl(3200, { ...PTAX, sell: 5.3 }), 170);
});

test("sem cotação não inventa número", () => {
  assert.equal(fx.usdCentsToBrl(3200, null), null);
  assert.equal(fx.brlRef(3200, null), null);
});

test("formata em padrão brasileiro", () => {
  assert.equal(fx.brlRef(3200, PTAX), "R$ 165");
  assert.equal(fx.brlRef(1000000, PTAX), "R$ " + (51490).toLocaleString("pt-BR"));
});

test("idade da cotação: feriado emendado passa, cron parado não", () => {
  const seg = new Date("2026-08-31T12:00:00Z"); // 6 dias depois
  const qui = new Date("2026-08-27T12:00:00Z"); // 2 dias depois
  assert.equal(fx.rateAgeDays(PTAX, qui), 2);
  assert.equal(fx.rateIsUsable(PTAX, qui), true);
  assert.equal(fx.rateAgeDays(PTAX, seg), 6);
  assert.equal(fx.rateIsUsable(PTAX, seg), false);
});

test("cotação do futuro é dado corrompido, não referência", () => {
  const ontem = new Date("2026-08-24T12:00:00Z");
  assert.equal(fx.rateIsUsable(PTAX, ontem), false);
});
