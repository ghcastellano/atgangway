import test from "node:test";
import assert from "node:assert/strict";
import { escapeEmailText } from "../lib/email-text.ts";

test("plain-text email fallback cannot inject HTML elements or links", () => {
  const input = '<a href="https://attacker.example">Pay here</a> & <img src=x onerror=alert(1)>';
  const html = escapeEmailText(input);
  assert.equal(html.includes("<"), false);
  assert.equal(html.includes(">"), false);
  assert.ok(html.includes("&lt;a href=&quot;https://attacker.example&quot;&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("ordinary email text and line breaks retain their content", () => {
  assert.equal(escapeEmailText("Order AG-123\n2x Coffee\nTotal $25.00"), "Order AG-123\n2x Coffee\nTotal $25.00");
  assert.equal(escapeEmailText("O\x27Brien & Sons"), "O&#39;Brien &amp; Sons");
});
