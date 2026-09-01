#!/usr/bin/env node
/**
 * Escolhe a MELHOR foto de cada produto, e não a que veio marcada.
 *
 * O colher-fotos-off pega `image_front_url` — a que algum colaborador
 * marcou como "frente". Só que a Open Food Facts guarda TODAS as fotos
 * que já subiram do mesmo código de barras, e a marcada não é a melhor
 * com frequência: a Nesquik tem cinco, sendo duas de 2111×2937, e a
 * loja estava mostrando uma foto sobre bancada amarelada. O mesmo vale
 * para o Leão Fuze (caixa em cima de mesa azul), o Talento (fundo
 * preto) e a água Crystal (garrafa sobre a mesa da cozinha).
 *
 * A régua aqui é a que se mede sem ambiguidade — e é diferente da que
 * lib/fotoqualidade.ts abandonou. Lá a tentativa foi medir a BORDA da
 * foto já recortada, onde a borda é o próprio produto. Aqui as fotos
 * são as ORIGINAIS, sem corte, e nelas o canto é fundo de verdade:
 *
 *   1. os quatro cantos claros (>=240) e parecidos entre si (<12 de
 *      diferença) = pack shot sobre branco;
 *   2. entre as que passam, ganha a de maior área;
 *   3. se nenhuma passa, fica a maior — e o produto entra na lista de
 *      "precisa de foto de verdade", que é uma resposta honesta e não
 *      um fundo cinza fingindo de estúdio.
 *
 * O passo 3 é o ponto: o script não inventa qualidade que não existe.
 * Ele separa o que dá para salvar de graça do que precisa de pack shot
 * do fornecedor.
 *
 *   node --experimental-strip-types scripts/melhor-foto.mjs           # relatório
 *   node --experimental-strip-types scripts/melhor-foto.mjs --gravar  # aplica
 */

import { readdirSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { normalizarFoto } from "../lib/fotonormaliza.ts";

const DESTINO = "public/produtos";
const CACHE = "/tmp/fotos-brutas";
const UA = "AtGangway/1.0 (help@atgangway.com; catalog product images)";
const FOOD = "world.openfoodfacts.org";
const BEAUTY = "world.openbeautyfacts.org";
const GRAVAR = process.argv.includes("--gravar");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Caminho da imagem crua na CDN: 789/100/007/3537/1.jpg
 *
 * A original é `<n>.jpg` e nada mais. `<n>.full.jpg` — que é o sufixo
 * usado nas imagens SELECIONADAS (front_en.19.400.jpg → .full.jpg) —
 * devolve 404 nas cruas, e como o script tratava 404 como "não tem
 * foto", o relatório inteiro saiu dizendo "sem fonte aberta" para 77
 * produtos que têm foto sim. Vale a distinção: as derivadas existem só
 * para as selecionadas; as cruas têm .100 e .400, e o original sem
 * sufixo.
 */
function urlBruta(host, ean, n) {
  const cdn = host === BEAUTY ? "images.openbeautyfacts.org" : "images.openfoodfacts.org";
  const c = ean.length === 13 ? `${ean.slice(0, 3)}/${ean.slice(3, 6)}/${ean.slice(6, 9)}/${ean.slice(9)}` : ean;
  return `https://${cdn}/images/products/${c}/${n}.jpg`;
}

/**
 * A OFF limita por IP, e a primeira versão disto engolia o erro num
 * `catch {}` mudo: 77 consultas em rajada tomaram 429 e o relatório
 * disse "sem fonte aberta" para o catálogo inteiro — uma conclusão
 * inteiramente falsa, e a mais cara de todas porque parecia resposta.
 * Agora o motivo sobe junto, e 429 espera em vez de virar veredito.
 */
async function inventario(ean) {
  let ultimo = "sem resposta";
  for (const host of [FOOD, BEAUTY]) {
    for (let tent = 0; tent < 3; tent++) {
      try {
        const r = await fetch(`https://${host}/api/v2/product/${ean}.json?fields=code,images`, {
          headers: { "User-Agent": UA },
        });
        if (r.status === 429) { ultimo = "429 (limite da OFF)"; await espera(4000 * (tent + 1)); continue; }
        if (!r.ok) { ultimo = `HTTP ${r.status}`; break; }
        const d = await r.json();
        if (d.status !== 1) { ultimo = "não catalogado"; break; }
        const nums = Object.keys(d.product?.images ?? {}).filter((k) => /^\d+$/.test(k));
        if (!nums.length) { ultimo = "catalogado sem foto"; break; }
        return { host, nums: nums.sort((a, b) => Number(a) - Number(b)) };
      } catch (e) {
        ultimo = e.message;
        await espera(1000);
      }
    }
  }
  return { erro: ultimo };
}

/** Média e mínimo de um quadrado de canto — o fundo, na foto original. */
async function canto(buf, w, h, left, top, lado) {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .extract({ left, top, width: lado, height: lado })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let soma = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    soma += (data[i] + data[i + 1] + data[i + 2]) / 3;
    n++;
  }
  return soma / n;
}

