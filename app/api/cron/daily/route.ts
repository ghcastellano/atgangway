import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../../../lib/env.ts";
import { CONTACT_EMAIL } from "../../../../lib/env.ts";
import { sendMail } from "../../../../lib/mailer.ts";

export const maxDuration = 30;

/**
 * A batida de caixa (Vercel Cron, 06:00 de Santos).
 *
 * Segunda metade do "como vamos acompanhar tudo": a primeira é o aviso
 * por pedido; esta é o e-mail da manhã com o dia anterior inteiro —
 * pedidos, valores, o que mais saiu (que é a lista de compra do dia) e
 * as escalas das próximas 48h com a janela de cada uma. Manda mesmo
 * zerado: batida que só toca quando há venda não deixa saber se o
 * silêncio é loja parada ou cron morto.
 *
 * A expiração do New Arrivals roda dentro da MESMA RPC: selo de 30 dias
 * que ninguém tira faz "novo" significar "velho com etiqueta".
 * Segurança no padrão da casa: CRON_SECRET aqui, o mesmo segredo
 * conferido no banco pela RPC — nenhuma chave service_role no app.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, reason: "CRON_SECRET ausente no ambiente" });

  const auth = request.headers.get("authorization");
  const provided =
    auth?.replace(/^Bearer\s+/i, "") ?? new URL(request.url).searchParams.get("key");
  if (provided !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("ops_daily", { p_secret: secret });
  if (error || !(data as { ok?: boolean })?.ok) {
    return Response.json({ ok: false, error: error?.message ?? (data as { reason?: string })?.reason });
  }

  type Resumo = {
    totais: { pedidos: number; subtotal: number; depositos: number };
    pedidos: { code: string; status: string; vessel: string | null; berth: string | null; subtotal: number; deposit: number; at: string }[];
    itens: { name: string; qty: number }[];
    escalas: { ship: string; berth: string | null; eta: string; window: "open" | "closed" }[];
    novidades_expiradas: string[];
    /** Quantas escalas ACEITAM pedido agora. Zero = loja parada. */
    janelas_abertas: number;
    proxima_janela: string | null;
  };
  const r = data as Resumo;
  const d = (v: number) => `$${Number(v).toFixed(2)}`;

  /* O alarme vem ANTES de tudo, e só quando existe.
     
     A lista de escalas dizia "janela fechada" linha a linha, cada uma
     certa, e o conjunto ficava mudo sobre o fato que importa: se
     nenhuma aceita pedido, a loja está parada. Foi o que aconteceu em
     produção — quatro navios ativos, todos vencidos, e o e-mail das 6h
     descrevia isso sem nomear. Número que só aparece somando linhas na
     cabeça é número que ninguém soma de manhã. */
  const alarme =
    r.janelas_abertas === 0
      ? [
          "*** NO OPEN ORDER WINDOW — the store cannot take a single order right now. ***",
          r.proxima_janela
            ? `    Next call that would accept one: ${r.proxima_janela}.`
            : "    No upcoming call has an open window either. Check the line-up sync.",
          "",
        ]
      : [];

  const texto = [
    ...alarme,
    `ORDERS · last 24h: ${r.totais.pedidos} · subtotal ${d(r.totais.subtotal)} · deposits ${d(r.totais.depositos)}`,
    ...r.pedidos.map((o) =>
      `  #${o.code}  ${o.at}  ${o.vessel ?? "—"}${o.berth ? ` · berth ${o.berth}` : ""}  ${d(o.subtotal)}  [${o.status}]`
    ),
    "",
    r.itens.length ? "BUY LIST (top items):" : "BUY LIST: nothing sold.",
    ...r.itens.map((i) => `  ${String(i.qty).padStart(3)}x ${i.name}`),
    "",
    `CALLS · next 48h: ${r.escalas.length} · open windows right now: ${r.janelas_abertas}`,
    ...r.escalas.map((s) =>
      `  ${s.eta}  ${s.ship}${s.berth ? ` · berth ${s.berth}` : ""}  [window ${s.window}]`
    ),
    ...(r.novidades_expiradas.length
      ? ["", `NEW ARRIVALS rotated out (30 days): ${r.novidades_expiradas.join(", ")}`]
      : []),
  ].join("\n");

  const enviado = await sendMail({
    to: CONTACT_EMAIL,
    /* Assunto carrega o alarme porque é o que se lê na tela de bloqueio:
       um digest que parece rotina não é aberto às 6h da manhã. */
    subject:
      (r.janelas_abertas === 0 ? "🔴 NO OPEN WINDOW — " : "⚓ Daily — ") +
      `${r.totais.pedidos} order${r.totais.pedidos === 1 ? "" : "s"} · ` +
      `${d(r.totais.depositos)} in deposits · ` +
      `${r.escalas.length} call${r.escalas.length === 1 ? "" : "s"} ahead`,
    text: texto,
    html: "",
  });

  return Response.json({
    ok: true,
    sent: enviado.sent,
    totais: r.totais,
    escalas: r.escalas.length,
    janelas_abertas: r.janelas_abertas,
  });
}
