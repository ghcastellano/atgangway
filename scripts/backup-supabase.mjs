#!/usr/bin/env node
/**
 * Backup do Supabase — dados, storage e schema.
 *
 * Existe porque o plano Free não faz backup automático. O schema já está
 * versionado em supabase/migrations/; o que este roteiro salva é o que só
 * existe no banco de produção: as linhas e os arquivos.
 *
 *   node scripts/backup-supabase.mjs                 # salva em ~/atgangway-backups/<data>
 *   node scripts/backup-supabase.mjs --dir /outro    # escolhe onde salvar
 *
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente para alcançar as tabelas
 * protegidas por RLS e o bucket privado dos comprovantes. Sem ela, salva só o
 * que é público e avisa o que ficou de fora — um backup parcial declarado é
 * melhor que um backup completo imaginário.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const URL_BASE =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://cuaocjxofaizefzcxlyc.supabase.co";

const CHAVE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_ia1xhkkK8Pb_gD0Wc8jmXA_71wecTI0";

const TEM_SERVICE = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tabelas que o backup percorre. app_secrets fica de fora de propósito:
// são segredos rotacionáveis, e um backup é o lugar errado para guardá-los.
const TABELAS = [
  "ports", "port_delivery_rules", "crew_ranks", "brands", "categories",
  "products", "product_variants", "product_images", "product_categories",
  "ships", "ship_eta_history", "profiles", "admin_emails",
  "orders", "order_items", "order_emails", "credits", "wishlists",
  "call_reminders", "stripe_events", "fx_rates", "admin_notifications",
];

const BUCKETS = [
  { id: "product-images", publico: true },
  { id: "delivery-proofs", publico: false },
];

const arg = (nome) => {
  const i = process.argv.indexOf(nome);
  return i > -1 ? process.argv[i + 1] : null;
};

const hoje = new Date().toISOString().slice(0, 10);
const DESTINO = arg("--dir") || join(homedir(), "atgangway-backups", hoje);

async function api(caminho, aceita = "application/json") {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Accept: aceita },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho}`);
  return r;
}

/** Puxa a tabela inteira em páginas — o PostgREST corta em 1000 por resposta. */
async function baixaTabela(tabela) {
  const tudo = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const r = await fetch(
      `${URL_BASE}/rest/v1/${tabela}?select=*&limit=${passo}&offset=${de}`,
      { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const pagina = await r.json();
    tudo.push(...pagina);
    if (pagina.length < passo) break;
  }
  return tudo;
}

/**
 * Lista um bucket inteiro. A API do storage só enxerga um nível por vez e
 * devolve pastas como entradas sem `metadata` — então desce sozinha.
 */
async function listaRecursiva(bucket, prefixo) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: {
      apikey: CHAVE,
      Authorization: `Bearer ${CHAVE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: prefixo,
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao listar ${bucket}/${prefixo}`);

  const itens = await r.json();
  const nomes = [];
  for (const item of itens) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    if (item.id || item.metadata) nomes.push(caminho);
    else nomes.push(...(await listaRecursiva(bucket, caminho)));
  }
  return nomes;
}

async function baixaArquivo(bucket, nome) {
  const caminho = bucket.publico
    ? `/storage/v1/object/public/${bucket.id}/${nome}`
    : `/storage/v1/object/${bucket.id}/${nome}`;
  const r = await api(caminho, "*/*");
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  console.log(`Backup At Gangway — ${hoje}`);
  console.log(`  origem : ${URL_BASE}`);
  console.log(`  destino: ${DESTINO}`);
  console.log(`  chave  : ${TEM_SERVICE ? "service_role (backup completo)" : "publishable (backup PARCIAL)"}`);
  console.log("");

  await mkdir(join(DESTINO, "dados"), { recursive: true });

  const relatorio = { data: hoje, origem: URL_BASE, completo: TEM_SERVICE, tabelas: {}, storage: {}, faltou: [] };
  let linhas = 0;

  console.log("TABELAS");
  for (const t of TABELAS) {
    try {
      const dados = await baixaTabela(t);
      await writeFile(join(DESTINO, "dados", `${t}.json`), JSON.stringify(dados, null, 2));
      relatorio.tabelas[t] = dados.length;
      linhas += dados.length;
      console.log(`  ok    ${t.padEnd(22)} ${String(dados.length).padStart(5)} linhas`);
    } catch (e) {
      relatorio.tabelas[t] = `ERRO: ${e.message}`;
      relatorio.faltou.push(`tabela ${t}: ${e.message}`);
      console.log(`  FALHA ${t.padEnd(22)} ${e.message}`);
    }
  }

  console.log("\nARQUIVOS");
  for (const b of BUCKETS) {
    if (!b.publico && !TEM_SERVICE) {
      relatorio.storage[b.id] = "pulado (precisa de service_role)";
      relatorio.faltou.push(`bucket ${b.id}: precisa de SUPABASE_SERVICE_ROLE_KEY`);
      console.log(`  pulado ${b.id} — bucket privado, precisa de service_role`);
      continue;
    }
    try {
      const nomes = await listaRecursiva(b.id, "");
      let salvos = 0;
      for (const nome of nomes) {
        try {
          const bin = await baixaArquivo(b, nome);
          const destino = join(DESTINO, "storage", b.id, nome);
          await mkdir(destino.slice(0, destino.lastIndexOf("/")), { recursive: true });
          await writeFile(destino, bin);
          salvos++;
        } catch (e) {
          relatorio.faltou.push(`arquivo ${b.id}/${nome}: ${e.message}`);
        }
      }
      relatorio.storage[b.id] = salvos;
      console.log(`  ok    ${b.id.padEnd(22)} ${String(salvos).padStart(5)} arquivos`);
    } catch (e) {
      relatorio.storage[b.id] = `ERRO: ${e.message}`;
      relatorio.faltou.push(`bucket ${b.id}: ${e.message}`);
      console.log(`  FALHA ${b.id} — ${e.message}`);
    }
  }

  await writeFile(join(DESTINO, "RELATORIO.json"), JSON.stringify(relatorio, null, 2));

  console.log(`\n${linhas} linhas salvas em ${DESTINO}`);
  if (relatorio.faltou.length) {
    console.log(`\nATENCAO — ${relatorio.faltou.length} item(ns) fora do backup:`);
    for (const f of relatorio.faltou.slice(0, 10)) console.log(`  - ${f}`);
    if (!TEM_SERVICE) {
      console.log("\n  Para um backup completo, exporte SUPABASE_SERVICE_ROLE_KEY e rode de novo.");
    }
    process.exitCode = 1;
  } else {
    console.log("\nBackup completo, sem faltas.");
  }
}

main().catch((e) => {
  console.error("Backup falhou:", e.message);
  process.exit(1);
});
