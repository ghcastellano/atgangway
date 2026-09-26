#!/usr/bin/env node
/**
 * Foto, IMO e crédito dos navios — do Wikimedia Commons para o banco.
 *
 * O line-up de Santos publica nome, ETA e berço. Nenhum dos 556 navios
 * do banco tinha foto ou IMO, e o seletor do cadastro mostrava uma
 * lista de nomes secos onde o Sunny mostra o casco. Base mundial com
 * foto custa de €99 a €679 por mês (Datalastic) ou contrato (Kpler /
 * MarineTraffic). O Commons tem foto de licença livre para cerca de
 * um terço dos navios que passam por Santos — e as categorias de lá
 * são indexadas por IMO, o que também preenche o número que faltava.
 *
 * Licença livre exige crédito: fica em ships.image_credit, e a tela
 * mostra junto com a foto.
 *
 * Roda semanal no GitHub Actions (.github/workflows/fotos-navios.yml)
 * e à mão:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/fotos-navios.mjs [--todos] [--limite 50] [--dry]
 *
 * Sem --todos, olha só navios com escala nos últimos 30 dias ou à
 * frente: os que passaram não vão aparecer na busca (a RPC só devolve
 * escala aberta). photo_checked_at evita bater no Commons toda semana
 * pelos mesmos navios que não têm foto lá; volta a tentar em 90 dias.
 *
 * Casamento por NOME, com regra estreita: a categoria tem de ser
 * exatamente "NOME (ship, ANO)". Quando há mais de um casco com o
 * mesmo nome (anos diferentes), a foto é a do mais novo — provável,
 * não certo — e o IMO NÃO é gravado: número errado no índice único
 * bloquearia a tripulação de corrigir pelo "add it" da tela.
 */
import sharp from "sharp";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://cuaocjxofaizefzcxlyc.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";
const UA = "AtGangway/1.0 (https://atgangway.com; help@atgangway.com) fotos-navios";
const REVISITA_DIAS = 90;

const args = process.argv.slice(2);
const TODOS = args.includes("--todos");
const DRY = args.includes("--dry");
const LIMITE = Number(args[args.indexOf("--limite") + 1]) || Infinity;

if (!KEY) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY — o roteiro grava em ships e no storage.");
  process.exit(2);
}

const cab = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function commons(params) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params });
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`commons ${r.status}`);
  await dormir(150);
  return r.json();
}

const chave = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const semTags = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Procura o navio no Commons. Devolve null quando não há categoria com o nome exato. */
async function procurar(nome) {
  const busca = await commons({
    action: "query", list: "search", srnamespace: 14, srlimit: 20,
    srsearch: `intitle:"${nome}" ship`,
  });
  const alvo = chave(nome);
  const re = /^(.+) \(ship,? (\d{4})\)$/i;
  const candidatos = [];
  for (const it of busca.query?.search ?? []) {
    const t = it.title.replace(/^Category:/, "");
    const m = t.match(re);
    if (m && chave(m[1]) === alvo) candidatos.push({ cat: it.title, ano: Number(m[2]) });
  }
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.ano - a.ano);
  const principal = candidatos[0];
  const ambiguo = candidatos.length > 1;

  // IMO: é categoria-mãe ("Category:IMO 9087013")
  const pais = await commons({ action: "query", titles: principal.cat, prop: "categories", cllimit: 100 });
  const listaPais = (Object.values(pais.query?.pages ?? {})[0]?.categories ?? []).map((c) => c.title);
  const imo = listaPais.map((p) => p.match(/^Category:IMO (\d{7})$/)?.[1]).find(Boolean) ?? null;

  // Fotos da categoria (e das subcategorias de primeiro nível, que é onde
  // o Commons costuma guardar "NOME (ship, 2012) in Rotterdam").
  const membros = await commons({
    action: "query", list: "categorymembers", cmtitle: principal.cat, cmlimit: 50, cmtype: "file|subcat",
  });
  let arquivos = (membros.query?.categorymembers ?? []).filter((m) => m.ns === 6).map((m) => m.title);
  const subcats = (membros.query?.categorymembers ?? []).filter((m) => m.ns === 14).map((m) => m.title).slice(0, 4);
  for (const sc of subcats) {
    if (arquivos.length >= 30) break;
    const s = await commons({ action: "query", list: "categorymembers", cmtitle: sc, cmlimit: 20, cmtype: "file" });
    arquivos.push(...(s.query?.categorymembers ?? []).map((m) => m.title));
  }
  arquivos = [...new Set(arquivos)].filter((t) => /\.(jpe?g|png)$/i.test(t)).slice(0, 40);
  if (!arquivos.length) return { ...principal, imo, ambiguo, foto: null };

  const info = await commons({
    action: "query", titles: arquivos.join("|"), prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: 800,
  });
  let melhor = null;
  for (const pg of Object.values(info.query?.pages ?? {})) {
    const ii = pg.imageinfo?.[0];
    if (!ii || !/image\/(jpeg|png)/.test(ii.mime ?? "")) continue;
    const razao = ii.width / ii.height;
    // Paisagem, e grande o bastante para não virar mancha na miniatura.
    if (ii.width < 640 || razao < 1.15 || razao > 2.6) continue;
    const meta = ii.extmetadata ?? {};
    const licenca = meta.LicenseShortName?.value ?? "";
    // Só licença que permite reuso comercial com crédito.
    if (!/^(CC BY|CC BY-SA|CC0|Public domain)/i.test(licenca)) continue;
    const pontos = ii.width * ii.height;
    if (!melhor || pontos > melhor.pontos) {
      melhor = {
        pontos,
        thumb: ii.thumburl,
        pagina: ii.descriptionurl,
        artista: semTags(meta.Artist?.value) || "Wikimedia Commons",
        licenca,
      };
    }
  }
  return { ...principal, imo, ambiguo, foto: melhor };
}

