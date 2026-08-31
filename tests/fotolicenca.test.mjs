// Crédito de foto: licença sem crédito publicado é licença descumprida.
import { test } from "node:test";
import assert from "node:assert/strict";

const l = await import("../lib/fotolicenca.ts");

test("remonta o EAN fatiado do caminho da imagem", () => {
  assert.equal(
    l.eanFromOpenFactsPath("/images/products/789/608/901/1982/front_pt.3.full.jpg"),
    "7896089011982"
  );
  // Código curto não vem fatiado.
  assert.equal(l.eanFromOpenFactsPath("/images/products/20918828/front_de.4.full.jpg"), "20918828");
  assert.equal(l.eanFromOpenFactsPath("/qualquer/outra/coisa.jpg"), null);
});

test("foto do Open Food Facts vira crédito apontando para a ficha", () => {
  const c = l.creditoDaFoto(
    "https://images.openfoodfacts.org/images/products/789/608/901/1982/front_pt.3.full.jpg"
  );
  assert.equal(c.license, "CC BY-SA 3.0");
  assert.equal(c.sourceTitle, "Open Food Facts");
  assert.equal(c.sourceUrl, "https://world.openfoodfacts.org/product/7896089011982");
  assert.ok(c.attribution.includes("CC BY-SA 3.0"));
});

test("os três acervos são reconhecidos, cada um com o seu site", () => {
  const beleza = l.creditoDaFoto(
    "https://images.openbeautyfacts.org/images/products/789/115/002/5646/front_pt.1.full.jpg"
  );
  assert.equal(beleza.sourceTitle, "Open Beauty Facts");
  assert.ok(beleza.sourceUrl.startsWith("https://world.openbeautyfacts.org/product/"));
  const outros = l.creditoDaFoto(
    "https://images.openproductsfacts.org/images/products/123/456/789/0123/front_en.1.full.jpg"
  );
  assert.equal(outros.sourceTitle, "Open Products Facts");
});

test("foto do fornecedor não entra na página de créditos", () => {
  assert.equal(l.creditoDaFoto("https://cdn.fornecedor.com.br/foto.jpg"), null);
  assert.equal(l.creditoDaFoto("não é url"), null);
  assert.equal(l.creditoDaFoto(""), null);
});
