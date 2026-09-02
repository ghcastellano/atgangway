/**
 * Contraste da paleta, medido.
 *
 * O CSS trazia a anotação "≥4.5:1 sobre card/night — AA" ao lado de um
 * token. A anotação estava certa — mas anotação não é verificação: basta
 * alguém clarear um fundo ou escurecer um texto e ela vira mentira sem
 * ninguém notar. Aqui a conta é refeita a cada `npm test`.
 *
 * Os tokens são lidos do próprio globals.css: cópia neste arquivo
 * passaria a medir uma paleta que não é mais a do site.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Lê os tokens de cor do :root, direto da folha de estilo. */
function tokens() {
  const css = readFileSync("app/styles/00-tokens-e-base.css" /* os tokens moram aqui desde o split do globals.css em camadas */, "utf-8");
  const raiz = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const t = {};
  for (const m of raiz.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) t[m[1]] = m[2];
  return t;
}

const canal = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminância relativa, na fórmula da WCAG 2.x. */
function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function contraste(a, b) {
  const x = luminancia(a);
  const y = luminancia(b);
  const [alto, baixo] = x > y ? [x, y] : [y, x];
  return (alto + 0.05) / (baixo + 0.05);
}

const T = tokens();

/**
 * Só pares que existem na tela. Medir combinação que ninguém usa dá
 * falso alarme e ensina a ignorar o teste.
 *
 * 3:1 onde o elemento é grande ou não é texto (número de KPI em 21px,
 * borda); 4.5:1 no resto, que é o mínimo AA para texto normal.
 */
const PARES = [
  ["texto sobre o fundo da página", "ink", "abyss", 4.5],
  ["texto sobre card", "ink", "card", 4.5],
  ["texto secundário sobre card", "muted", "card", 4.5],
  ["texto secundário sobre a página", "muted", "night", 4.5],
  ["rótulo apagado sobre card", "faint", "card", 4.5],
  ["rótulo apagado sobre a página", "faint", "night", 4.5],
  ["rótulo apagado sobre card realçado", "faint", "card-hi", 4.5],
  ["âmbar sobre card — preço e link", "amber", "card", 4.5],
  ["âmbar sobre a página", "amber", "abyss", 4.5],
  ["âmbar claro sobre card", "amber-hi", "card", 4.5],
  ["texto do botão âmbar", "amber-ink", "amber", 4.5],
  ["número de KPI em turquesa", "teal", "card", 3.0],
  ["alerta sobre card", "danger", "card", 4.5],
  ["WhatsApp sobre card", "wa", "card", 4.5],
];

test("todos os tokens de cor foram encontrados no globals.css", () => {
  for (const [, fg, bg] of PARES) {
    assert.ok(T[fg], `token --${fg} sumiu do :root`);
    assert.ok(T[bg], `token --${bg} sumiu do :root`);
  }
});

for (const [nome, fg, bg, min] of PARES) {
  test(`contraste AA: ${nome}`, () => {
    const r = contraste(T[fg], T[bg]);
    assert.ok(
      r >= min,
      `${nome}: ${r.toFixed(2)}:1 — abaixo de ${min}:1 (--${fg} sobre --${bg})`
    );
  });
}
