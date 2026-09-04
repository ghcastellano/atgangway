/**
 * Auditoria de contraste NO NAVEGADOR, sobre a página renderizada.
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
 *   node scripts/auditar-contraste.mjs http://127.0.0.1:3000
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
    if (st.visibility === "hidden" || st.display === "none" || parseFloat(st.opacity) < 0.1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const cor = rgba(st.color);
    if (!cor || cor[3] < 0.1) continue;
    const bg = fundo(el);
    // texto translúcido é composto sobre o fundo antes de comparar
    const tinta = cor[3] >= 0.999 ? cor : [
      cor[0] * cor[3] + bg[0] * (1 - cor[3]),
      cor[1] * cor[3] + bg[1] * (1 - cor[3]),
      cor[2] * cor[3] + bg[2] * (1 - cor[3]),
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

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let total = 0;
for (const [larguraNome, w, h] of [["celular", 390, 844], ["desktop", 1440, 900]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage();
  for (const rota of ROTAS) {
    try {
      await pg.goto(BASE + rota, { waitUntil: "networkidle", timeout: 20000 });
    } catch { continue; }
    await pg.waitForTimeout(250);
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
          `  ${String(a.razao).padStart(5)}:1 (min ${a.minimo})  .${a.classe}  ${a.cor} sobre ${a.fundo}  ${a.px}px/${a.peso}  “${a.texto}”`
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
            `  ${String(a.razao).padStart(5)}:1 (min ${a.minimo})  .${a.classe}  ${a.cor} sobre ${a.fundo}  ${a.px}px/${a.peso}  “${a.texto}”`
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
console.log(`\nTOTAL de regras distintas abaixo do AA: ${total}`);
process.exit(total > 0 ? 1 : 0);
