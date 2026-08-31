/**
 * Arte própria para o que NÃO tem foto de produto de verdade.
 *
 * O catálogo tira foto de duas fontes honestas: Open Food Facts e Open
 * Beauty Facts, casadas pelo código de barras — a foto é do produto que
 * está sendo vendido. Sobram dois casos em que não existe código de
 * barras nenhum para casar:
 *
 *   1. os eSIM (produto digital: não há embalagem para fotografar);
 *   2. os kits (a caixa é nossa, montada aqui — não existe foto dela
 *      em banco nenhum).
 *
 * Para esses, a coleta caiu no Wikimedia Commons e trouxe "foto do
 * assunto", que é o pior tipo de acerto: o eSIM Brasil 20 GB ficou
 * ilustrado com "SIM card Virgin Mobile in Poland.jpg" — o chip de um
 * concorrente, em outro país, na vitrine da loja. Licença em ordem,
 * produto errado.
 *
 * Arte própria resolve as duas pontas: o desenho é nosso (sem crédito
 * a terceiro, sem marca alheia) e diz a verdade — carta de eSIM para o
 * digital, engradado para o kit.
 *
 * Roda com `node scripts/arte-produtos.mjs`; grava em public/produtos/
 * porque foto de catálogo é build, não upload (mesma decisão do
 * imageUrl em lib/catalog.ts). Depois é só apontar product_images.path
 * para /produtos/<arquivo>.jpg.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const NAVY = "#040D1A";
const CARD = "#0B1B30";
const AMBER = "#FFB648";
const INK = "#F2ECDF";
const MUTED = "#9FB4C8";
const BRANCO = "#FFFFFF";

/* O fundo é branco porque TODAS as outras fotos do catálogo vêm em
   fundo branco do Open Food Facts. Arte bonita em fundo escuro no meio
   de uma grade branca não lê como produto, lê como banner. */
const LADO = 1000;

/* ---------------------------------------------------------------- eSIM */

/** Carta de eSIM: mesma geometria e mesma inclinação da arte dos SIM
 *  físicos (public/produtos/SIM-*.jpg), para a prateleira Connectivity
 *  ler como uma família só. O que muda é o contorno tracejado — não há
 *  plástico para receber, e o desenho não deve prometer um. */
const esim = (giga, linha) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
  <rect width="${LADO}" height="${LADO}" fill="${BRANCO}"/>
  <g transform="rotate(-12 500 500)" font-family="DejaVu Sans, Arial, sans-serif">
    <rect x="215" y="330" width="570" height="380" rx="46" fill="${NAVY}"/>
    <rect x="215" y="330" width="570" height="150" rx="46" fill="${CARD}"/>
    <rect x="239" y="354" width="522" height="332" rx="30" fill="none"
          stroke="${AMBER}" stroke-opacity=".45" stroke-width="4" stroke-dasharray="18 14"/>
    <g>
      <rect x="278" y="392" width="128" height="98" rx="16" fill="${AMBER}"/>
      <g stroke="${NAVY}" stroke-width="7" stroke-linecap="round">
        <path d="M278 425h128M278 458h128M320 392v98M364 392v98"/>
      </g>
    </g>
    <text x="752" y="478" text-anchor="end" font-size="82" font-weight="bold" fill="${AMBER}">${giga}</text>
    <text x="278" y="592" font-size="76" font-weight="bold" fill="${INK}">eSIM</text>
    <text x="278" y="650" font-family="DejaVu Sans Mono, monospace" font-size="22"
          fill="${MUTED}">${linha}</text>
  </g>
  <text x="500" y="838" text-anchor="middle" font-family="DejaVu Sans Mono, monospace"
        font-size="27" letter-spacing="7" fill="${NAVY}" fill-opacity=".55">NO PLASTIC · SCAN TO ACTIVATE</text>
