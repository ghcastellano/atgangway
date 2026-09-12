/**
 * Alertas de atraso para a operação.
 *
 * O sync do line-up devolve quais navios mudaram de ETA. Aqui decidimos
 * quais dessas mudanças merecem interromper alguém — e a resposta é
 * "poucas". O line-up da CODESP só tem DATA (toda ETA é "12:00"), então
 * quando a lista vira o dia, metade da frota "atrasa 24 h" de uma vez.
 * A versão anterior fazia um aviso por navio publicado: 46 avisos por
 * manhã, 213 em oito dias, zero lidos. Um sino que toca para tudo é um
 * sino que ninguém ouve — e o aviso que importa some no meio.
 *
 * Três destinos, do mais importante para o menos:
 *
 *   individual, vermelho — navio com PEDIDO ABERTO mudou 2 h ou mais.
 *                          É dinheiro na mesa: muda o dia da compra e
 *                          da entrega. Sai e-mail para a operação.
 *   individual, âmbar    — navio que algum CLIENTE tem no perfil mudou
 *                          2 h ou mais. É gente a bordo que confia na
 *                          data; a última chamada e o checkout usam
 *                          esse ETA. Sai e-mail também.
 *   um só, informativo   — as demais escalas publicadas que escorregaram
 *                          6 h ou mais, agrupadas num aviso por rodada:
 *                          "31 escalas mudaram de data". Fica no sino,
 *                          não manda e-mail. Nada some em silêncio, e
 *                          nada grita sem motivo.
 *
 * Escala inativa (fora de cena) não avisa: não há o que vender nem
 * quem esperar. Dedupe por navio + ETA novo nos individuais e por
 * conjunto de mudanças no agrupado — rodar de hora em hora é seguro.
 *
 * A decisão é uma função pura (classificar) com o banco por parâmetro;
 * é ela que tem teste.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_EMAIL, SITE_URL } from "./env.ts";
import { sendMail } from "./mailer.ts";

type Mudanca = Record<string, unknown>;

export type NavioMudado = {
  id: string;
  name: string;
  eta: string;
  previous_eta: string | null;
  delay_hours: number | null;
  active: boolean;
  berth: string | null;
};

export type Contexto = {
  /** códigos de pedidos abertos por navio */
  pedidosPor: Map<string, string[]>;
  /** quantos clientes têm o navio no perfil */
  tripulantesPor: Map<string, number>;
};

export type Aviso = {
  titulo: string;
  corpo: string;
  severity: "warn" | "danger";
  dedupe: string;
  ship: string;
};

export type Lote = { titulo: string; corpo: string; dedupe: string; n: number };

export type Classificacao = { individuais: Aviso[]; lote: Lote | null };

/** Mudança que vale um aviso individual: dinheiro ou gente a bordo. */
export const LIMIAR_INDIVIDUAL_H = 2;
/** Mudança que entra no agrupado: escala publicada que escorregou. */
export const LIMIAR_LOTE_H = 6;
/** Quantos nomes o agrupado lista antes de dizer "e mais N". */
export const NOMES_NO_LOTE = 12;

const FUSO = "America/Sao_Paulo";
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const horas = (h: number) => `${h > 0 ? "+" : "−"}${Math.abs(Math.round(h))} h`;

