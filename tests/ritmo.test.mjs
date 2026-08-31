/**
 * Ritmo vertical: o espaço entre seções pertence à PÁGINA.
 *
 * Existe por um defeito com nome próprio — "componente grudado". A faixa
 * do Captain apareceu colada no título "Categories", e a causa não foi
 * essa faixa: era que cada bloco declarava a própria margem superior,
 * com o número que pareceu bom na hora. 30px no herói, 22 no título, 14
 * na faixa, 4 na grade. Quando duas margens vizinhas discordam, uma
 * vence, e o resultado lê como elemento colado.
 *
 * Corrigir caso a caso não resolve: o defeito volta no próximo bloco.
 * O que resolve é a regra que este teste guarda —
 *
 *   nenhum filho direto de <main> declara margem vertical própria;
 *   quem separa é um único row-gap da grade da página.
 *
 * Então a asserção não é "no mínimo N pixels". É mais forte: TODO
 * intervalo entre blocos empilhados tem de ser exatamente o row-gap que
 * a página declara. Assim, margem solta em qualquer componente novo
 * aparece aqui como um intervalo fora do compasso, mesmo que seja um
 * intervalo grande e bonito.
 *
 * Roda contra o servidor de produção, pelo mesmo motivo de
 * responsivo.test.mjs: `next dev` já serviu CSS vazio nesta base, e
 * página sem estilo tem ritmo perfeito por acidente.
 *
 *   npx next build && npx next start -p 3100 &   e então   npm test
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const BASE = process.env.RESP_BASE ?? "http://127.0.0.1:3100";

const TELAS = [
  { nome: "iPhone 15", w: 393, h: 852 },
  { nome: "iPad retrato", w: 834, h: 1112 },
  { nome: "iPad paisagem", w: 1194, h: 834 },
  { nome: "notebook 16", w: 1728, h: 1000 },
];

const ROTAS = ["/", "/shop", "/c/coffee-tea"];

/** Folga de medição: subpixel de layout e arredondamento de zoom. */
const TOLERANCIA = 2;

let navegador = null;
let indisponivel = null;

before(async () => {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    indisponivel = `sem servidor em ${BASE} (${e.message})`;
    return;
  }
  const req = createRequire(import.meta.url);
  const tentativas = [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean);
  try {
    const { execSync } = await import("node:child_process");
    const global = execSync("npm root -g", { encoding: "utf-8" }).trim();
    if (global) tentativas.push(`${global}/playwright`);
  } catch {
    // sem npm no PATH: segue com o que já há na lista
  }
  for (const caminho of tentativas) {
    try {
      const { chromium } = req(caminho);
      navegador = await chromium.launch();
      break;
    } catch {
      // tenta o próximo caminho
    }
  }
  if (!navegador) indisponivel = "playwright não encontrado";
});

after(async () => {
  if (navegador) await navegador.close();
});

async function medir(rota, tela) {
  const p = await navegador.newPage({ viewport: { width: tela.w, height: tela.h } });
  try {
    await p.goto(BASE + rota, { waitUntil: "networkidle", timeout: 60000 });
    return await p.evaluate(() => {
      const main = document.querySelector(".shell > main");
      if (!main) return { erro: "sem <main> dentro de .shell" };

      const cs = getComputedStyle(main);
      // Página que não empilha em grade não tem row-gap para comparar —
      // e é justamente esse o estado que o teste existe para proibir.
      const gap = cs.display.includes("grid") ? Math.round(parseFloat(cs.rowGap) || 0) : null;

      const blocos = [...main.children]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => {
          if (r.width === 0 || r.height === 0) return false;
          const s = getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden";
        })
        .sort((a, b) => a.r.top - b.r.top);

      const nome = ({ el }) =>
        `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`;

      // Só compara blocos que de fato se empilham. Dois testes, e os dois
      // são necessários: precisam se cruzar na horizontal (senão são
      // colunas vizinhas) E o de baixo precisa começar depois que o de
      // cima termina (senão dividem a mesma fileira — é o caso do herói
      // e do painel do navio no desktop, onde o herói ainda sangra para
      // fora da própria coluna e cruza a do lado).
      const empilham = (a, b) =>
        Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 &&
        b.r.top >= a.r.bottom - 1;

      const vaos = [];
      for (let i = 0; i < blocos.length; i++) {
        for (let j = i + 1; j < blocos.length; j++) {
          if (!empilham(blocos[i], blocos[j])) continue;
          vaos.push({
            de: nome(blocos[i]),
            para: nome(blocos[j]),
            vao: Math.round(blocos[j].r.top - blocos[i].r.bottom),
          });
          break; // o próximo que empilha, e só ele
        }
      }
      return { gap, vaos, quantos: blocos.length };
    });
  } finally {
    await p.close();
  }
}

describe("ritmo vertical", () => {
  for (const tela of TELAS) {
    for (const rota of ROTAS) {
      test(`${rota} em ${tela.nome} (${tela.w}px)`, async (t) => {
        if (indisponivel) return t.skip(indisponivel);
        const m = await medir(rota, tela);
        assert.equal(m.erro, undefined, m.erro);

        // 1. A página empilha em grade e declara o compasso. Sem isto,
        //    o espaço volta a ser decidido bloco a bloco.
        assert.ok(
          m.gap !== null,
          `${rota} em ${tela.w}px: <main> não é grade — o espaço entre blocos está sendo decidido por cada componente`
        );
        assert.ok(m.gap > 0, `${rota} em ${tela.w}px: row-gap da página é ${m.gap}px`);

        // 2. Todo intervalo entre blocos empilhados É o compasso.
        //    Fora dele significa margem solta em algum componente.
        const fora = m.vaos.filter((v) => Math.abs(v.vao - m.gap) > TOLERANCIA);
        assert.deepEqual(
          fora,
          [],
          `${rota} em ${tela.w}px: intervalo fora do compasso de ${m.gap}px — ` +
            fora.map((v) => `${v.de} → ${v.para} = ${v.vao}px`).join("; ")
        );
      });
    }
  }
});
