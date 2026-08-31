import { test } from "node:test";
import assert from "node:assert/strict";
import { packSize } from "../lib/catalog.ts";

/**
 * O tamanho da embalagem sai do nome e ganha linha própria no card.
 *
 * O risco do regex não é deixar de casar — é casar demais e comer
 * pedaço do nome. "Nescau 2.0" terminando em "2.0" não é tamanho;
 * "Coffee Beans 1 kg" é. Os casos abaixo são os que apareceram de
 * verdade na colheita do Open Food Facts.
 */

test("separa unidade simples no fim do nome", () => {
  assert.deepEqual(packSize("Pilão Espresso Coffee Beans 1 kg"), {
    title: "Pilão Espresso Coffee Beans",
    unit: "1 kg",
  });
  assert.deepEqual(packSize("Leão Peach Iced Tea 250 ml"), {
    title: "Leão Peach Iced Tea",
    unit: "250 ml",
  });
  assert.deepEqual(packSize("Melitta Traditional Ground Coffee 500 g"), {
    title: "Melitta Traditional Ground Coffee",
    unit: "500 g",
  });
});

test("aceita decimal e unidade colada", () => {
  assert.deepEqual(packSize("Coca-Cola Original 1.5 L"), {
    title: "Coca-Cola Original",
    unit: "1.5 L",
  });
  assert.deepEqual(packSize("Guaraná Antarctica 350ml"), {
    title: "Guaraná Antarctica",
    unit: "350ml",
  });
});

test("aceita multipack", () => {
  assert.deepEqual(packSize("Crystal Mineral Water 12 x 500 ml"), {
    title: "Crystal Mineral Water",
    unit: "12 x 500 ml",
  });
  assert.deepEqual(packSize("Skol Beer 6×350 ml"), {
    title: "Skol Beer",
    unit: "6×350 ml",
  });
});

test("não inventa unidade onde não há", () => {
  for (const n of [
    "Nescau 2.0",
    "Toddy Chocolate Powder",
    "Havaianas Top",
    "Coffee Beans 100",
  ]) {
    assert.deepEqual(packSize(n), { title: n, unit: null }, n);
  }
});

test("nome que é só o tamanho continua inteiro", () => {
  // Sem isto o card ficaria com o título vazio e só "500 g" na linha
  // de baixo — pior que a mistura que a separação existe para desfazer.
  assert.deepEqual(packSize("500 g"), { title: "500 g", unit: null });
});

test("espaço irregular na unidade vira espaço único", () => {
  assert.deepEqual(packSize("Sardines in Oil  125   g"), {
    title: "Sardines in Oil",
    unit: "125 g",
  });
});
