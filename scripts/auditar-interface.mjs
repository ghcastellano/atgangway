/**
 * Auditoria de interface NO NAVEGADOR, sobre a página renderizada.
 *
 * Duas famílias de achado, pela mesma razão: defeito que se vê na tela
 * e não no código.
 *
 *   CONTRASTE — cor computada contra fundo efetivo.
 *   LAYOUT    — texto corrido dentro de um container flex/grid.
 *
 * O teste de cores que já existe (tests/cores.test.mjs) confere pares
 * de TOKENS que eu escolho à mão. Ele é bom e barato, mas só enxerga o
 * que alguém lembrou de listar — e a inversão para o tema claro deixou
 * defeitos exatamente onde ninguém listou: um `var(--ink)` dentro de
 * uma barra escura, um `--muted` sobre tarja preta. O nome do produto
 * na barra de compra da ficha ficou invisível assim, e nenhum teste
 * reclamou.
 *
 * Aqui a medição é a real: para cada texto visível, a cor computada e
 * o fundo EFETIVO (subindo a árvore até achar quem pinta), incluindo a
 * mistura de fundos translúcidos. É o que o olho vê.
 *
 *   node scripts/auditar-interface.mjs http://127.0.0.1:3000
 *
 * Ela também ABRE o que nasce fechado antes de medir. O logotipo da
 * gaveta de categorias ficou ilegível por um dia inteiro — âmbar cheio
 * sobre papel, 2,15:1 — porque a gaveta nasce fechada e nenhuma medição
 * chegava lá. Painel que não se abre é painel que não se testa.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const ROTAS = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/", "/shop", "/c/food-drinks", "/p/esim-brasil-20-gb", "/cart", "/checkout",
     "/ports", "/faq", "/login", "/signup", "/account", "/orders", "/wishlist",
     "/captain", "/brochures", "/terms", "/privacy", "/attributions", "/admin/login"];

const MEDIDOR = () => {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = ([r, g, b]) =>
    0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  const razao = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const rgba = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const n = m[1].split(",").map((v) => parseFloat(v.trim()));
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  };
  /** Fundo efetivo: sobe a árvore compondo camadas translúcidas. */
  const fundo = (el) => {
    let acc = null;
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (!c || c[3] === 0) continue;
      acc = acc === null ? c : [
        acc[0] + (c[0] - acc[0]) * (1 - acc[3]),
        acc[1] + (c[1] - acc[1]) * (1 - acc[3]),
        acc[2] + (c[2] - acc[2]) * (1 - acc[3]),
        acc[3] + c[3] * (1 - acc[3]),
      ];
      if (acc[3] >= 0.999) return acc;
    }
    return acc ?? [255, 255, 255, 1];
  };

  /**
   * Menor opacidade que uma animação impõe ao elemento.
   *
   * A faixa "LAST CALL" — a informação mais urgente da loja — piscava
   * com `@keyframes pulse { 50% { opacity: .35 } }`: parada ela tem
   * 7:1, e metade do tempo ficava em 2,2:1. Uma medição tirada num
   * instante qualquer não vê isso; ou pega o quadro bom, ou pega o
   * ruim e você não sabe por quê.
   *
   * Então em vez de medir mais vezes, lê-se a REGRA: percorre os
   * @keyframes da folha de estilo e pega o menor `opacity` que a
   * animação do elemento declara. O pior quadro passa a ser um número
   * conhecido, não um sorteio.
   */
  const menorOpacidade = (nome) => {
    if (!nome || nome === "none") return 1;
    const nomes = nome.split(",").map((n) => n.trim());
    let menor = 1;
    for (const folha of document.styleSheets) {
      let regras;
      try { regras = folha.cssRules; } catch { continue; }  // folha de outra origem
      for (const r of regras || []) {
        if (r.type !== CSSRule.KEYFRAMES_RULE || !nomes.includes(r.name)) continue;
        for (const q of r.cssRules) {
          const o = parseFloat(q.style.opacity);
          if (Number.isFinite(o)) menor = Math.min(menor, o);
        }
      }
    }
    return menor;
  };

  const achados = [];
  for (const el of document.querySelectorAll("body *")) {
    // só quem tem texto PRÓPRIO: senão o mesmo texto é contado em cada ancestral
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!texto) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;

    // Três isenções, e as três são da própria norma — não atalhos meus:
    //
    //   aria-hidden: conteúdo DECORATIVO. O "›" entre as migalhas é
    //   desenho de separador, não texto; o leitor de tela não o lê e a
    //   1.4.3 não o exige.
    //
    //   desabilitado: a 1.4.3 isenta componente inativo. O "−" do
    //   contador com quantidade 1 é um deles.
    //
    //   invisível de verdade: opacidade efetiva ~0 não é baixo
    //   contraste, é "não está na tela" — quase sempre um painel no
    //   meio da animação de entrada.
    if (el.closest("[aria-hidden='true'], [aria-hidden]")) continue;
    if (el.closest("[disabled], [aria-disabled='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const cor = rgba(st.color);
    if (!cor || cor[3] < 0.1) continue;
    const bg = fundo(el);

    // A opacidade efetiva no PIOR quadro: a do elemento vezes a menor
    // que a animação dele (ou a de qualquer ancestral animado, que
    // apaga o filho junto).
    let opAnim = 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const sa = getComputedStyle(n);
      opAnim *= menorOpacidade(sa.animationName) * (parseFloat(sa.opacity) || 1);
    }
    const alfa = Math.max(0, Math.min(1, cor[3] * opAnim));
    if (alfa < 0.06) continue;   // invisível: ver a isenção acima
    // texto translúcido é composto sobre o fundo antes de comparar
    const tinta = alfa >= 0.999 ? cor : [
      cor[0] * alfa + bg[0] * (1 - alfa),
      cor[1] * alfa + bg[1] * (1 - alfa),
      cor[2] * alfa + bg[2] * (1 - alfa),
    ];
    const px = parseFloat(st.fontSize);
    const peso = parseInt(st.fontWeight, 10) || 400;
    // WCAG "texto grande": >=24px, ou >=18.66px em negrito
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const minimo = grande ? 3 : 4.5;
    const c = razao(tinta.slice(0, 3), bg.slice(0, 3));
    if (c < minimo) {
      achados.push({
        texto: texto.slice(0, 46),
        classe: el.className && typeof el.className === "string" ? el.className.slice(0, 40) : el.tagName,
        cor: st.color, fundo: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})`,
        px, peso, razao: Math.round(c * 100) / 100, minimo,
        // aparece só quando a animação é a culpada, para o relatório
        // não mandar procurar a cor errada
        anim: opAnim < 0.999 ? `${getComputedStyle(el).animationName} → opacity ${Math.round(opAnim * 100)}%` : "",
      });
    }
  }
  return achados;
};

/**
 * Painéis que nascem fechados. Cada um é aberto, medido e fechado —
 * um de cada vez, para o relatório dizer QUAL painel tem o defeito.
 */
const PAINEIS = [
  { nome: "gaveta de categorias", abrir: ".hamb", fechar: ".drawer .iconbtn, .drawer [aria-label*='lose']" },
  { nome: "gaveta do carrinho", abrir: "button[aria-label^='Cart']", fechar: ".minicart [aria-label*='lose']" },
  { nome: "menu da conta", abrir: "button[aria-label='Account menu']", fechar: "button[aria-label='Account menu']" },
];

/**
 * TEXTO CORRIDO DENTRO DE FLEX/GRID.
 *
 * Este achado existe por causa de um bug real e feio: a resposta do FAQ
 * se partia em três colunas — um pedaço da frase, o link numa coluna
 * estreita, o resto da frase noutra. A causa era uma regra do RODAPÉ,
 * `.sunfoot-body span { display: flex }`, escrita para uma fileira de
 * links de uma linha e herdada por uma página que reaproveitou a
 * classe. Flex é em linha por padrão, então cada trecho de texto vira
 * uma coluna anônima.
 *
 * Nenhum teste pegava, e a auditoria de contraste também não: as cores
 * estavam certas. O que estava errado era a CAIXA.
 *
 * Dois padrões, os dois praticamente impossíveis de serem intenção:
 *
 *   texto → elemento → texto   uma frase partida por um <a> ou <b>;
 *   texto com 40+ caracteres   frase inteira virando item de flex.
 *
 * O que NÃO é acusado: ícone + rótulo curto (`<Icon/> Salvar`), que é
 * o motivo legítimo de haver texto solto num container flex.
 */
const MEDIDOR_LAYOUT = () => {
  const achados = [];
  for (const el of document.querySelectorAll("body *")) {
    const st = getComputedStyle(el);
    if (!/^(inline-)?(flex|grid)$/.test(st.display)) continue;
    if (st.visibility === "hidden") continue;

    const filhos = [...el.childNodes];
    const corridos = filhos.filter(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0
    );
    if (corridos.length === 0) continue;

    // frase partida por um elemento: texto, elemento, texto
    const seq = filhos
      .filter((n) => (n.nodeType === 3 ? n.textContent.trim() : n.nodeType === 1))
      .map((n) => (n.nodeType === 3 ? "t" : "e"))
      .join("");
    const partida = /t\s*e\s*t/.test(seq) || seq.includes("tet");
    const longo = corridos.some((n) => n.textContent.trim().length >= 40);
    if (!partida && !longo) continue;

    achados.push({
      classe:
        el.className && typeof el.className === "string"
          ? el.className.slice(0, 40)
          : el.tagName,
      display: st.display,
      direcao: st.flexDirection || "",
      motivo: partida ? "frase partida por elemento" : "frase inteira como item de flex",
      texto: corridos.map((n) => n.textContent.trim()).join(" ").slice(0, 60),
    });
  }
  return achados;
};

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let total = 0;
/** Rotas que não abriram. Ver o porquê disto existir logo abaixo. */
const inacessiveis = [];
for (const [larguraNome, w, h] of [["celular", 390, 844], ["desktop", 1440, 900]]) {
  // AUDIT_STATE=caminho.json (storageState do Playwright) audita a área
  // LOGADA: sem sessão, /account, /orders, /captain e /checkout redirecionam
  // para /login e o que se mede é o login — três vezes.
  const ctx = await nav.newContext({
    viewport: { width: w, height: h },
    ...(process.env.AUDIT_STATE ? { storageState: process.env.AUDIT_STATE } : {}),
  });
  const pg = await ctx.newPage();
  for (const rota of ROTAS) {
    /**
     * Rota que não abre é ERRO, nunca um "pulo" silencioso.
     *
     * Este `catch` engolia a falha e seguia. Rodei a auditoria contra
     * https://atgangway.com, ela respondeu "0 regras abaixo do AA", e
     * eu quase reportei isso como prova — mas o navegador desta caixa
     * não alcança a internet: TODAS as 19 rotas foram puladas em
     * silêncio e o zero era vácuo, não aprovação.
     *
     * Um teste que passa quando não testou nada é pior que teste
     * nenhum, porque dá confiança. Agora ele acumula e reprova no fim.
     */
    try {
      // `domcontentloaded`, e NÃO `networkidle`.
      //
      // Com networkidle, /captain e /account estouravam 20s. Não era a
      // página: era o PREFETCH do App Router. A tela de login tem uma
      // dúzia de <Link> visíveis, o roteador busca a rota de cada um em
      // rajada, e a janela de 500ms sem rede nunca fecha. O teste
      // reprovava por um sinal errado — e antes disso passava em
      // silêncio, que era pior.
      const r = await pg.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 20000 });
      // Fontes e imagens entram depois do DOM e mudam o que se mede.
      await pg.waitForLoadState("load").catch(() => {});
      if (!r || r.status() >= 400) {
        inacessiveis.push(`${rota} (${larguraNome}) → HTTP ${r ? r.status() : "sem resposta"}`);
        continue;
      }
    } catch (e) {
      inacessiveis.push(`${rota} (${larguraNome}) → ${String(e).split("\n")[0].slice(0, 90)}`);
      continue;
    }
    await pg.waitForTimeout(400);
    const achados = await pg.evaluate(MEDIDOR);
    if (achados.length) {
      console.log(`\n### ${rota}  (${larguraNome})`);
      // um por combinação cor/fundo/classe: a mesma regra repetida em
      // trinta linhas de lista é UM defeito, não trinta
      const vistos = new Set();
      for (const a of achados) {
        const k = `${a.cor}|${a.fundo}|${a.classe}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        total++;
        console.log(
          `  ${String(a.razao).padStart(5)}:1 (min ${a.minimo})  .${a.classe}  ${a.cor} sobre ${a.fundo}  ${a.px}px/${a.peso}${a.anim ? "  [" + a.anim + "]" : ""}  “${a.texto}”`
        );
      }
    }

    const layout = await pg.evaluate(MEDIDOR_LAYOUT);
    if (layout.length) {
      console.log(`\n### ${rota}  (${larguraNome})  — LAYOUT`);
      const vistos3 = new Set();
      for (const a of layout) {
        if (vistos3.has(a.classe)) continue;
        vistos3.add(a.classe);
        total++;
        console.log(
          `  texto corrido em display:${a.display}${a.direcao ? " / " + a.direcao : ""}  .${a.classe}  — ${a.motivo}  “${a.texto}”`
        );
      }
    }

    // Os painéis só na vitrine: é onde eles existem, e abrir em toda
    // rota multiplicaria o tempo por três sem achar nada novo.
    if (rota !== "/shop") continue;
    for (const painel of PAINEIS) {
      const gatilho = pg.locator(painel.abrir).first();
      if (!(await gatilho.isVisible().catch(() => false))) continue;
      await gatilho.click().catch(() => {});
      await pg.waitForTimeout(400);
      const dentro = await pg.evaluate(MEDIDOR);
      if (dentro.length) {
        console.log(`\n### ${rota} → ${painel.nome}  (${larguraNome})`);
        const vistos2 = new Set();
        for (const a of dentro) {
          const k = `${a.cor}|${a.fundo}|${a.classe}`;
          if (vistos2.has(k)) continue;
          vistos2.add(k);
          total++;
          console.log(
            `  ${String(a.razao).padStart(5)}:1 (min ${a.minimo})  .${a.classe}  ${a.cor} sobre ${a.fundo}  ${a.px}px/${a.peso}${a.anim ? "  [" + a.anim + "]" : ""}  “${a.texto}”`
          );
        }
      }
      await pg.keyboard.press("Escape").catch(() => {});
      await pg.waitForTimeout(250);
    }
  }
  await ctx.close();
}
await nav.close();

if (inacessiveis.length) {
  console.log(`\n!! ${inacessiveis.length} rota(s) NÃO ABRIRAM — a auditoria não cobriu:`);
  for (const r of inacessiveis) console.log("   " + r);
  console.log(
    "\n   O navegador desta máquina alcança o servidor? Aponte para um\n" +
      "   `next start` local — o artefato é o mesmo do deploy."
  );
}
console.log(`\nTOTAL de achados distintos (contraste + layout): ${total}`);
process.exit(total > 0 || inacessiveis.length > 0 ? 1 : 0);