/** Hash curto e determinístico (djb2) para a chave de dedupe do lote. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function classificar(navios: NavioMudado[], ctx: Contexto): Classificacao {
  const individuais: Aviso[] = [];
  const restantes: { n: NavioMudado; h: number }[] = [];

  for (const n of navios) {
    const h = Number(n.delay_hours ?? 0);
    const abs = Math.abs(h);
    const pedidos = ctx.pedidosPor.get(n.id) ?? [];
    const tripulantes = ctx.tripulantesPor.get(n.id) ?? 0;

    if ((pedidos.length > 0 || tripulantes > 0) && abs >= LIMIAR_INDIVIDUAL_H) {
      const sinal = h > 0 ? "atrasou" : "adiantou";
      const quem = pedidos.length
        ? ` · pedidos abertos: ${pedidos.map((c) => `#${c}`).join(", ")}`
        : ` · ${tripulantes} ${tripulantes === 1 ? "cliente tem" : "clientes têm"} este navio no perfil`;
      individuais.push({
        titulo: `${n.name} ${sinal} ${Math.abs(Math.round(h))} h`,
        corpo: `ETA ${quando(n.previous_eta)} → ${quando(n.eta)} (Santos)` + (n.berth ? ` · berço ${n.berth}` : "") + quem,
        severity: pedidos.length ? "danger" : "warn",
        dedupe: `ship_delay:${n.id}:${new Date(n.eta).toISOString()}`,
        ship: n.id,
      });
      continue;
    }

    if (n.active && abs >= LIMIAR_LOTE_H) restantes.push({ n, h });
  }

  let lote: Lote | null = null;
  if (restantes.length > 0) {
    restantes.sort((a, b) => Math.abs(b.h) - Math.abs(a.h) || a.n.name.localeCompare(b.n.name));
    const nomes = restantes.slice(0, NOMES_NO_LOTE).map(({ n, h }) => `${n.name} ${horas(h)}`);
    const sobra = restantes.length - nomes.length;
    const chave = restantes.map(({ n }) => `${n.id}:${new Date(n.eta).toISOString()}`).sort().join("|");
    lote = {
      n: restantes.length,
      titulo: `${restantes.length === 1 ? "1 escala mudou" : `${restantes.length} escalas mudaram`} de data no line-up`,
      corpo: nomes.join(" · ") + (sobra > 0 ? ` · e mais ${sobra}` : "") + " — sem pedido aberto nem cliente a bordo.",
      dedupe: `lineup_shift:${hash(chave)}`,
    };
  }

  return { individuais, lote };
}

export async function alertarAtrasos(
  supabase: SupabaseClient,
  changes: Mudanca[],
  secret: string
): Promise<{ checked: number; created: number; grouped: number; emailed: boolean }> {
  const nada = { checked: 0, created: 0, grouped: 0, emailed: false };
  const nomes = [...new Set(changes.map((c) => String(c.ship ?? "")).filter(Boolean))];
  if (nomes.length === 0) return nada;

  const { data: navios } = await supabase
    .from("ships")
    .select("id, name, eta, previous_eta, delay_hours, active, berth")
    .in("name", nomes);
  const lista = (navios ?? []) as NavioMudado[];
  if (lista.length === 0) return nada;
  const ids = lista.map((n) => n.id);

  // Pedidos abertos e clientes a bordo por navio — é o que separa
  // "curiosidade" de "dinheiro" e "gente".
  const [{ data: abertos }, { data: perfis }] = await Promise.all([
    supabase
      .from("orders")
      .select("ship_id, code")
      .in("ship_id", ids)
      .in("status", ["awaiting_deposit", "deposit_paid", "preparing", "at_gangway"]),
    supabase.from("profiles").select("ship_id").in("ship_id", ids),
  ]);
  const pedidosPor = new Map<string, string[]>();
  for (const o of (abertos ?? []) as { ship_id: string; code: string }[]) {
    pedidosPor.set(o.ship_id, [...(pedidosPor.get(o.ship_id) ?? []), o.code]);
  }
  const tripulantesPor = new Map<string, number>();
  for (const p of (perfis ?? []) as { ship_id: string }[]) {
    tripulantesPor.set(p.ship_id, (tripulantesPor.get(p.ship_id) ?? 0) + 1);
  }

  const { individuais, lote } = classificar(lista, { pedidosPor, tripulantesPor });

  const novos: Aviso[] = [];
  for (const a of individuais) {
    const { data: criado } = await supabase.rpc("notify_admin", {
      p_kind: "ship_delay",
      p_severity: a.severity,
      p_title: a.titulo,
      p_body: a.corpo,
      p_ship: a.ship,
      p_order: null,
      p_dedupe: a.dedupe,
      p_secret: secret,
    });
    if (criado) novos.push(a);
  }

  let grouped = 0;
  if (lote) {
    const { data: criado } = await supabase.rpc("notify_admin", {
      p_kind: "lineup_shift",
      p_severity: "info",
      p_title: lote.titulo,
      p_body: lote.corpo,
      p_dedupe: lote.dedupe,
      p_secret: secret,
    });
    if (criado) grouped = lote.n;
  }

  // E-mail só para o que é dinheiro ou gente; o agrupado fica no sino.
  let emailed = false;
  if (novos.length > 0) {
    const linhas = novos.map((a) => `• ${a.titulo}\n  ${a.corpo}`).join("\n\n");
    const r = await sendMail({
      to: CONTACT_EMAIL,
      subject: `[At Gangway] ${novos.length === 1 ? novos[0].titulo : `${novos.length} navios com pedido ou cliente mudaram de ETA`}`,
      text: `Mudanças de ETA que afetam pedidos ou clientes (última hora):\n\n${linhas}\n\nPainel: ${SITE_URL}/admin/ships\n`,
      html:
        `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;color:#0b1b30"><p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7a8fa8;margin:0 0 8px">At Gangway · line-up</p>` +
        `<h1 style="font-size:20px;margin:0 0 16px">Mudanças de ETA que afetam pedidos ou clientes</h1>` +
        novos.map((a) => `<p style="margin:0 0 12px"><b>${a.titulo}</b><br><span style="color:#556">${a.corpo}</span></p>`).join("") +
        `<p style="margin-top:20px"><a href="${SITE_URL}/admin/ships">Abrir o painel de navios</a></p></div>`,
    });
    emailed = r.sent;
  }

  return { checked: lista.length, created: novos.length, grouped, emailed };
}
