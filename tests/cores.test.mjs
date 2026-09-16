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
import { readFileSync, readdirSync } from "node:fs";

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
  /* --amber mudou de PAPEL na virada para o tema claro, e por isso os
     dois pares que o mediam como TEXTO saíram daqui.

     No tema escuro ele era a cor do preço e do link: âmbar vibrante
     sobre azul quase preto passa folgado. Sobre branco o mesmo âmbar dá
     2:1 — ilegível, e não há ajuste que salve sem deixar de ser âmbar.
     Então ele passou a ser EXCLUSIVAMENTE fundo de ação (botão, selo),
     sempre com --amber-ink por cima; quem carrega o destaque em texto é
     --amber-hi, um âmbar queimado que passa em AA no branco.

     Medir "amber sobre card" hoje seria medir uma combinação que a tela
     não tem — falso alarme, do tipo que ensina a ignorar o teste. O que
     entrou no lugar são os dois usos reais. */
  ["âmbar de destaque sobre card — preço e link", "amber-hi", "card", 4.5],
  ["âmbar de destaque sobre a página", "amber-hi", "night", 4.5],
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

/**
 * A família ESCURA — cabeçalho, rodapé, barra de compra, abas da conta
 * e painel, todos pela classe `.sup-escura`. Era medida em lugar
 * nenhum: as abas da conta chegaram a ter rótulo a 3,1:1 sem que teste
 * algum reclamasse.
 *
 * `--card-hi` escuro não é token do :root (mora em `.sup-escura`), por
 * isso entra como literal lido da própria regra.
 */
function cardHiEscuro() {
  const css = readFileSync("app/styles/00-tokens-e-base.css", "utf-8");
  const bloco = css.slice(css.indexOf(".sup-escura {"));
  return /--card-hi:\s*(#[0-9A-Fa-f]{6})/.exec(bloco.slice(0, bloco.indexOf("}")))?.[1];
}
const T_ESCURO = { ...T, "dark-card-hi": cardHiEscuro() };

const PARES_ESCUROS = [
  ["texto sobre superfície escura", "dark-ink", "dark", 4.5],
  ["texto sobre card escuro", "dark-ink", "dark-card", 4.5],
  ["texto secundário sobre superfície escura", "dark-muted", "dark", 4.5],
  ["texto secundário sobre card escuro", "dark-muted", "dark-card", 4.5],
  ["texto secundário sobre card realçado escuro", "dark-muted", "dark-card-hi", 4.5],
  ["rótulo apagado sobre superfície escura", "dark-faint", "dark", 4.5],
  ["rótulo apagado sobre o fundo do painel", "dark-faint", "dark-deep", 4.5],
  ["rótulo apagado sobre card escuro", "dark-faint", "dark-card", 4.5],
  ["âmbar claro sobre superfície escura", "amber-on-dark", "dark", 4.5],
  ["âmbar claro sobre card realçado — item ativo do painel", "amber-on-dark", "dark-card-hi", 4.5],
];

/* --faint sobre --card-hi escuro dá 3,9:1 e por isso NÃO é par da
   tela: toda superfície do painel que pinta --card-hi com texto dentro
   redefine --faint para --muted (último teste deste arquivo). */

test("a família escura foi encontrada", () => {
  for (const [, fg, bg] of PARES_ESCUROS) {
    assert.ok(T_ESCURO[fg], `token --${fg} sumiu`);
    assert.ok(T_ESCURO[bg], `token --${bg} sumiu (ou .sup-escura perdeu o --card-hi)`);
  }
});

for (const [nome, fg, bg, min] of PARES_ESCUROS) {
  test(`contraste AA (escuro): ${nome}`, () => {
    const r = contraste(T_ESCURO[fg], T_ESCURO[bg]);
    assert.ok(r >= min, `${nome}: ${r.toFixed(2)}:1 — abaixo de ${min}:1 (--${fg} sobre --${bg})`);
  });
}

test("a família escura mora só em .sup-escura", () => {
  // A quinta cópia é a que diverge. Quem precisa de superfície escura
  // põe a classe no JSX; a folha não redefine --ink com a tinta clara.
  const donos = readdirSync("app/styles").filter((f) =>
    /--ink:\s*var\(--dark-ink\)/.test(readFileSync(`app/styles/${f}`, "utf-8"))
  );
  assert.deepEqual(donos, ["00-tokens-e-base.css"]);
});

test("superfície --card-hi do painel com texto apagado dentro leva --faint acima", () => {
  // .adm-sobra-grid h4 e os rótulos da tabela ficavam a 3,9:1.
  const css = readFileSync("app/styles/45-painel.css", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const sel of [".adm-sobra-grid section", ".adm-table tbody tr:hover"]) {
    const regra = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(regra, `regra ${sel} sumiu`);
    assert.match(regra[1], /background:\s*var\(--card-hi\)/, `${sel} não é mais --card-hi`);
    assert.match(regra[1], /--faint:\s*var\(--muted\)/, `${sel} voltou a deixar --faint a 3,9:1`);
  }
  assert.ok(
    contraste(T_ESCURO["dark-muted"], T_ESCURO["dark-card-hi"]) >= 4.5,
    "o tom que substitui --faint também tem de passar sobre --card-hi"
  );
});
