// IMO, MMSI e bandeira dos navios — ouvindo o AIS ao redor de Santos.
//
// O line-up da CODESP dá o nome do navio, nunca o IMO. Todo navio
// mercante transmite por AIS, a cada 6 minutos, uma mensagem "estática"
// com nome, IMO, MMSI e destino. O aisstream.io repassa esse feed de
// graça (WebSocket; a chave fica no segredo AISSTREAM_API_KEY da função).
//
// Mora aqui, e não no GitHub Actions, por custo: a função roda dentro
// do plano Free do Supabase (500 mil invocações/mês), é disparada pelo
// pg_cron que já agenda o line-up, e não gasta minuto nenhum do GitHub
// nem passa pela Vercel. Responde 202 na hora e ouve em segundo plano
// (EdgeRuntime.waitUntil) por ~100 s — abaixo do teto de 150 s do Free.
//
// Só preenche o que está VAZIO (imo, mmsi, flag): o que a tripulação ou
// o staff corrigiu vale mais. Com IMO no banco, scripts/fotos-navios
// acha a foto no Commons por número, não por nome.
//
// Quem chama prova que sabe o segredo do cron (is_cron_secret, o mesmo
// portão das rotas de cron da Vercel).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY_AIS = Deno.env.get("AISSTREAM_API_KEY") ?? "";
const ESCUTA_MS = 100_000;

/* Santos e arredores: do canal de Bertioga a Peruíbe, e ~60 milhas mar
   adentro — cobre o fundeadouro e quem está chegando. [[lat, lon], [lat, lon]] */
const CAIXA = [[-25.2, -47.4], [-23.5, -45.4]];

/** MID (3 primeiros dígitos do MMSI) → bandeira ISO. */
const MID: Record<number, string> = {
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

type Navio = { id: string; name: string; imo: string | null; mmsi: string | null; flag: string | null };
type Visto = { nome: string; imo: string | null; destino: string };

const cab = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const chave = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

async function souCron(req: Request): Promise<boolean> {
  const dado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (dado.length < 10) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_cron_secret`, {
    method: "POST", headers: cab, body: JSON.stringify({ p_secret: dado }),
  });
  return r.ok && (await r.json()) === true;
}

/** Ouve o feed até o prazo; reconecta se o aisstream derrubar (faz isso sem motivo). */
async function ouvir(prazo: number): Promise<Map<string, Visto>> {
  const vistos = new Map<string, Visto>();
  while (Date.now() < prazo - 5_000) {
    await new Promise<void>((res) => {
      const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
      ws.onopen = () =>
        ws.send(JSON.stringify({ APIKey: KEY_AIS, BoundingBoxes: [CAIXA], FilterMessageTypes: ["ShipStaticData"] }));
      ws.onmessage = async (ev) => {
        try {
          const texto = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
          const m = JSON.parse(texto);
          if (m.error) { console.error("aisstream:", m.error); ws.close(); return; }
          const d = m.Message?.ShipStaticData;
          if (!d) return;
          const mmsi = String(d.UserID ?? m.MetaData?.MMSI ?? "");
          const imo = d.ImoNumber && d.ImoNumber > 1000000 ? String(d.ImoNumber) : null;
          const nome = String(d.Name ?? m.MetaData?.ShipName ?? "").trim();
          if (mmsi && nome) vistos.set(mmsi, { nome, imo, destino: String(d.Destination ?? "").trim() });
        } catch { /* quadro torto não derruba a escuta */ }
      };
      ws.onerror = () => {};
      ws.onclose = () => res();
      setTimeout(() => { try { ws.close(); } catch { /* já fechado */ } }, Math.max(0, prazo - Date.now()));
    });
    if (Date.now() < prazo - 5_000) await new Promise((r) => setTimeout(r, 2_000));
  }
  return vistos;
}

async function trabalhar() {
  const inicio = Date.now();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/ships?select=id,name,imo,mmsi,flag&hidden_at=is.null&or=(imo.is.null,mmsi.is.null,flag.is.null)`,
    { headers: cab },
  );
  if (!r.ok) { console.error("ships", r.status, await r.text()); return; }
  const porNome = new Map<string, Navio>();
  for (const s of (await r.json()) as Navio[]) porNome.set(chave(s.name), s);

  const vistos = await ouvir(inicio + ESCUTA_MS);

  let casados = 0, gravados = 0;
  for (const [mmsi, v] of vistos) {
    const s = porNome.get(chave(v.nome));
    if (!s) continue;
    casados++;
    const campos: Record<string, string> = {};
    if (!s.imo && v.imo) campos.imo = v.imo;
    if (!s.mmsi) campos.mmsi = mmsi;
    const bandeira = MID[Number(mmsi.slice(0, 3))];
    if (!s.flag && bandeira) campos.flag = bandeira;
    if (!Object.keys(campos).length) continue;
    const p = await fetch(`${SUPABASE_URL}/rest/v1/ships?id=eq.${s.id}`, {
      method: "PATCH", headers: { ...cab, Prefer: "return=minimal" }, body: JSON.stringify(campos),
    });
    if (p.ok) gravados++;
    else console.warn(s.name, p.status, (await p.text()).slice(0, 120)); // IMO já de outro casco, p.ex.
  }
  console.log(`ais-santos: ouvidos=${vistos.size} casados=${casados} gravados=${gravados} em ${Math.round((Date.now() - inicio) / 1000)}s`);
}

Deno.serve(async (req) => {
  if (!(await souCron(req))) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  if (!KEY_AIS) return new Response(JSON.stringify({ ok: false, reason: "AISSTREAM_API_KEY ausente" }), { status: 503 });
  // Responde já: o pg_net não espera 100 s, e a escuta segue em segundo plano.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime.waitUntil(trabalhar());
  return new Response(JSON.stringify({ ok: true, escutando_s: ESCUTA_MS / 1000 }), {
    status: 202, headers: { "Content-Type": "application/json" },
  });
});
