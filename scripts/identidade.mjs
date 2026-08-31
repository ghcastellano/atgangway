/**
 * Gera os ativos rasterizados da identidade At Gangway a partir do
 * mesmo desenho do mark (components/Icon.tsx / app/icon.svg):
 *
 *   app/apple-icon.png  — 180×180, o tile do favicon em PNG (iOS ignora
 *                         SVG; sem este arquivo o atalho vira screenshot)
 *   public/og.png       — 1200×630, o cartão de WhatsApp/Instagram; o
 *                         link do Captain viaja colado em grupo de
 *                         tripulação, e link sem imagem lê como suspeito
 *
 * Roda com `node scripts/identidade.mjs`. O sharp já vem com o Next.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const NAVY = "#040D1A";
const AMBER = "#FFB648";
const INK = "#F2ECDF";
const MUTED = "#B9C4D6";
const FAINT = "#7E8FA6";

/** O mark completo (o mesmo path do IconAnchor): casco atracado com
 *  escotilhas, prancha de embarque com degraus pousando no cais, o
 *  pacote esperando, e o vão cais/água embaixo. */
const MARK =
  "M9.2 3.8H21.7L19.4 7.9H10.3ZM12.3 5.9h.01M14.9 5.9h.01M17.5 5.9h.01M10.3 7.9 2.6 19.9M11.98 8.98 4.28 20.98M7.99 11.5 9.67 12.58M6.07 14.5 7.75 15.58M4.14 17.5 5.82 18.58M7.7 18h3.1v3.2H7.7ZM9.25 18v3.2M2 21.2h9.8M14 21.2h8M15.8 19.3h3.4";

/** Tile 100×100 (o mesmo do app/icon.svg, versão simplificada p/ tamanho pequeno). */
const TILE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${NAVY}"/>
  <g transform="translate(14 14) scale(3)" fill="none" stroke="${AMBER}" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.2 3.8H21.7L19.4 7.9H10.3ZM10.3 7.9 2.6 19.9M11.98 8.98 4.28 20.98M7.37 12.46 9.05 13.54M5.06 16.06 6.74 17.14M7.7 18h3.1v3.2H7.7ZM2 21.2h9.8M14 21.2h8"/>
  </g>
</svg>`;

/** Cartão OG 1200×630: mark grande à esquerda (traço fino — em tamanho
 *  grande os dois corrimãos da prancha se separam e o desenho respira),
 *  wordmark e promessa à direita, tudo preso à margem de 1136. */
const OG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${NAVY}"/>
  <path d="M64 584H520M600 584H1136" stroke="#132132" stroke-width="2"/>
  <g transform="translate(88 120) scale(13)" fill="none" stroke="${AMBER}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="${MARK}"/>
  </g>
  <g font-family="DejaVu Sans, Arial, sans-serif">
    <text x="470" y="178" font-family="DejaVu Sans Mono, monospace" font-size="22" letter-spacing="5" fill="${AMBER}">PORTO DE SANTOS · SHIP SUPPLY</text>
    <text x="466" y="290" font-size="100" font-weight="bold" fill="${INK}">At Gangway</text>
    <path d="M472 326h96" stroke="${AMBER}" stroke-width="6" stroke-linecap="round"/>
    <text x="470" y="398" font-size="34" fill="${MUTED}">Supplies delivered at your gangway.</text>
    <text x="470" y="448" font-family="DejaVu Sans Mono, monospace" font-size="21" fill="${FAINT}">Pre-order before docking · 30% deposit</text>
    <text x="470" y="482" font-family="DejaVu Sans Mono, monospace" font-size="21" fill="${FAINT}">Balance paid at the gangway</text>
    <text x="470" y="552" font-family="DejaVu Sans Mono, monospace" font-size="27" fill="${AMBER}">atgangway.com</text>
  </g>
</svg>`;

const apple = await sharp(Buffer.from(TILE)).resize(180, 180).png().toBuffer();
await writeFile(new URL("../app/apple-icon.png", import.meta.url), apple);
console.log("app/apple-icon.png", apple.length, "bytes");

const og = await sharp(Buffer.from(OG)).png().toBuffer();
await writeFile(new URL("../public/og.png", import.meta.url), og);
console.log("public/og.png", og.length, "bytes");
