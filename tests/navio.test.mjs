// Rótulo de navio e bandeira: o que aparece no seletor do cadastro.
import { test } from "node:test";
import assert from "node:assert/strict";

const { tituloNavio, bandeiraIso } = await import("../lib/navio.ts");

test("tituloNavio segue o padrão NOME [BANDEIRA] (IMO)", () => {
  assert.equal(tituloNavio({ name: "Bow Cedar", flag: "mh", imo: "9087013" }), "BOW CEDAR [MH] (9087013)");
});

test("tituloNavio só escreve o que existe", () => {
  assert.equal(tituloNavio({ name: "MSC BIANCA", flag: null, imo: null }), "MSC BIANCA");
  assert.equal(tituloNavio({ name: "MSC BIANCA", flag: "LR" }), "MSC BIANCA [LR]");
  assert.equal(tituloNavio({ name: "MSC BIANCA", imo: "9770749" }), "MSC BIANCA (9770749)");
  assert.equal(tituloNavio({ name: " sea brave ", flag: " ", imo: "" }), "SEA BRAVE", "branco não vira colchete vazio");
});

test("bandeiraIso traduz o gentílico da CODESP para ISO", () => {
  assert.equal(bandeiraIso("LIBERIANA"), "LR");
  assert.equal(bandeiraIso("I.MARSHALL"), "MH", "ponto e abreviação não atrapalham");
  assert.equal(bandeiraIso("SINGAPURENSE"), "SG");
  assert.equal(bandeiraIso("PANAMENHA"), "PA");
  assert.equal(bandeiraIso("HONG KONG"), "HK", "espaço não atrapalha");
  assert.equal(bandeiraIso("Alemã"), "DE", "acento e caixa não atrapalham");
  assert.equal(bandeiraIso("GRANDCAYMANA"), "KY");
});

test("bandeiraIso aceita ISO que já veio pronto e recusa o que não conhece", () => {
  assert.equal(bandeiraIso("MH"), "MH");
  assert.equal(bandeiraIso("XX"), null, "duas letras que não são bandeira conhecida não passam");
  assert.equal(bandeiraIso("MARCIANA"), null, "gentílico desconhecido vira null, não lixo na tela");
  assert.equal(bandeiraIso(""), null);
  assert.equal(bandeiraIso(null), null);
});
