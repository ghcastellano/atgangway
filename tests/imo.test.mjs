// O dígito verificador do IMO: a regra que separa "número conferido"
// de "sete teclas quaisquer". A mesma soma existe em SQL
// (public.imo_checksum_ok) — se esta suíte mudar, a migração muda junto.
import { test } from "node:test";
import assert from "node:assert/strict";

const { imoChecksumOk, normalizeImo } = await import("../lib/imo.ts");

test("IMO clássico da OMI confere", () => {
  // 9·7+0·6+7·5+4·4+7·3+2·2 = 139 → termina em 9
  assert.equal(imoChecksumOk("9074729"), true);
});

test("armadilha: 1234567 é VÁLIDO de verdade", () => {
  // 7+12+15+16+15+12 = 77 → termina em 7. Quem escrever teste achando
  // que "sequência óbvia" é inválida cai aqui — por isso o registro.
  assert.equal(imoChecksumOk("1234567"), true);
});

test("um algarismo trocado quebra a soma", () => {
  assert.equal(imoChecksumOk("9074728"), false);
  assert.equal(imoChecksumOk("9174729"), false);
});

test("transposição de vizinhos quebra a soma", () => {
  // 9074729 → 9047729: pesos diferentes tornam a troca visível
  assert.equal(imoChecksumOk("9047729"), false);
});

test("curto, longo, vazio e nulo não passam", () => {
  assert.equal(imoChecksumOk("907472"), false);
  assert.equal(imoChecksumOk("90747290"), false);
  assert.equal(imoChecksumOk(""), false);
  assert.equal(imoChecksumOk(null), false);
  assert.equal(imoChecksumOk(undefined), false);
});

test("normaliza como as RPCs: só dígitos, vazio vira null", () => {
  assert.equal(normalizeImo("IMO 9074729"), "9074729");
  assert.equal(normalizeImo(" 907-47-29 "), "9074729");
  assert.equal(normalizeImo("abc"), null);
  assert.equal(normalizeImo(""), null);
  assert.equal(normalizeImo(null), null);
});

test("com prefixo 'IMO' colado, a validação ainda fecha", () => {
  assert.equal(imoChecksumOk("IMO 9074729"), true);
});