</svg>`;

/* ---------------------------------------------------------------- kits */

/** Glifos do assunto, desenhados numa caixa 100×100. Cada kit ganha o
 *  seu — é o que faz o card ser reconhecido a 160px de largura, antes
 *  de qualquer texto ser legível. */
const GLIFO = {
  /* lata, não copo: o kit é "12 assorted cans" — copo prometeria
     serviço de bar, que não é o que se entrega no portaló. */
  drinks: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="31" y="12" width="38" height="76" rx="12"/>
      <path d="M31 28h38M31 72h38"/>
      <path d="M43 44h14"/></g>`,
  snacks: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M28 26h44l6 58a8 8 0 0 1-8 9H30a8 8 0 0 1-8-9Z"/>
      <path d="M28 26l6-10h32l6 10"/><path d="M40 56h20"/></g>`,
  hygiene: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M42 14h16v14H42Z"/>
      <path d="M38 28h24a10 10 0 0 1 10 10v42a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10V38a10 10 0 0 1 10-10Z"/>
      <path d="M28 50h44"/></g>`,
  pharmacy: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 30h60a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8Z"/>
      <path d="M38 30V18h24v12"/><path d="M50 46v28M36 60h28"/></g>`,
  coffee: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 34h48v30a24 24 0 0 1-24 24h0a24 24 0 0 1-24-24Z"/>
      <path d="M70 42h8a12 12 0 0 1 0 24h-8"/>
      <path d="M34 12v10M50 12v10"/></g>`,
  deck: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="50" cy="50" r="20"/>
      <path d="M50 12v10M50 78v10M12 50h10M78 50h10M23 23l7 7M70 70l7 7M77 23l-7 7M30 70l-7 7"/></g>`,
  cables: `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M34 16v22M66 16v22"/>
      <path d="M22 38h56v12a28 28 0 0 1-28 28h0a28 28 0 0 1-28-28Z"/>
      <path d="M50 78v10"/></g>`,
};

/** Engradado de frente, com estêncil. A caixa é NOSSA — montada aqui —
 *  então ela aparece como caixa nossa, e não como foto de um produto
 *  que não existe sozinho. De frente e não em perspectiva porque o
 *  card da vitrine tem ~160px de largura: em isométrico a cinta cruza
 *  o glifo e não sobra nada legível. As ripas horizontais são o que
 *  faz ler "engradado" em vez de "caixa qualquer". */
const kit = (glifo, palavra, linha) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
  <rect width="${LADO}" height="${LADO}" fill="${BRANCO}"/>
  <g>
    <rect x="222" y="196" width="556" height="492" rx="26" fill="${NAVY}"/>
    <rect x="222" y="196" width="556" height="92" rx="26" fill="${CARD}"/>
    <rect x="222" y="262" width="556" height="26" fill="${CARD}"/>
    <g stroke="${INK}" stroke-opacity=".07" stroke-width="3">
      <path d="M246 380h508M246 500h508M246 620h508"/>
    </g>
    <g fill="${AMBER}">
      <rect x="222" y="288" width="18" height="400"/>
      <rect x="760" y="288" width="18" height="400"/>
    </g>
    <g transform="translate(370 300) scale(2.6)" color="${AMBER}">${GLIFO[glifo]}</g>
    <text x="500" y="628" text-anchor="middle" font-family="DejaVu Sans Mono, monospace"
          font-size="24" letter-spacing="4" fill="${AMBER}" fill-opacity=".8">AT GANGWAY · KIT</text>
  </g>
  <g font-family="DejaVu Sans Mono, monospace" text-anchor="middle">
    <text x="500" y="800" font-size="46" font-weight="bold" letter-spacing="10" fill="${NAVY}">${palavra}</text>
    <text x="500" y="852" font-size="25" letter-spacing="2" fill="${NAVY}" fill-opacity=".55">${linha}</text>
  </g>
</svg>`;

/* ------------------------------------------------------------- receita */

const PECAS = [
  ["AG-ESIM-20", esim("20 GB", "BRASIL · 4G/5G · 30 DAYS")],
  ["AG-ESIM-50", esim("50 GB", "BRASIL · 4G/5G · 30 DAYS")],
  ["AG-KIT-DRINKS", kit("drinks", "DRINKS", "12 assorted cans · no alcohol")],
  ["AG-KIT-SNACKS", kit("snacks", "SNACKS", "Chocolate · biscuits · nuts")],
  ["AG-KIT-HYGIENE", kit("hygiene", "HYGIENE", "Shampoo · soap · toothpaste")],
  ["AG-KIT-PHARMACY", kit("pharmacy", "PHARMACY", "Painkillers · plasters · vit. C")],
  ["AG-KIT-COFFEE", kit("coffee", "COFFEE", "500 g ground · filters")],
  ["AG-KIT-DECK", kit("deck", "DECK", "SPF 50 sunscreen · cap")],
  ["AG-KIT-CABLES", kit("cables", "CABLES", "USB-C · Lightning · BR plug")],
];

for (const [nome, svg] of PECAS) {
  // JPEG de fundo branco, como as fotos vindas do Open Food Facts: o
  // next/image reencoda para AVIF/WebP na entrega, então o que importa
  // aqui é o original ser limpo e pequeno.
  const buf = await sharp(Buffer.from(svg)).flatten({ background: BRANCO }).jpeg({ quality: 88, progressive: true }).toBuffer();
  await writeFile(new URL(`../public/produtos/${nome}.jpg`, import.meta.url), buf);
  console.log(`public/produtos/${nome}.jpg`, buf.length, "bytes");
}
