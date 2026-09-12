// Parser do line-up: a peça mais frágil do sync (depende do HTML de
// terceiro). Os casos abaixo são calcados na fonte REAL da CODESP —
// latin-1, tabela sem </tr> e datas em M/D/YYYY.
import { test } from "node:test";
import assert from "node:assert/strict";

const { parseLineup, parseCodesp, parseDate, cleanShipName, tableRows } = await import(
  "../lib/lineup.ts"
);

const CODESP_URL = "https://intranet.portodesantos.com.br/Navios/Navios4.asp";

test("parseDate entende M/D/YYYY (formato da CODESP) em hora de Santos", () => {
  assert.equal(parseDate("8/24/2026"), "2026-08-24T15:00:00.000Z"); // meio-dia local
  assert.equal(parseDate("1/17/2024 17:30"), "2024-01-17T20:30:00.000Z");
});

test("parseDate desambigua dd/mm quando o 1º número passa de 12", () => {
  // 24/08 só pode ser dia/mês
  assert.equal(parseDate("24/08/2026"), "2026-08-24T15:00:00.000Z");
  assert.equal(parseDate("nada aqui"), null);
  assert.equal(parseDate("99/99/9999"), null);
});

test("parseDate aceita hora vinda de coluna separada", () => {
  assert.equal(parseDate("8/24/2026", "06:45"), "2026-08-24T09:45:00.000Z");
});

test("cleanShipName remove o calado colado ao nome", () => {
  assert.equal(cleanShipName("SHAMAL 10 5"), "SHAMAL");
  assert.equal(cleanShipName("GUAPORE 05 0"), "GUAPORE");
  assert.equal(cleanShipName("RÔMULO ALMEIDA 10 2"), "RÔMULO ALMEIDA");
  assert.equal(cleanShipName("BRITOU12 1,"), "BRITOU12");
  assert.equal(cleanShipName("cma cgm melody"), "CMA CGM MELODY");
});

test("cleanShipName tira o fragmento que a CODESP cortou em 25 caracteres", () => {
  assert.equal(cleanShipName("MERCOSUL FORTALEZA (CNC L 10 5"), "MERCOSUL FORTALEZA", "parêntese aberto e nunca fechado é corte, não nome");
  assert.equal(cleanShipName("SHAMROCK MERCURY (BAND. 9 8"), "SHAMROCK MERCURY");
  assert.equal(cleanShipName("NC BRISA (REB S/L) 4 5"), "NC BRISA (REB S/L)", "parêntese fechado é anotação legítima e fica");
  assert.equal(cleanShipName("LOG-IN ENDURANCE (REB)"), "LOG-IN ENDURANCE (REB)");
});

test("tableRows lida com tabela sem </tr> (ASP clássico)", () => {
  const html =
    "<table><tr><td>#<td>SHAMAL 10 5<td>CIPRIOTA<td>8/24/2026" +
    "<tr><td>#<td>MERSEY 11 0<td>I.MARSHALL<td>8/25/2026</table>";
  const rows = tableRows(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][1], "SHAMAL 10 5");
});

test("parseCodesp extrai navio, ETA e bandeira da estrutura real", () => {
  const html =
    "<table>" +
    "<tr><td>#<td>Navio Calado<td>Nacionalidade<td>Dt.Chegada<td>Hora" +
    "<tr><td>#<td>ORANGE BLOSSOM 12 4<td>LIBERIANA<td>8/28/2026<td>14:00<td>2864/2026/6<td>CONE SUL AGENCIA" +
    "</table>";
  const { rows } = parseCodesp(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "ORANGE BLOSSOM");
  assert.equal(rows[0].flag, "LIBERIANA");
  assert.equal(rows[0].eta, "2026-08-28T17:00:00.000Z");
});

test("embarcações da autoridade portuária são descartadas", () => {
  const html =
    "<table><tr><td>#<td>GUAPORE 05 0<td>BRASILEIRA<td>8/24/2026<td>9004/2024/6<td>CODESP<td>MARINHA</table>";
  assert.equal(parseCodesp(html).rows.length, 0);
});

test("duplicatas de navio no mesmo dia são removidas", () => {
  const row = "<tr><td>#<td>MERSEY 11 0<td>I.MARSHALL<td>8/25/2026<td>3938/2026/3<td>CONE SUL AGENCIA";
  const { rows } = parseCodesp(`<table>${row}${row}</table>`);
  assert.equal(rows.length, 1);
});

test("HTML sem tabela devolve motivo em vez de quebrar", () => {
  const { rows, note } = parseLineup("<html><body><p>manutenção</p></body></html>", CODESP_URL);
  assert.equal(rows.length, 0);
  assert.match(note, /nenhuma tabela/);
});

test("parseLineup escolhe o parser da CODESP pela URL", () => {
  const html =
    "<table><tr><td>#<td>CHEMROAD NEXUS 09 8<td>PANAMENHA<td>8/20/2026<td>05:15<td>1/2026/1<td>X AGENCIA</table>";
  const { note } = parseLineup(html, CODESP_URL);
  assert.match(note, /CODESP/);
});
