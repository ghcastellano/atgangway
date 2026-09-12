/**
 * Quem merece interromper a operação quando o line-up muda.
 *
 * A função é pura: navios que mudaram + o que o banco sabe (pedidos
 * abertos, clientes a bordo) → avisos individuais e um agrupado. O caso
 * que motivou o teste: 46 avisos "atrasou 24 h" numa manhã, porque o
 * line-up só tem data e a lista virou o dia.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMIAR_INDIVIDUAL_H, LIMIAR_LOTE_H, NOMES_NO_LOTE, classificar } from "../lib/alertas.ts";

const navio = (id, h, extra = {}) => ({
  id,
  name: id.toUpperCase(),
  eta: "2026-09-12T15:00:00Z",
  previous_eta: "2026-09-11T15:00:00Z",
  delay_hours: h,
  active: true,
  berth: null,
  ...extra,
});
const ctx = (pedidos = {}, tripulantes = {}) => ({
  pedidosPor: new Map(Object.entries(pedidos)),
  tripulantesPor: new Map(Object.entries(tripulantes)),
});

test("navio com pedido aberto que mudou 2 h ou mais é aviso individual vermelho", () => {
  const r = classificar([navio("bow-firda", LIMIAR_INDIVIDUAL_H)], ctx({ "bow-firda": ["AG-1210"] }));
  assert.equal(r.individuais.length, 1);
  assert.equal(r.individuais[0].severity, "danger");
  assert.match(r.individuais[0].titulo, /BOW-FIRDA atrasou 2 h/);
  assert.match(r.individuais[0].corpo, /#AG-1210/);
  assert.equal(r.lote, null, "quem tem aviso individual não entra no agrupado");
});

test("navio que um cliente tem no perfil é aviso individual âmbar", () => {
  const r = classificar([navio("sofia", -24)], ctx({}, { sofia: 2 }));
  assert.equal(r.individuais.length, 1);
  assert.equal(r.individuais[0].severity, "warn");
  assert.match(r.individuais[0].titulo, /adiantou 24 h/);
  assert.match(r.individuais[0].corpo, /2 clientes têm este navio no perfil/);
});

test("escala publicada sem pedido nem cliente vai para o agrupado, não para o sino um a um", () => {
  const r = classificar([navio("a", 24), navio("b", 168), navio("c", -6)], ctx());
  assert.equal(r.individuais.length, 0);
  assert.ok(r.lote);
  assert.equal(r.lote.n, 3);
  assert.equal(r.lote.titulo, "3 escalas mudaram de data no line-up");
  assert.match(r.lote.corpo, /^B \+168 h · A \+24 h · C −6 h/, "maior mudança primeiro, com sinal");
  assert.match(r.lote.corpo, /sem pedido aberto nem cliente a bordo/);
});

test("abaixo do limiar do lote, ou fora de cena, não avisa nada", () => {
  const r = classificar(
    [navio("pequena", LIMIAR_LOTE_H - 1), navio("inativa", 48, { active: false }), navio("parada", 0)],
    ctx()
  );
  assert.equal(r.individuais.length, 0);
  assert.equal(r.lote, null);
});

test("pedido aberto com mudança menor que 2 h também fica quieto", () => {
  const r = classificar([navio("x", 1)], ctx({ x: ["AG-1"] }));
  assert.equal(r.individuais.length, 0);
  assert.equal(r.lote, null);
});

test("o agrupado lista até N nomes e conta o resto", () => {
  const muitos = Array.from({ length: NOMES_NO_LOTE + 5 }, (_, i) => navio(`n${String(i).padStart(2, "0")}`, 24));
  const r = classificar(muitos, ctx());
  assert.equal(r.lote.n, NOMES_NO_LOTE + 5);
  assert.equal((r.lote.corpo.match(/ \+24 h/g) ?? []).length, NOMES_NO_LOTE);
  assert.match(r.lote.corpo, /e mais 5/);
});

test("dedupe do agrupado depende do conjunto de mudanças, não da hora", () => {
  const a = classificar([navio("a", 24), navio("b", 24)], ctx()).lote.dedupe;
  const b = classificar([navio("b", 24), navio("a", 24)], ctx()).lote.dedupe;
  const c = classificar([navio("a", 24), navio("c", 24)], ctx()).lote.dedupe;
  assert.equal(a, b, "mesma rodada em outra ordem = mesma chave");
  assert.notEqual(a, c, "conjunto diferente = chave diferente");
  assert.match(a, /^lineup_shift:[0-9a-f]{8}$/);
});

test("dedupe do individual é navio + ETA novo: a mesma mudança não toca duas vezes", () => {
  const r = classificar([navio("bow", 24)], ctx({ bow: ["AG-1"] }));
  assert.equal(r.individuais[0].dedupe, "ship_delay:bow:2026-09-12T15:00:00.000Z");
});
