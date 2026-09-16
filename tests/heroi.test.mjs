/**
 * A fileira de abertura da home: herói + o cartão que o acompanha.
 *
 * Três commits seguidos consertaram o MESMO sintoma — o cartão pousando
 * em cima do herói no iPad, cortando a faixa de fatos. As duas causas
 * foram a mesma frase escrita de dois jeitos: uma regra que joga o
 * cartão na coluna 9 sem exigir que o herói tenha encolhido para 8.
 * Primeiro o gatilho foi `:has()`, que o Safari antigo ignora; depois a
 * faixa 768–1023px, onde o herói ainda tem as 12 colunas. Enquanto
 * "posicionar o cartão" e "encolher o herói" forem decisões separadas,
 * a terceira vez é questão de tempo.
 *
 * Aqui ficam as duas invariantes que fecham essa porta:
 *
 *   1. no CSS, o cartão não tem posição fixa — só `span 4`, e só com
 *      `.lado`; o auto-placement o põe ao lado do herói de 8 colunas, e
 *      abaixo dele se o herói algum dia tiver 12;
 *   2. no servidor, a classe `lado` SAI do cartão — não é um segundo
 *      juízo sobre o mesmo dado.
 *
 * Teste de arquivo, e não de render, porque o defeito nunca esteve na
 * árvore React: ele estava na distância entre dois arquivos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = "app/styles/90-desktop.css";
const PAGE = "app/page.tsx";

/**
 * Os blocos `seletor { declarações }` da folha.
 *
 * As chaves do @media não atrapalham: o corpo de uma regra não pode
 * conter chave, então o casamento sempre cai na regra interna — que é
 * justamente a que interessa.
 */
function regras(arquivo) {
  const css = readFileSync(arquivo, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [
    m[1].trim().replace(/\s+/g, " "),
    m[2],
  ]);
}

// Uma leitura da folha para os dois testes: parsear 55 KB duas vezes
// para responder duas perguntas sobre o mesmo arquivo é trabalho jogado
// fora.
const REGRAS = regras(CSS);

const ENCOLHIDO = /grid-column:\s*1\s*\/\s*span\s+8/;
/** Linha explícita: `grid-row: N` ou `grid-column: N / …` com número. */
const LINHA_FIXA = /grid-row:\s*\d|grid-column:\s*\d/;

test("os cartões da home não têm posição fixa: só largura, e só com .lado", () => {
  const achadas = [];
  for (const [sel, decls] of REGRAS) {
    if (!sel.includes("pg-home") || !/\.(herosteps|vpanel)\b/.test(sel)) continue;
    // só as regras que falam do CARTÃO, não dos filhos dele
    if (!/> \.(herosteps|vpanel)$/.test(sel)) continue;
    assert.doesNotMatch(
      decls,
      LINHA_FIXA,
      `"${sel}" fixa linha ou coluna. Com posição absoluta, um herói que ` +
        `volte a ter 12 colunas deixa o cartão POR CIMA dele — foi assim ` +
        `duas vezes. Use só \`grid-column: span 4\` e deixe o auto-placement ` +
        `achar a vaga.`
    );
    if (/grid-column:\s*span\s+4/.test(decls)) {
      achadas.push(sel);
      assert.match(sel, /\.pg-home\.lado\b/, `"${sel}" estreita o cartão sem exigir .lado`);
    }
  }
  // Sem esta verificação o teste passaria sozinho no dia em que o
  // seletor mudasse de nome: zero regras examinadas, zero falhas.
  const alvos = achadas.join(" ");
  for (const cartao of [".herosteps", ".vpanel"]) {
    assert.ok(
      alvos.includes(cartao),
      `nenhuma regra com .lado dá span 4 a ${cartao} — ou o cartão sumiu, ` +
        `ou mudou de nome, ou voltou a ser posicionado por fora`
    );
  }
});

test("o herói é o único filho da home com linha fixa, e o cartão vem logo depois dele", () => {
  const fixos = REGRAS.filter(
    ([sel, decls]) => /\.pg-home(\.lado)? > \S+$/.test(sel) && /grid-row:\s*\d/.test(decls)
  ).map(([sel]) => sel);
  assert.deepEqual(fixos, [".pg-home > .homehero"]);

  // O auto-placement põe o cartão na primeira vaga DEPOIS do herói na
  // ordem do DOM. Se algo de largura total entrar entre os dois, a vaga
  // da linha 1 é pulada e o cartão desce.
  // comentários JSX entre os dois não contam como elemento
  const src = readFileSync(PAGE, "utf-8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.match(
    src,
    /<\/section>\s*\{\s*cartao\s*\}/,
    "o cartão tem de ser renderizado imediatamente depois do </section> do herói"
  );
});

test("o herói só encolhe para 8 colunas com a mesma classe .lado", () => {
  const encolhe = REGRAS.filter(
    ([sel, decls]) => sel.includes("homehero") && ENCOLHIDO.test(decls)
  );
  assert.equal(encolhe.length, 1, "deveria haver uma única regra encolhendo o herói");
  assert.match(
    encolhe[0][0],
    /\.pg-home\.lado\b/,
    "encolher o herói e posicionar o cartão têm de depender da MESMA condição"
  );
});

test("a classe .lado sai do cartão, e não de um segundo juízo sobre o crew", () => {
  const src = readFileSync(PAGE, "utf-8");

  /* O que importa é a IDENTIDADE, não a grafia: seja qual for o nome da
     variável, o valor que decide a classe tem de ser o mesmo valor que
     é renderizado. Casar o texto exato da linha faria um `prettier` ou
     um rename derrubar um teste sobre grade de layout — e o defeito
     que ele guarda não tem nada a ver com isso. */
  const monta = /className=\{`pg-home\$\{\s*([A-Za-z_$][\w$]*)\s*\?/.exec(src);
  assert.ok(
    monta,
    "a classe da home deve sair de um único valor (`pg-home${<valor> ? \" lado\" : \"\"}`). " +
      "O que não pode voltar é a classe nascer de uma condição própria " +
      '(era `!crew || crew.kind === "vessel"`), que discorda do render em silêncio'
  );
  const valor = monta[1];
  assert.match(
    src,
    new RegExp(`\\{\\s*${valor}\\s*\\}`),
    `\`${valor}\` decide a classe, então é ele que tem de ser renderizado — ` +
      `se o render vier de outra expressão, os dois voltam a poder discordar`
  );

  // Os dois `&&` antigos não podem voltar: eram a segunda decisão.
  assert.doesNotMatch(
    src,
    /\{\s*!crew\s*&&\s*<HeroSteps/,
    "HeroSteps voltou a ser renderizado por condição própria, fora de `cartao`"
  );
  assert.doesNotMatch(
    src,
    /\{\s*crew\?\.kind === "vessel"\s*&&\s*\(?\s*<VesselPanel/,
    "VesselPanel voltou a ser renderizado por condição própria, fora de `cartao`"
  );
});
