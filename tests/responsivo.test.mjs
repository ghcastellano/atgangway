/**
 * Responsividade, verificada de verdade.
 *
 * Existe porque "está responsivo" vinha sendo conferido a olho, e a olho
 * passou: um `.btn { width: 100% }` — regra de celular escrita como se
 * fosse regra de componente — deixava dois botões empilhados dentro de um
 * card de 340px no desktop. Layout quebrado não avisa; teste avisa.
 *
 * Roda contra o servidor local. Sem servidor, o arquivo se declara
 * pulado em vez de falhar — não é teste de unidade, é de integração.
 *
 *   npx next build && npx next start -p 3100 &   e então   npm test
 *
 * Producao, e nao `next dev`: o servidor de desenvolvimento ja serviu
 * CSS vazio duas vezes nesta base, e teste que mede pagina sem estilo
 * aprova qualquer layout — botao de 17px de altura passa por botao.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const BASE = process.env.RESP_BASE ?? "http://127.0.0.1:3100";

/** Larguras reais, não redondas: iPhone SE, iPhone 15, iPad retrato e
 *  paisagem, notebook 13", notebook 16" e monitor externo. */
const TELAS = [
  { nome: "iPhone SE", w: 375, h: 667, movel: true },
  { nome: "iPhone 15", w: 393, h: 852, movel: true },
  { nome: "iPad retrato", w: 768, h: 1024 },
  { nome: "iPad paisagem", w: 1024, h: 768 },
  { nome: "notebook 13", w: 1280, h: 800 },
  { nome: "notebook 16", w: 1728, h: 1000 },
  { nome: "monitor", w: 1920, h: 1080 },
];

const ROTAS = ["/", "/shop", "/c/coffee-tea", "/cart", "/login", "/signup"];

/** Teto do container, em --page-w. Acima disso a página para de crescer
 *  de propósito — e o teste precisa saber disso para não exigir que ela
 *  cresça. Se o CSS mudar o teto, este número muda junto. */
const TETO_PAGINA = 1520;

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
  // Procura o playwright no projeto e, se não achar, na instalação
  // global. Um teste que se pula sozinho por falta de dependência é
  // garantia no papel — e responsividade foi exatamente o que passou
  // batido por ser conferida a olho.
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
    } catch (e) {
      indisponivel = `sem playwright (${e.message}) — \`npm i -D playwright\` resolve`;
    }
  }
  if (navegador) indisponivel = null;
});

after(async () => {
  if (navegador) await navegador.close();

  /**
   * O aviso ALTO de que os casos não rodaram.
   *
   * Sem ele, `npm test` termina com "# pass 200 / # fail 0 /
   * # skipped 54" e ninguém repara no número do meio: 21% da suíte —
   * ESTA suíte inteira — não testou nada, e o resumo parece verde. Um
   * teste que passa quando não testou é pior que teste nenhum, porque
   * dá confiança.
   *
   * Não dá para simplesmente REPROVAR: `npm test` roda sem servidor de
   * propósito, e quebrar isso obrigaria a subir o Next para conferir
   * uma função de formatação. Então o remédio é ser impossível de não
   * ver. Vai no `after` porque `indisponivel` só é conhecido depois do
   * `before` — no topo do módulo ele ainda é null, que foi como eu
   * escrevi na primeira tentativa e o aviso nunca apareceu.
   */
  if (indisponivel) {
    const linha = "=".repeat(66);
    console.error(
      `\n${linha}\n` +
      `  ATENCAO: os ${TELAS.length * ROTAS.length} casos de responsividade NAO RODARAM.\n` +
      `  Motivo: ${indisponivel}\n\n` +
      `  Para rodar de verdade:\n` +
      `    npx next build && npx next start -p 3100 &\n` +
      `    npm run test:responsivo\n${linha}\n`
    );
  }
});

