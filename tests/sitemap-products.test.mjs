import { test } from "node:test";
import assert from "node:assert/strict";
import { sitemapProducts } from "../lib/sitemap-products.ts";

const catalog = (count) => Array.from({ length: count }, (_, id) => ({
  slug: `product-${id}`, updated_at: "2026-09-06T00:00:00.000Z",
}));

test("sitemap includes products after the API's first 1,000 rows without duplicates", async () => {
  const input = catalog(2147);
  const ranges = [];
  const result = await sitemapProducts(async (from, to) => {
    ranges.push([from, to]);
    return { data: input.slice(from, to + 1), error: null };
  });
  assert.deepEqual(result, input);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("an empty catalog ends after one request", async () => {
  let calls = 0;
  assert.deepEqual(await sitemapProducts(async () => {
    calls++;
    return { data: [], error: null };
  }), []);
  assert.equal(calls, 1);
});

test("a failed later page does not silently publish a truncated catalog", async () => {
  await assert.rejects(sitemapProducts(async (from) => from === 0
    ? { data: catalog(1000), error: null }
    : { data: null, error: new Error("unavailable") }), /Sitemap product page failed/);
});

test("large catalogs retain the existing bounded sitemap budget", async () => {
  const input = catalog(6000);
  let calls = 0;
  const result = await sitemapProducts(async (from, to) => {
    calls++;
    return { data: input.slice(from, to + 1), error: null };
  });
  assert.equal(result.length, 5000);
  assert.equal(calls, 5);
  assert.equal(result.at(-1).slug, "product-4999");
});
