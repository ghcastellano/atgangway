import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "../../../../lib/env.ts";
import {
  LINEUP_SOURCES,
  fetchLineupHtml,
  parseLineup,
  tableRows,
} from "../../../../lib/lineup.ts";
import { sendMail, sendOrderEmail } from "../../../../lib/mailer.ts";
import { alertarAtrasos } from "../../../../lib/alertas.ts";
import { buildLastCallEmail, type LastCallData } from "../../../../lib/emails.ts";
import { SITE_URL } from "../../../../lib/env.ts";

export const maxDuration = 60;

/**
 * Sync do line-up do Porto de Santos (pg_cron, de hora em hora).
 *
 * Segurança: o portador prova que sabe o segredo do cron, e quem
 * confere é o BANCO (is_cron_secret → app_secrets.cron_secret) — a
 * mesma pergunta que as RPCs de trabalho já fazem por dentro. A rota
 * validava contra uma CÓPIA em env (CRON_SECRET), e a cópia é o que
 * faltou no painel: o agendador mandava o valor certo e levava 401.
 * Nenhuma chave de service role no app, e nenhum segredo duplicado.
 *
 * ?debug=1 devolve um diagnóstico da fonte (status, tamanho, amostra
 * das tabelas) para calibrar o parser sem gravar nada.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  // Só header Authorization. Segredo em ?key= fica em log de acesso,
  // proxy e histórico — e o agendador (pg_cron) já manda o header.
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? null;
  if (!provided) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!supabaseConfigured) {
    return Response.json({ ok: false, reason: "supabase não configurado" }, { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: souCron } = await supabase.rpc("is_cron_secret", { p_secret: provided });
  if (!souCron) return Response.json({ error: "unauthorized" }, { status: 401 });
  const secret = provided;

  const debug = url.searchParams.get("debug") === "1";
  const dryRun = debug || url.searchParams.get("dry") === "1";

  const attempts: Array<Record<string, unknown>> = [];
  let rows: ReturnType<typeof parseLineup>["rows"] = [];
  let usedSource: string | null = null;

  for (const source of LINEUP_SOURCES) {
    const res = await fetchLineupHtml(source);
    const parsed = res.ok ? parseLineup(res.html, source) : { rows: [], note: "fetch falhou" };
    attempts.push({
      source,
      status: res.status,
      error: res.error,
      bytes: res.html.length,
      tables: res.ok ? tableRows(res.html).length : 0,
      parsed: parsed.rows.length,
      note: parsed.note,
      ...(debug
        ? {
            titleSample: res.html.match(/<title[^>]*>([\s\S]{0,120})/i)?.[1],
            firstRows: tableRows(res.html).slice(0, 6),
            firstParsed: parsed.rows.slice(0, 5),
          }
        : {}),
    });
    if (parsed.rows.length) {
      rows = parsed.rows;
      usedSource = source;
      break;
    }
  }

  if (dryRun) {
    return Response.json({ dryRun: true, found: rows.length, source: usedSource, attempts });
  }

  if (!rows.length) {
    // Fonte fora do ar não derruba a loja (o staff cadastra à mão), mas
    // é falha do job: 502 deixa isso visível de fora em vez de fingir
    // sucesso — foi um 200 aqui que escondeu a loja com zero janelas.
    return Response.json({ ok: false, reason: "no rows parsed", attempts }, { status: 502 });
  }

  const summary = { created: 0, eta_changed: 0, new_voyage: 0, unchanged: 0, failed: 0 };
  const changes: Array<Record<string, unknown>> = [];

  // Janela útil: da última meia-noite operacional até 21 dias à frente.
  // A lista da CODESP carrega registros históricos (achamos escalas de
  // 2022) — sem piso, eles entrariam como navios "esperados".
  const floor = Date.now() - 12 * 3600e3;
  const horizon = Date.now() + 21 * 24 * 3600e3;

  // Um navio aparece várias vezes na lista (escalas diferentes). Só a
  // PRÓXIMA escala interessa: senão a segunda ocorrência sobrescreve a
  // primeira e vira um "atraso" que não existe.
  const nextCall = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const t = new Date(r.eta).getTime();
    if (t < floor || t > horizon) continue;
    const prev = nextCall.get(r.name);
    if (!prev || new Date(prev.eta).getTime() > t) nextCall.set(r.name, r);
  }

  const upcoming = [...nextCall.values()].sort(
    (a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()
  );

  for (const r of upcoming) {
    const { data, error } = await supabase.rpc("sync_ship_eta", {
      p_name: r.name,
      p_eta: r.eta,
      p_berth: r.berth,
      p_imo: r.imo,
      p_voyage: r.voyage,
      p_source: "port_lineup",
      p_secret: secret,
    });
    const action = (data as { action?: string } | null)?.action;
    if (error || !data) summary.failed++;
    else if (action === "created") summary.created++;
    else if (action === "new_voyage") summary.new_voyage++;
    else if (action === "eta_changed") {
      summary.eta_changed++;
      changes.push(data as Record<string, unknown>);
    } else summary.unchanged++;
  }

  /* Atraso de navio é notícia para NÓS antes de ser para o cliente: a
     compra é feita contra o ETA, e um navio que escorrega 12 h muda o
     dia de ir ao mercado. Cada mudança relevante vira um aviso no sino
     do painel (deduplicado por navio + ETA novo) e um e-mail para a
     caixa da operação. */
  const alertas = await alertarAtrasos(supabase, changes, secret);

  /* Trazer as escalas era metade do trabalho: alguém tem de decidir
     quais estão EM CENA. Sem esta chamada o campo `active` só sabia
     envelhecer, e a loja chegou a ficar com os quatro navios ativos
     todos vencidos — zero escalas compráveis, e nada avisando.

     Roda aqui, e não no resumo das 6h, porque escala vira ao longo do
     dia: um corte que fecha às 14h tem de sumir da cena às 14h, não na
     manhã seguinte. O sync acima já atualizou as ETAs, então a rotação
     decide sobre o dado mais fresco que existe. */
  const { data: giro } = await supabase.rpc("rotate_ship_calls", { p_secret: secret });

  /* A outra consequencia de uma escala ir embora: o que fazer com quem
     ja tinha pago.

     Roda DEPOIS da rotacao e com a mesma regra de tempo, porque as duas
     sao o mesmo fato — o navio esteve e foi. Deposito pago vira credito
     integral, o pedido vai para `credited`, e sai o e-mail. E a promessa
     que o checkout ja fazia por escrito e que ninguem cumpria. */
  const { data: desvio } = await supabase.rpc("credit_skipped_calls", { p_secret: secret });
  const creditados =
    (desvio as { creditados?: { id: string; code: string }[] } | null)?.creditados ?? [];

  /* Um e-mail por pedido creditado. O claim no banco garante que cada um
     sai UMA vez, entao repetir a chamada de hora em hora e inofensivo —
     se o SMTP falhar agora, a proxima passada tenta de novo. */
  let avisados = 0;
  for (const c of creditados) {
    const r = await sendOrderEmail(supabase, c.id, "credited", secret);
    if (r.sent) avisados++;
  }

  /* A última chamada: quem tem o navio no perfil e a janela fechando
     nas próximas 12 horas recebe UM aviso — o claim no banco garante um
     por pessoa por escala, então rodar isto de hora em hora é seguro.
     Se o SMTP falhar, a reivindicação é devolvida e a próxima passada
     tenta de novo, como no livro-razão dos e-mails de pedido. */
  const { data: chamada } = await supabase.rpc("claim_call_reminders", { p_secret: secret });
  const lembretes =
    ((chamada as { reminders?: (LastCallData & { user_id: string; ship_id: string; call_date: string })[] } | null)
      ?.reminders) ?? [];
  let lembrados = 0;
  for (const l of lembretes) {
    const built = buildLastCallEmail(l, SITE_URL);
    const r = await sendMail({ to: l.to_email, subject: built.subject, html: built.html, text: built.text });
    if (r.sent) lembrados++;
    else
      await supabase.rpc("release_call_reminder", {
        p_user: l.user_id,
        p_ship: l.ship_id,
        p_call_date: l.call_date,
        p_secret: secret,
      });
  }

  return Response.json({
    ok: true,
    source: usedSource,
    seen: rows.length,
    inWindow: upcoming.length,
    ...summary,
    changes,
    rotation: giro ?? null,
    deviation: { credited: creditados.length, emailed: avisados, detail: desvio ?? null },
    lastCall: { claimed: lembretes.length, emailed: lembrados },
    alerts: alertas,
  });
}
