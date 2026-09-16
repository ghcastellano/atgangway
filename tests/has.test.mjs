/**
 * `:has()` na loja.
 *
 * O Safari < 15.4 ignora a regra inteira que contém `:has()`. Duas
 * vezes isso virou defeito visível: o cartão da home pousando em cima
 * do herói no iPad, e a vitrine mostrando a navegação de categorias
 * duas vezes (trilho + grade). Nos dois casos o `:has()` era o GATILHO
 * de um layout — e gatilho ignorado não degrada, erra.
 *
 * Por isso a regra aqui é de lista fechada: todo `:has()` das folhas
 * precisa estar abaixo, com o motivo de a falha dele ser aceitável.
 * Um novo entra discutindo, não passando despercebido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = "app/styles";

/** seletor → por que ignorá-lo no Safari antigo não quebra nada */
const ACEITOS = {
  // Só o anel em volta do ícone some; o estado vazio continua legível.
  ".empty .i:has(svg)": "cosmético",
  // Painel e admin: telas da equipe, em navegador atual.
  ".shell:has(.admin-wide) > main": "admin",
  ".shell:has(.adm)": "painel",
  ".shell:has(.adm) > main": "painel",
  ".shell:has(.adm-login)": "painel",
};

function seletoresComHas() {
  const achados = [];
  for (const nome of readdirSync(DIR).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(`${DIR}/${nome}`, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const sel of m[1].split(",")) {
        const s = sel.trim().replace(/\s+/g, " ");
        if (s.includes(":has(")) achados.push([nome, s]);
      }
    }
  }
  return achados;
}

test("todo :has() das folhas está na lista de aceitos", () => {
  const achados = seletoresComHas();
  // Sem isto o teste passaria no dia em que o parser deixasse de
  // enxergar as regras — zero examinadas, zero falhas.
  assert.ok(achados.length > 0, "nenhum :has() encontrado — o parser quebrou?");
  for (const [arquivo, sel] of achados) {
    assert.ok(
      sel in ACEITOS,
      `${arquivo}: "${sel}" usa :has(), que o Safari < 15.4 ignora. Se ele ` +
        `decide layout, reescreva com classe vinda do servidor ou com ` +
        `seletor de irmão; se a falha é inofensiva, adicione-o a ACEITOS ` +
        `com o motivo.`
    );
  }
});

test("a vitrine esconde a grade só quando o trilho existe, sem :has()", () => {
  const css = readFileSync(`${DIR}/90-desktop.css`, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const alvo of [".catgrid", ".subhead", ".cats-tabs"]) {
    assert.match(
      css,
      new RegExp(`\\.facets ~ \\.listcol \\${alvo}\\b`),
      `a regra que esconde ${alvo} ao lado do trilho sumiu ou mudou de forma`
    );
  }
});
