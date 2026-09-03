import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("logo social preserva nome, paleta e resolução para o Instagram", () => {
  const svg = readFileSync("public/social/at-gangway-instagram.svg", "utf-8");
  assert.match(svg, />AT<\/text>/);
  assert.match(svg, />GANGWAY<\/text>/);
  assert.match(svg, /#040D1A/);
  assert.match(svg, /#FFB648/);

  const png = readFileSync("public/social/at-gangway-instagram.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1080);
});
