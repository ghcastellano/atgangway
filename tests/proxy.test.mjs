import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("usa a convenção proxy do Next 16 sem deixar o middleware legado", () => {
  assert.equal(existsSync("middleware.ts"), false);
  assert.equal(existsSync("proxy.ts"), true);

  const fonte = readFileSync("proxy.ts", "utf-8");
  assert.match(fonte, /export async function proxy\s*\(/);
  assert.match(fonte, /export const config\s*=/);
});
