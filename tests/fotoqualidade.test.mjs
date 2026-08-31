/**
 * Guarda a regra de tamanho — e sobretudo a lição.
 *
 * O teste de proporção existe porque a primeira versão exigia 400px nos
 * DOIS lados e reprovava foto boa de garrafa. Sem ele, alguém "arruma" a
 * regra para lados iguais de novo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const { avaliarFoto } = await import("../lib/fotoqualidade.ts");

/** Retângulo sólido do tamanho pedido — só a metadata importa aqui. */
const foto = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#cccccc" } })
    .jpeg().toBuffer();

test("garrafa alta e estreita passa — produto tem proporção", async () => {
  // 170×544 é o pack shot real de um Gatorade no acervo. A regra antiga,
  // de 400px nos dois lados, reprovava.
  const r = await avaliarFoto(await foto(170, 544));
  assert.equal(r.aprovada, true, r.motivo ?? "");
});

test("etiqueta larga e baixa passa", async () => {
  // Creme dental fotografado deitado: 1176×310.
  const r = await avaliarFoto(await foto(1176, 310));
  assert.equal(r.aprovada, true, r.motivo ?? "");
});

test("miniatura não passa", async () => {
  const r = await avaliarFoto(await foto(200, 200));
  assert.equal(r.aprovada, false);
  assert.match(r.motivo, /pequena/);
});

test("tira longa e fininha não passa — não é foto de produto", async () => {
  // Lado maior grande, mas 60px de altura: é faixa, não embalagem.
  const r = await avaliarFoto(await foto(2000, 60));
  assert.equal(r.aprovada, false);
});

test("devolve as medidas para o log dizer o que reprovou", async () => {
  const r = await avaliarFoto(await foto(300, 300));
  assert.equal(r.largura, 300);
  assert.equal(r.altura, 300);
});