async function listarNavios() {
  const q = new URLSearchParams({
    select: "id,name,imo,flag,image_path,photo_checked_at,eta",
    image_path: "is.null",
    hidden_at: "is.null",
    order: "eta.desc",
  });
  if (!TODOS) q.set("eta", `gte.${new Date(Date.now() - 30 * 864e5).toISOString()}`);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ships?${q}`, { headers: cab });
  if (!r.ok) throw new Error(`ships ${r.status}: ${await r.text()}`);
  const corte = Date.now() - REVISITA_DIAS * 864e5;
  return (await r.json()).filter(
    (s) => !s.photo_checked_at || new Date(s.photo_checked_at).getTime() < corte
  );
}

async function gravar(id, campos) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ships?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify(campos),
  });
  if (r.ok) return true;
  const txt = await r.text();
  // IMO já pertence a outra escala: grava o resto, sem o número.
  if (campos.imo && /23505|duplicate/i.test(txt)) {
    const { imo: _omitido, ...resto } = campos;
    return gravar(id, resto);
  }
  throw new Error(`patch ${r.status}: ${txt.slice(0, 200)}`);
}

async function subirFoto(id, thumbUrl) {
  const r = await fetch(thumbUrl, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const jpg = await sharp(buf).rotate().resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const caminho = `vessels/${id}.jpg`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminho}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true", "Cache-Control": "public, max-age=31536000" },
    body: jpg,
  });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 200)}`);
  return { caminho, bytes: jpg.length };
}

const navios = (await listarNavios()).slice(0, LIMITE);
console.log(`${navios.length} navio(s) sem foto para consultar${DRY ? " (dry-run: não grava)" : ""}\n`);

const resumo = { foto: 0, imo: 0, semCategoria: 0, semFotoBoa: 0, erro: 0 };
for (const s of navios) {
  const agora = new Date().toISOString();
  try {
    const achado = await procurar(s.name);
    if (!achado) {
      resumo.semCategoria++;
      console.log(`--  ${s.name}`);
      if (!DRY) await gravar(s.id, { photo_checked_at: agora });
      continue;
    }
    const campos = { photo_checked_at: agora };
    if (achado.imo && !s.imo && !achado.ambiguo) campos.imo = achado.imo;
    if (achado.foto) {
      if (!DRY) {
        const { caminho } = await subirFoto(s.id, achado.foto.thumb);
        campos.image_path = caminho;
      } else campos.image_path = `vessels/${s.id}.jpg`;
      campos.image_credit = `Photo: ${achado.foto.artista} · ${achado.foto.licenca} · Wikimedia Commons`;
      campos.image_source = achado.foto.pagina;
      resumo.foto++;
    } else resumo.semFotoBoa++;
    if (campos.imo) resumo.imo++;
    if (!DRY) await gravar(s.id, campos);
    console.log(
      `${achado.foto ? "OK " : "cat"} ${s.name.padEnd(26)} ${achado.cat.replace("Category:", "")}` +
        `${campos.imo ? `  IMO ${campos.imo}` : achado.ambiguo ? "  (nome repetido: IMO não gravado)" : ""}` +
        `${achado.foto ? `  ${achado.foto.licenca}` : "  sem foto utilizável"}`
    );
  } catch (e) {
    resumo.erro++;
    console.log(`ERR ${s.name}: ${e.message}`);
  }
}

console.log(
  `\nfotos: ${resumo.foto}   IMO preenchido: ${resumo.imo}   sem categoria: ${resumo.semCategoria}` +
    `   categoria sem foto boa: ${resumo.semFotoBoa}   erros: ${resumo.erro}`
);
if (navios.length && resumo.erro === navios.length) process.exit(1);