/** Mede uma rota numa largura. */
async function medir(rota, tela) {
  const p = await navegador.newPage({ viewport: { width: tela.w, height: tela.h } });
  try {
    await p.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(400);
    return await p.evaluate((larguraTela) => {
      const doc = document.documentElement;
      // Quem vaza para fora da tela. Ignora o que está escondido e o que
      // rola dentro do próprio container (carrossel é overflow de
      // propósito).
      const vazando = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (r.right > larguraTela + 1 || r.left < -1) {
          // Sobe a árvore inteira, não só o pai: num carrossel o card
          // transborda de propósito, mas quem rola é o .rail lá em cima,
          // e olhar só o pai direto marcava o carrossel como defeito.
          let rola = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            // `clip` entra na lista: o body usa overflow-x: clip, que é o que
            // segura o sangramento de ponta a ponta do cabeçalho e do rodapé
            // na ultrawide sem criar rolagem lateral.
            if (/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX)) { rola = true; break; }
          }
          if (!rola) vazando.push(`${el.tagName.toLowerCase()}.${el.className || "?"}`.slice(0, 60));
        }
      }
      // Botões que se encostam ou se sobrepõem. Nasceu de um caso real:
      // ao tirar o `width: 100%` do .btn, dois botões num container que
      // era bloco solto caíram na mesma linha, colados, com o segundo
      // vazando para fora da gaveta do carrinho. Oito pixels é o mínimo
      // para o dedo não errar o alvo.
      const botoes = [...document.querySelectorAll(".btn")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const colados = [];
      for (let i = 0; i < botoes.length; i++) {
        for (let j = i + 1; j < botoes.length; j++) {
          const a = botoes[i].getBoundingClientRect();
          const b = botoes[j].getBoundingClientRect();
          const folgaX = Math.max(a.left, b.left) - Math.min(a.right, b.right);
          const folgaY = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
          // Só reclama quando as caixas se cruzam nos DOIS eixos com
          // folga menor que 8px — lado a lado com espaço está certo.
          if (folgaX < 8 && folgaY < 8) {
            colados.push(
              `${botoes[i].textContent.trim().slice(0, 20)} / ${botoes[j].textContent.trim().slice(0, 20)}`
            );
          }
        }
      }

      const conteudo = document.querySelector(".shell > main") ?? document.querySelector("main");
      // O BLOCO de conteúdo, não o <main>.
      //
      // Medir só o <main> deixou passar uma regressão inteira: uma regra
      // base `.shell > main` com grid de UMA coluna venceu, por
      // especificidade, a grade de 12 colunas da home. O <main> continuou
      // com 1518px e o teste seguiu verde — mas tudo abaixo do herói se
      // espremeu na primeira trilha, encostado à esquerda, com metade da
      // tela vazia. Largura de container não prova largura de conteúdo.
      // A MAIOR visível, não a primeira do DOM: /shop tem grade escondida
      // no trilho de filtros, e querySelector devolvia uma de 0px.
      const bloco = [...document.querySelectorAll(".pgrid, .deptgrid, .catgrid, .rail")]
        .map((e) => e.getBoundingClientRect().width)
        .reduce((maior, w) => Math.max(maior, w), 0);
      return {
        rolagemH: doc.scrollWidth > larguraTela + 1,
        scrollWidth: doc.scrollWidth,
        vazando: [...new Set(vazando)].slice(0, 5),
        larguraConteudo: conteudo ? Math.round(conteudo.getBoundingClientRect().width) : 0,
        larguraBloco: Math.round(bloco),
        colados,
        larguraPagina: (() => {
          const shell = document.querySelector(".shell");
          return shell ? Math.round(shell.getBoundingClientRect().width) : 0;
        })(),
      };
    }, tela.w);
  } finally {
    await p.close();
  }
}

describe("responsividade", () => {
  for (const tela of TELAS) {
    for (const rota of ROTAS) {
      test(`${rota} em ${tela.nome} (${tela.w}px)`, async (t) => {
        if (indisponivel) return t.skip(indisponivel);
        const m = await medir(rota, tela);

        // 1. Rolagem horizontal é sempre defeito. Nenhuma tela deveria
        //    exigir que a pessoa arraste para o lado para ler.
        assert.equal(
          m.rolagemH, false,
          `${rota} rola na horizontal em ${tela.w}px (scrollWidth ${m.scrollWidth})`
        );

        // 2. Nada pode transbordar a tela, exceto dentro de um container
        //    que rola de propósito.
        assert.deepEqual(m.vazando, [], `${rota} tem elemento fora da tela em ${tela.w}px`);

        // 3. No desktop o conteúdo tem de USAR a largura. Uma coluna de
        //    500px numa tela de 1728 é o site de celular centralizado —
        //    que é exatamente a reclamação que originou este teste.
        // Botão colado em botão: alvo de toque que o dedo erra.
        assert.deepEqual(m.colados, [], `${rota}: botões colados em ${tela.w}px`);

        // 3. No desktop a PÁGINA tem de usar a largura. Vale para o
        //    container: /login e as páginas de texto mantêm coluna
        //    estreita de propósito — formulário largo é pior de
        //    preencher, e linha de texto longa é pior de ler.
        if (!tela.movel && tela.w >= 1280) {
          // O teto é decisão de projeto, não sobra: linha de 1900px
          // obriga a cabeça a varrer a tela inteira para ler. Então o
          // certo é usar 80% da tela OU bater no teto — o que vier
          // primeiro. Uma coluna de 500px não passa nem em um nem em outro.
          const minimo = Math.min(tela.w * 0.8, TETO_PAGINA);
          assert.ok(
            m.larguraPagina >= minimo,
            `${rota}: página com ${m.larguraPagina}px numa tela de ${tela.w}px — abaixo de ${Math.round(minimo)}px`
          );
        }
        // 4. Nas telas de catálogo o conteúdo também precisa usar a
        //    largura: vitrine em coluna de 500px é o site de celular
        //    centralizado, que foi a reclamação que gerou este teste.
        if (!tela.movel && tela.w >= 1280 && ["/", "/shop", "/c/coffee-tea"].includes(rota)) {
          assert.ok(
            m.larguraConteudo >= tela.w * 0.7,
            `${rota}: vitrine com ${m.larguraConteudo}px numa tela de ${tela.w}px — menos de 70%`
          );
          // E a grade DENTRO dele. O container largo com a grade estreita
          // é o estado que passou batido: <main> em 1518px e a vitrine
          // espremida em 828px, encostada à esquerda. 60% do <main> é
          // folgado de propósito — /shop tem trilho de filtros comendo
          // uma faixa fixa, e o que se quer proibir é a grade colapsar
          // para uma fração da página.
          assert.ok(
            m.larguraBloco >= m.larguraConteudo * 0.6,
            `${rota}: grade com ${m.larguraBloco}px dentro de um <main> de ${m.larguraConteudo}px em ${tela.w}px — a página é larga e o conteúdo não`
          );
        }
      });
    }
  }
});
