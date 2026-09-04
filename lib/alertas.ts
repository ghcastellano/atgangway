/**
 * Alertas de atraso para a operação.
 *
 * O sync do line-up devolve quais navios mudaram de ETA. Aqui decidimos
 * quais dessas mudanças merecem interromper alguém:
 *
 *   - navio PUBLICADO (à venda) que escorregou 6 h ou mais, em qualquer
 *     direção — muda o dia da compra e da entrega;
 *   - navio com PEDIDO ABERTO que mudou 2 h ou mais — aí é dinheiro na
 *     mesa, e o limiar é o mesmo que a loja usa para avisar o cliente.
 *
 * Cada fato vira UM aviso (dedupe por navio + ETA novo) no sino do
 * painel, e os avisos novos da rodada saem num e-mail só para a caixa da
 * operação. Rodar de hora em hora é seguro: o que já foi avisado não
 * volta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_EMAIL, SITE_URL } from "./env.ts";
import { sendMail } from "./mailer.ts";

type Mudanca = Record<string, unknown>;

type Navio = {
  id: string;
  name: string;
  eta: string;
  previous_eta: string | null;
  delay_hours: number | null;
  active: boolean;
  berth: string | null;
};

const FUSO = "America/Sao_Paulo";
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export async function alertarAtrasos(
  supabase: SupabaseClient,
  changes: Mudanca[],
  secret: string
): Promise<{ checked: number; created: number; emailed: boolean }> {
  const nomes = [...new Set(changes.map((c) => String(c.ship ?? "")).filter(Boolean))];
  if (nomes.length === 0) return { checked: 0, created: 0, emailed: false };

  const { data: navios } = await supabase
    .from("ships")
    .select("id, name, eta, previous_eta, delay_hours, active, berth")
    .in("name", nomes);
  const lista = (navios ?? []) as Navio[];
  if (lista.length === 0) return { checked: 0, created: 0, emailed: false };

  // Pedidos abertos por navio — é o que separa "curiosidade" de "dinheiro".
  const { data: abertos } = await supabase
    .from("orders")
    .select("ship_id, code")
    .in("ship_id", lista.map((n) => n.id))
    .in("status", ["awaiting_deposit", "deposit_paid", "preparing", "at_gangway"]);
  const pedidosPor = new Map<string, string[]>();
  for (const o of (abertos ?? []) as { ship_id: string; code: string }[]) {
    pedidosPor.set(o.ship_id, [...(pedidosPor.get(o.ship_id) ?? []), o.code]);
  }

  const novos: { titulo: string; corpo: string }[] = [];
  for (const n of lista) {
    const h = Number(n.delay_hours ?? 0);
    const pedidos = pedidosPor.get(n.id) ?? [];
    const relevante = (n.active && Math.abs(h) >= 6) || (pedidos.length > 0 && Math.abs(h) >= 2);
    if (!relevante) continue;

    const sinal = h > 0 ? "atrasou" : "adiantou";
    const titulo = `${n.name} ${sinal} ${Math.abs(Math.round(h))} h`;
    const corpo =
      `ETA ${quando(n.previous_eta)} → ${quando(n.eta)} (Santos)` +
      (n.berth ? ` · berço ${n.berth}` : "") +
      (pedidos.length ? ` · pedidos abertos: ${pedidos.map((c) => `#${c}`).join(", ")}` : " · sem pedido aberto");
    const severity = pedidos.length ? "danger" : "warn";

    const { data: criado } = await supabase.rpc("notify_admin", {
      p_kind: "ship_delay",
      p_severity: severity,
      p_title: titulo,
      p_body: corpo,
      p_ship: n.id,
      p_order: null,
      p_dedupe: `ship_delay:${n.id}:${new Date(n.eta).toISOString()}`,
      p_secret: secret,
    });
    if (criado) novos.push({ titulo, corpo });
  }

  let emailed = false;
  if (novos.length > 0) {
    const linhas = novos.map((a) => `• ${a.titulo}\n  ${a.corpo}`).join("\n\n");
    const r = await sendMail({
      to: CONTACT_EMAIL,
      subject: `[At Gangway] ${novos.length === 1 ? novos[0].titulo : `${novos.length} navios mudaram de ETA`}`,
      text: `Mudanças de ETA no line-up de Santos (última hora):\n\n${linhas}\n\nPainel: ${SITE_URL}/admin/ships\n`,
      html:
        `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;color:#0b1b30"><p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7a8fa8;margin:0 0 8px">At Gangway · line-up</p>` +
        `<h1 style="font-size:20px;margin:0 0 16px">Mudanças de ETA na última hora</h1>` +
        novos.map((a) => `<p style="margin:0 0 12px"><b>${a.titulo}</b><br><span style="color:#556">${a.corpo}</span></p>`).join("") +
        `<p style="margin-top:20px"><a href="${SITE_URL}/admin/ships">Abrir o painel de navios</a></p></div>`,
    });
    emailed = r.sent;
  }

  return { checked: lista.length, created: novos.length, emailed };
}