async function medir(buf) {
  const m = await sharp(buf, { failOn: "none" }).metadata();
  const w = m.width ?? 0, h = m.height ?? 0;
  if (w < 200 || h < 200) return { w, h, area: w * h, branca: false, min: 0, var: 999 };
  const lado = Math.max(12, Math.round(Math.min(w, h) * 0.1));
  const cs = await Promise.all([
    canto(buf, w, h, 0, 0, lado),
    canto(buf, w, h, w - lado, 0, lado),
    canto(buf, w, h, 0, h - lado, lado),
    canto(buf, w, h, w - lado, h - lado, lado),
  ]);
  const min = Math.min(...cs), spread = Math.max(...cs) - min;
  return { w, h, area: w * h, min: Math.round(min), var: Math.round(spread), branca: min >= 240 && spread < 12 };
}

async function baixa(url, chave) {
  const arq = `${CACHE}/${chave}`;
  if (existsSync(arq)) return readFileSync(arq);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  writeFileSync(arq, b);
  await espera(250);
  return b;
}

mkdirSync(CACHE, { recursive: true });

const eans = readdirSync(DESTINO)
  .filter((f) => /^EAN-\d+\.jpg$/.test(f))
  .map((f) => f.slice(4, -4));

const trocadas = [], mantidas = [], precisamFoto = [], semFonte = [];

for (const ean of eans) {
  const inv = await inventario(ean);
  if (inv.erro) { semFonte.push(`${ean} — ${inv.erro}`); continue; }

  const candidatas = [];
  for (const n of inv.nums.slice(0, 8)) {
    const buf = await baixa(urlBruta(inv.host, ean, n), `${ean}-${n}.bin`);
    if (!buf) continue;
    try { candidatas.push({ n, buf, ...(await medir(buf)) }); } catch {}
  }
  if (!candidatas.length) { semFonte.push(`${ean} — nenhuma imagem baixou`); continue; }

  const brancas = candidatas.filter((c) => c.branca && c.area >= 250_000);
  const escolha = (brancas.length ? brancas : candidatas).sort((a, b) => b.area - a.area)[0];
  const atual = await medir(readFileSync(`${DESTINO}/EAN-${ean}.jpg`));

  const linha = `${ean} ${escolha.w}×${escolha.h} canto=${escolha.min} var=${escolha.var}`;
  if (!brancas.length) {
    precisamFoto.push(`${linha} — nenhuma das ${candidatas.length} está sobre branco`);
  } else if (atual.branca && atual.var <= 12) {
    mantidas.push(linha);
  } else {
    trocadas.push(`${linha} (era canto=${atual.min} var=${atual.var})`);
  }

  // A foto normalizada só é regravada quando há ganho real: trocar uma
  // foto boa por outra boa só muda o enquadramento sem motivo.
  if (GRAVAR && brancas.length && !(atual.branca && atual.var <= 12)) {
    const foto = await normalizarFoto(escolha.buf);
    writeFileSync(`${DESTINO}/EAN-${ean}.jpg`, foto.buffer);
  }
}

console.log(`trocadas ${trocadas.length} | já boas ${mantidas.length} | sem foto de estúdio ${precisamFoto.length} | sem fonte ${semFonte.length}`);
console.log("\n== TROCADAS");
for (const t of trocadas) console.log("  " + t);
console.log("\n== PRECISAM DE PACK SHOT DE VERDADE");
for (const t of precisamFoto) console.log("  " + t);
if (semFonte.length) console.log("\n== SEM FONTE ABERTA\n  " + semFonte.join("\n  "));
if (!GRAVAR) console.log("\n(relatório apenas — rode com --gravar para aplicar)");
