#!/usr/bin/env node
/**
 * IMO, MMSI e bandeira dos navios — ouvindo o AIS ao redor de Santos.
 *
 * O line-up da CODESP dá o nome do navio, nunca o IMO. Todo navio
 * mercante transmite por AIS, a cada 6 minutos, uma mensagem "estática"
 * com nome, IMO, MMSI, destino e ETA. O aisstream.io repassa esse feed
 * de graça (WebSocket, chave gratuita criada com login do GitHub em
 * https://aisstream.io). Este roteiro fica alguns minutos ouvindo a
 * caixa que cobre o porto, o fundeadouro e a aproximação de Santos, e
 * preenche o que falta nos navios do banco casando pelo nome.
 *
 * Só preenche o que está VAZIO (imo, mmsi, flag): o que a tripulação ou
 * o staff já corrigiu vale mais. Com IMO no banco, scripts/fotos-navios
 * passa a achar a foto no Commons por número, não por nome.
 *
 *   AISSTREAM_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/ais-santos.mjs [--minutos 8] [--dry]
 *
 * Feito para rodar no GitHub Actions a cada poucas horas: o feed exige
 * conexão de servidor (a chave não pode ir ao navegador), e uma função
 * da Vercel não fica 8 minutos aberta.
 */
const KEY_AIS = process.env.AISSTREAM_API_KEY;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://cuaocjxofaizefzcxlyc.supabase.co";
const KEY_DB = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const MINUTOS = Number(args[args.indexOf("--minutos") + 1]) || 8;

