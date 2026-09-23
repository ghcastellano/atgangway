#!/usr/bin/env node
/**
 * Vigia os crons do banco — e o silêncio deles.
 *
 * Existe por causa do plano Free: ele pausa o projeto depois de 7 dias sem
 * escrita no banco, e são justamente os crons que mantêm o projeto vivo. Se
 * eles pararem, nada quebra na hora — o line-up só vai congelando, e o
 * primeiro sinal seria um navio com ETA de semanas atrás na home.
 *
 * Reprova em dois casos, e o segundo é o que importa:
 *   1. execução com status diferente de "succeeded";
 *   2. cron que simplesmente PAROU de rodar. Um job que não executa não
 *      gera falha nenhuma — ele desaparece dos registros, e um verificador
 *      que só olha falhas dá tudo verde enquanto o banco caminha para pausar.
 *
 *   node scripts/vigiar-crons.mjs            # últimas 48h
 *   node scripts/vigiar-crons.mjs --horas 24
 *
 * Usa o token pessoal do Supabase (SUPABASE_ACCESS_TOKEN ou o arquivo em
 * ~/.config/supabase/atgangway-token), porque o schema cron não é exposto
 * pela API pública — e expô-lo só para isso seria abrir porta à toa.
 */
import { readFileSync } from "node:fs";

const REF = process.env.SUPABASE_PROJECT_REF || "cuaocjxofaizefzcxlyc";

/* O token pessoal do Supabase, e não a service_role.
 *
 * cron.job_run_details vive num schema que o PostgREST não expõe — e
 * expor o schema `cron` inteiro só para ler um registro de execuções
 * seria abrir superfície de ataque para resolver um problema de
 * observabilidade. A Management API roda o SQL sem tocar em nada. */
function leToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  try {
    // import estático: `require` não existe em módulo .mjs, e o catch
    // engolia o ReferenceError fingindo que era "token não encontrado".
    return readFileSync(`${process.env.HOME}/.config/supabase/atgangway-token`, "utf-8").trim();
  } catch {
    return null;
  }
}

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : null;
};
const HORAS = Number(arg("--horas") || 48);

// Quanto tempo cada cron pode ficar calado antes de virar alarme. É o
// intervalo dele com folga — não adianta acusar atraso de minutos num job
// que roda uma vez por dia.
const SILENCIO_MAXIMO_HORAS = {
  "vessel-lineup-hourly": 3,
  "vessel-daily-ops": 30,
  "vessel-ptax-weekdays": 80, // roda em dia útil: atravessa o fim de semana
};

const TOKEN = leToken();
if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN (ou ~/.config/supabase/atgangway-token).");
  process.exit(2);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  const desde = new Date(Date.now() - HORAS * 3600_000).toISOString();

  let jobs, execucoes;
  try {
    jobs = await sql("select jobid, jobname, schedule, active from cron.job order by jobname");
    execucoes = await sql(
      `select jobid, status, start_time from cron.job_run_details ` +
        `where start_time > '${desde}' order by start_time desc limit 2000`
    );
  } catch (e) {
    console.error("Não consegui ler os crons pela Management API.");
    console.error(`  ${e.message}`);
    process.exit(2);
  }

  const agora = Date.now();
  const problemas = [];

  console.log(`Crons do At Gangway — últimas ${HORAS}h\n`);
  console.log(`  ${"cron".padEnd(24)} ${"agenda".padEnd(16)} exec  falhas  último`);
  console.log("  " + "-".repeat(68));

  for (const j of jobs) {
    const minhas = execucoes.filter((e) => e.jobid === j.jobid);
    const falhas = minhas.filter((e) => e.status !== "succeeded");
    const ultima = minhas[0] ? new Date(minhas[0].start_time) : null;
    const caladoH = ultima ? (agora - ultima.getTime()) / 3600_000 : Infinity;
    const teto = SILENCIO_MAXIMO_HORAS[j.jobname] ?? 30;

    const quando = ultima
      ? caladoH < 1
        ? `${Math.round(caladoH * 60)} min atrás`
        : `${caladoH.toFixed(1)} h atrás`
      : "NUNCA";

    let marca = "ok  ";
    if (!j.active) {
      marca = "OFF ";
      problemas.push(`${j.jobname}: desativado no banco`);
    } else if (caladoH > teto) {
      marca = "MUDO";
      problemas.push(
        `${j.jobname}: sem rodar há ${caladoH === Infinity ? "sempre" : caladoH.toFixed(1) + "h"} (limite ${teto}h)`
      );
    } else if (falhas.length) {
      marca = "FALHA";
      problemas.push(`${j.jobname}: ${falhas.length} execução(ões) com erro`);
    }

    console.log(
      `  ${marca} ${j.jobname.padEnd(23)} ${String(j.schedule).padEnd(16)} ` +
        `${String(minhas.length).padStart(4)} ${String(falhas.length).padStart(6)}  ${quando}`
    );
  }

  if (!problemas.length) {
    console.log(`\nTudo rodando. O banco continua recebendo escrita — no plano`);
    console.log(`Free é isso que impede a pausa por inatividade.`);
    return;
  }

  console.log(`\n${problemas.length} problema(s):`);
  for (const p of problemas) console.log(`  - ${p}`);
  console.log(
    `\nCron parado no plano Free leva à pausa do projeto em 7 dias sem escrita.`
  );
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("Falhou:", e.message);
  process.exit(2);
});
