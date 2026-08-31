/**
 * Line-up do Porto de Santos — busca e interpretação.
 *
 * Fonte primária: a página oficial de programação de navios da CODESP
 * (intranet.portodesantos.com.br). Três armadilhas reais dela, todas
 * tratadas aqui e cobertas por teste:
 *   1. HTML em latin-1 (acentos viram lixo se decodificar como UTF-8);
 *   2. tabela de ASP clássico SEM </tr> — não dá para casar <tr>…</tr>;
 *   3. datas em M/D/YYYY (formato americano), não dd/mm.
 *
 * A lista traz também rebocadores e embarcações da própria autoridade
 * portuária; filtramos para navios mercantes, que é quem tem tripulação
 * cliente. O desenho é plugável: outra fonte (AIS, API paga) entra sem
 * tocar no resto do app.
 */

export type LineupRow = {
  name: string;
  eta: string; // ISO
  berth?: string | null;
  imo?: string | null;
  voyage?: string | null;
  flag?: string | null;
  agency?: string | null;
};

/** Janela de logística: 3 dias entre o fechamento e a atracação. */
export const DEFAULT_CUTOFF_HOURS = 72;

export const LINEUP_SOURCES = [
  "https://intranet.portodesantos.com.br/Navios/Navios4.asp",
  "https://vports.com.br/navios-esperados/",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Busca o HTML respeitando o charset declarado (a CODESP serve latin-1). */
export async function fetchLineupHtml(
  url: string,
  timeoutMs = 25000
): Promise<{ ok: boolean; status: number; html: string; charset?: string; error?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
    });
    const buf = await res.arrayBuffer();
    const declared = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1];
    // sniff no <meta> quando o header não diz
    const ascii = new TextDecoder("ascii").decode(buf.slice(0, 2048));
    const meta = ascii.match(/charset=["']?([\w-]+)/i)?.[1];
    const charset = (declared || meta || "utf-8").toLowerCase();
    const enc = /8859|latin|windows-1252|cp1252/.test(charset) ? "windows-1252" : "utf-8";
    let html = new TextDecoder(enc).decode(buf);
    // A CODESP às vezes DECLARA utf-8 e serve latin-1 mesmo assim. O
    // sintoma é U+FFFD no lugar de cada acento — foi assim que JATOBÁ
    // virou "JATOB�" no line-up e ficou seis navios com nome quebrado
    // na fila de revisão. Byte de latin-1 nunca produz U+FFFD ao ser
    // decodificado como windows-1252, então o fallback é seguro: se o
    // utf-8 produziu caractere de substituição, a declaração mentiu.
    if (enc === "utf-8" && html.includes("\uFFFD")) {
      html = new TextDecoder("windows-1252").decode(buf);
    }
    return { ok: res.ok, status: res.status, html, charset: enc };
  } catch (e) {
    return { ok: false, status: 0, html: "", error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Divide por <tr sem exigir </tr> — tabelas de ASP clássico raramente
 * fecham as tags. Mesma tolerância para as células.
 */
export function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  const chunks = html.split(/<tr[^>]*>/i).slice(1);
  for (const raw of chunks) {
    const chunk = raw.split(/<\/table>/i)[0];
    const cells: string[] = [];
    for (const m of chunk.matchAll(
      /<t[dh][^>]*>([\s\S]*?)(?=<t[dh][^>]*>|<\/tr>|<tr[^>]*>|<\/table>|$)/gi
    )) {
      const v = stripTags(m[1]);
      if (v) cells.push(v);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/**
 * Datas do line-up. A CODESP usa M/D/YYYY; outras fontes brasileiras
 * usam dd/mm/yyyy. Desambiguamos pelo valor: se o primeiro número for
 * > 12 só pode ser dia.
 */
export function parseDate(raw: string, hint?: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT]+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, aRaw, bRaw, y, h, mi] = m;
  let month = Number(aRaw);
  let day = Number(bRaw);
  if (month > 12) [day, month] = [month, day]; // era dd/mm
  if (month > 12 || day > 31 || month < 1 || day < 1) return null;

  // hora pode vir na mesma célula ou numa coluna separada
  const t = (h ? `${h}:${mi}` : hint?.match(/^(\d{1,2}):(\d{2})$/)?.[0]) ?? "12:00";
  const [hh, mm] = t.split(":");
  const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hh.padStart(
    2,
    "0"
  )}:${mm}:00-03:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * O nome do navio vem colado ao calado ("SHAMAL 10 5" = SHAMAL, 10,5m).
 * Removemos os grupos numéricos finais sem comer nomes que terminam em
 * número legítimo (ex.: "MSC LORENA II" fica intacto).
 */
export function cleanShipName(raw: string): string {
  return raw
    .replace(/[,;]+/g, " ")
    .replace(/(\s+\d{1,3}(?:[.,]\d+)?)+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}

// Embarcações da autoridade portuária / apoio: não têm tripulação cliente.
const NON_MERCHANT = /^(CODESP|MARINHA|PRATICAGEM|DOCAS|SANTOS PILOTS)$/i;

/** Parser da programação da CODESP (fonte primária). */
export function parseCodesp(html: string): { rows: LineupRow[]; note: string } {
  const all = tableRows(html);
  if (!all.length) return { rows: [], note: "nenhuma tabela encontrada" };

  const out: LineupRow[] = [];
  for (const cells of all) {
    if (cells.length < 4) continue;
    // [#, NAVIO+calado, NACIONALIDADE, DATA, (HORA), VIAGEM, AGENCIA, ...]
    const dateIdx = cells.findIndex((c) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(c));
    if (dateIdx < 2) continue;

    const eta = parseDate(cells[dateIdx], cells[dateIdx + 1]);
    if (!eta) continue;

    const name = cleanShipName(cells[dateIdx - 2] ?? "");
    const flag = cells[dateIdx - 1]?.trim() || null;
    if (name.length < 3 || name.length > 60) continue;
    if (/^(NAVIO|VESSEL)/i.test(name)) continue; // cabeçalho

    const agency = cells.slice(dateIdx + 1).find((c) => /AGENCIA|AGENCY|SHIPPING/i.test(c)) ?? null;
    const rest = cells.slice(dateIdx + 1).join(" ");
    if (NON_MERCHANT.test((agency ?? "").trim()) || /\bCODESP\b/.test(rest)) continue;

    out.push({ name, eta, flag, agency, berth: null, imo: null, voyage: null });
  }

  const seen = new Set<string>();
  const rows = out.filter((r) => {
    const k = `${r.name}|${r.eta.slice(0, 10)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { rows, note: `CODESP: ${all.length} linhas brutas → ${rows.length} navios mercantes` };
}

/** Fallback genérico: qualquer tabela com nome + data. */
export function parseGeneric(html: string): { rows: LineupRow[]; note: string } {
  const all = tableRows(html);
  if (!all.length) return { rows: [], note: "nenhuma tabela encontrada" };

  const out: LineupRow[] = [];
  for (const cells of all) {
    const dateCell = cells.find((c) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(c));
    if (!dateCell) continue;
    const eta = parseDate(dateCell);
    if (!eta) continue;
    const nameCell = cells
      .filter((c) => c !== dateCell && /[A-Za-zÀ-ÿ]{3,}/.test(c) && !/^\d+$/.test(c))
      .sort((a, b) => b.length - a.length)[0];
    if (!nameCell) continue;
    const name = cleanShipName(nameCell);
    if (name.length < 3 || name.length > 60) continue;
    out.push({ name, eta, berth: null, imo: null, voyage: null });
  }

  const seen = new Set<string>();
  const rows = out.filter((r) => {
    const k = `${r.name}|${r.eta.slice(0, 10)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { rows, note: `genérico: ${rows.length} linhas` };
}

export function parseLineup(html: string, url = ""): { rows: LineupRow[]; note: string } {
  if (/portodesantos/i.test(url)) {
    const codesp = parseCodesp(html);
    if (codesp.rows.length) return codesp;
  }
  return parseGeneric(html);
}