if (!KEY_AIS || !KEY_DB) {
  console.error("Faltam AISSTREAM_API_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

/* Santos e arredores: do canal de Bertioga a Peruíbe, e ~60 milhas mar
   adentro — cobre o fundeadouro e quem está chegando. [[lat, lon], [lat, lon]] */
const CAIXA = [[-25.2, -47.4], [-23.5, -45.4]];

/** MID (3 primeiros dígitos do MMSI) → bandeira ISO. Só as que passam por aqui. */
const MID = {
  201: "AL", 203: "AT", 205: "BE", 207: "BG", 209: "CY", 210: "CY", 211: "DE", 212: "CY",
  215: "MT", 218: "DE", 219: "DK", 220: "DK", 224: "ES", 225: "ES", 226: "FR", 227: "FR",
  228: "FR", 229: "MT", 230: "FI", 231: "FO", 232: "GB", 233: "GB", 234: "GB", 235: "GB",
  236: "GI", 237: "GR", 238: "HR", 239: "GR", 240: "GR", 241: "GR", 242: "MA", 243: "HU",
  244: "NL", 245: "NL", 246: "NL", 247: "IT", 248: "MT", 249: "MT", 250: "IE", 251: "IS",
  252: "LI", 253: "LU", 254: "MC", 255: "PT", 256: "MT", 257: "NO", 258: "NO", 259: "NO",
  261: "PL", 263: "PT", 264: "RO", 265: "SE", 266: "SE", 267: "SK", 268: "SM", 269: "CH",
  271: "TR", 272: "UA", 273: "RU", 274: "MK", 275: "LV", 276: "EE", 277: "LT", 278: "SI",
  279: "RS", 301: "AI", 303: "US", 304: "AG", 305: "AG", 306: "CW", 307: "AW", 308: "BS",
  309: "BS", 310: "BM", 311: "BS", 312: "BZ", 314: "BB", 316: "CA", 319: "KY", 321: "CR",
  323: "CU", 325: "DM", 327: "DO", 329: "GP", 330: "GD", 331: "GL", 332: "GT", 334: "HN",
  336: "HT", 338: "US", 339: "JM", 341: "KN", 343: "LC", 345: "MX", 347: "MQ", 348: "MS",
  350: "NI", 351: "PA", 352: "PA", 353: "PA", 354: "PA", 355: "PA", 356: "PA", 357: "PA",
  358: "PR", 359: "SV", 361: "PM", 362: "TT", 364: "TC", 366: "US", 367: "US", 368: "US",
  369: "US", 370: "PA", 371: "PA", 372: "PA", 373: "PA", 374: "PA", 375: "VC", 376: "VC",
  377: "VC", 378: "VG", 379: "VI", 401: "AF", 403: "SA", 405: "BD", 408: "BH", 410: "BT",
  412: "CN", 413: "CN", 414: "CN", 416: "TW", 417: "LK", 419: "IN", 422: "IR", 423: "AZ",
  425: "IQ", 428: "IL", 431: "JP", 432: "JP", 434: "TM", 436: "KZ", 437: "UZ", 438: "JO",
  440: "KR", 441: "KR", 443: "PS", 445: "KP", 447: "KW", 450: "LB", 451: "KG", 453: "MO",
  455: "MV", 457: "MN", 459: "NP", 461: "OM", 463: "PK", 466: "QA", 468: "SY", 470: "AE",
  471: "AE", 472: "TJ", 473: "YE", 475: "YE", 477: "HK", 478: "BA", 501: "AQ", 503: "AU",
  506: "MM", 508: "BN", 510: "FM", 511: "PW", 512: "NZ", 514: "KH", 515: "KH", 516: "CX",
  518: "CK", 520: "FJ", 523: "CC", 525: "ID", 529: "KI", 531: "LA", 533: "MY", 536: "MP",
  538: "MH", 540: "NC", 542: "NU", 544: "NR", 546: "PF", 548: "PH", 553: "PG", 555: "PN",
  557: "SB", 559: "AS", 561: "WS", 563: "SG", 564: "SG", 565: "SG", 566: "SG", 567: "TH",
  570: "TO", 572: "TV", 574: "VN", 576: "VU", 577: "VU", 578: "WF", 601: "ZA", 603: "AO",
  605: "DZ", 607: "TF", 608: "IO", 609: "BI", 610: "BJ", 611: "BW", 612: "CF", 613: "CM",
  615: "CG", 616: "KM", 617: "CV", 618: "AQ", 619: "CI", 620: "KM", 621: "DJ", 622: "EG",
  624: "ET", 625: "ER", 626: "GA", 627: "GH", 629: "GM", 630: "GW", 631: "GQ", 632: "GN",
  633: "BF", 634: "KE", 635: "AQ", 636: "LR", 637: "LR", 638: "SS", 642: "LY", 644: "LS",
  645: "MU", 647: "MG", 649: "ML", 650: "MZ", 654: "MR", 655: "MW", 656: "NE", 657: "NG",
  659: "NA", 660: "RE", 661: "RW", 662: "SD", 663: "SN", 664: "SC", 665: "SH", 666: "SO",
  667: "SL", 668: "ST", 669: "SZ", 670: "TD", 671: "TG", 672: "TN", 674: "TZ", 675: "UG",
  676: "CD", 677: "TZ", 678: "ZM", 679: "ZW", 701: "AR", 710: "BR", 720: "BO", 725: "CL",
  730: "CO", 735: "EC", 740: "FK", 745: "GF", 750: "GY", 755: "PY", 760: "PE", 765: "SR",
  770: "UY", 775: "VE",
};

const chave = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const cab = { apikey: KEY_DB, Authorization: `Bearer ${KEY_DB}`, "Content-Type": "application/json" };

// Navios do banco que ainda têm algo a preencher, indexados pelo nome.
const r = await fetch(`${SUPABASE_URL}/rest/v1/ships?select=id,name,imo,mmsi,flag&hidden_at=is.null&or=(imo.is.null,mmsi.is.null,flag.is.null)`, { headers: cab });
if (!r.ok) throw new Error(`ships ${r.status}: ${await r.text()}`);
const porNome = new Map();
for (const s of await r.json()) porNome.set(chave(s.name), s);
console.log(`${porNome.size} navio(s) com IMO, MMSI ou bandeira em branco; ouvindo ${MINUTOS} min…`);

const vistos = new Map(); // mmsi → {nome, imo, destino}
const fim = Date.now() + MINUTOS * 60_000;

/* O aisstream derruba a conexão de vez em quando (code 1006, sem motivo).
   Enquanto houver tempo, reconecta; o que já foi ouvido fica no mapa. */
function ouvir() {
  return new Promise((res) => {
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ APIKey: KEY_AIS, BoundingBoxes: [CAIXA], FilterMessageTypes: ["ShipStaticData"] }));
    });
    ws.addEventListener("message", async (ev) => {
      try {
        // O Node entrega o quadro como Blob; só o navegador dá string direto.
        const texto = typeof ev.data === "string" ? ev.data : await ev.data.text();
        const m = JSON.parse(texto);
        if (m.error) { console.error("aisstream:", m.error); ws.close(); return; }
        const d = m.Message?.ShipStaticData;
        if (!d) return;
        const mmsi = String(d.UserID ?? m.MetaData?.MMSI ?? "");
        const imo = d.ImoNumber && d.ImoNumber > 1000000 ? String(d.ImoNumber) : null;
        const nome = (d.Name ?? m.MetaData?.ShipName ?? "").trim();
        if (!mmsi || !nome) return;
        vistos.set(mmsi, { nome, imo, destino: (d.Destination ?? "").trim() });
      } catch {}
    });
    ws.addEventListener("error", () => {});
    ws.addEventListener("close", () => res());
    const resta = fim - Date.now();
    setTimeout(() => { try { ws.close(); } catch {} }, Math.max(0, resta));
  });
}
while (Date.now() < fim - 5_000) {
  await ouvir();
  if (Date.now() < fim - 5_000) await new Promise((r) => setTimeout(r, 2_000));
}

let casados = 0, gravados = 0;
for (const [mmsi, v] of vistos) {
  const s = porNome.get(chave(v.nome));
  if (!s) continue;
  casados++;
  const campos = {};
  if (!s.imo && v.imo) campos.imo = v.imo;
  if (!s.mmsi) campos.mmsi = mmsi;
  if (!s.flag && MID[Number(mmsi.slice(0, 3))]) campos.flag = MID[Number(mmsi.slice(0, 3))];
  if (!Object.keys(campos).length) continue;
  console.log(`${s.name.padEnd(26)} ${JSON.stringify(campos)}${v.destino ? `  → ${v.destino}` : ""}`);
  if (DRY) continue;
  const p = await fetch(`${SUPABASE_URL}/rest/v1/ships?id=eq.${s.id}`, { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" }, body: JSON.stringify(campos) });
  if (p.ok) gravados++;
  else console.log(`   falhou (${p.status}): ${(await p.text()).slice(0, 120)}`); // IMO já de outro casco, p.ex.
}
console.log(`\nnavios ouvidos: ${vistos.size}   casados com o banco: ${casados}   gravados: ${gravados}`);
