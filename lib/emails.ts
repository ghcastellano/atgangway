/**
 * E-mails transacionais — só a montagem, nenhum I/O.
 *
 * Separado do transporte de propósito: template é lógica pura e
 * testável (tem teste para escape de HTML, que aqui não é firula —
 * o nome de contato vem do cliente e entra no corpo do e-mail).
 *
 * Regras de cliente de e-mail que ditam o formato abaixo:
 *   - tabela em vez de flex/grid (Outlook ignora layout moderno);
 *   - todo estilo inline (Gmail descarta <style> em boa parte dos casos);
 *   - nada de webfont — pilha do sistema;
 *   - fundo escuro pintado na tabela, não no <body>, que muitos
 *     clientes substituem pelo próprio.
 */

import { santosTime, usd } from "./format.ts";

export type EmailKind = "deposit_paid" | "at_gangway" | "delivered" | "credited";

export type OrderEmailItem = {
  name: string;
  emoji?: string | null;
  qty: number | string;
  unit_usd: number | string;
};

export type OrderEmailData = {
  kind: EmailKind;
  to_email: string;
  to_name?: string | null;
  code: string;
  subtotal_usd: number | string;
  deposit_usd: number | string;
  balance_usd: number | string;
  credit_applied_usd?: number | string | null;
  ship_name?: string | null;
  ship_berth?: string | null;
  ship_eta?: string | null;
  has_photo?: boolean;
  items?: OrderEmailItem[] | null;
};

export type BuiltEmail = { subject: string; html: string; text: string };

/** Postgres devolve numeric como string no JSON — normaliza tudo. */
const n = (v: number | string | null | undefined) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Nome de navio, nome de contato e nome de produto são texto de terceiro. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = {
  bg: "#01060D",
  card: "#0B1B30",
  line: "#16304F",
  ink: "#EAF2FB",
  faint: "#8CA3BC",
  amber: "#FFB648",
  teal: "#2EE6C8",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function firstName(name: string | null | undefined): string {
  const f = String(name ?? "").trim().split(/\s+/)[0];
  return f && f.length > 1 ? f : "sailor";
}

function shipLine(d: OrderEmailData): string {
  if (!d.ship_name) return "";
  const berth = d.ship_berth ? ` · BERTH ${d.ship_berth}` : "";
  const eta = d.ship_eta ? ` · ETA ${santosTime(d.ship_eta)} (Santos)` : "";
  return `${d.ship_name}${berth}${eta}`;
}

function itemsHtml(items: OrderEmailItem[]): string {
  return items
    .map(
      (i) => `<tr>
        <td style="padding:7px 0;color:${C.ink};font-size:14px">${esc(i.emoji ?? "📦")} ${esc(i.name)}
          <span style="color:${C.faint}"> × ${esc(i.qty)}</span></td>
        <td align="right" style="padding:7px 0;color:${C.ink};font-size:14px;white-space:nowrap">${usd(
          n(i.unit_usd) * n(i.qty)
        )}</td>
      </tr>`
    )
    .join("");
}

function money(label: string, value: string, strong = false, color = C.ink): string {
  return `<tr>
    <td style="padding:5px 0;color:${C.faint};font-size:13px">${esc(label)}</td>
    <td align="right" style="padding:5px 0;color:${color};font-size:13px;${
      strong ? "font-weight:700" : ""
    };white-space:nowrap">${esc(value)}</td>
  </tr>`;
}

/**
 * Casca comum: cabeçalho, cartão, botão, rodapé.
 *
 * Exportada porque os e-mails de CONTA (confirmar cadastro, redefinir
 * senha) não saem daqui — saem do Supabase, que guarda o HTML no
 * próprio projeto. Eles eram HTML cru, sem identidade nenhuma, e um
 * deles ainda assinava o nome antigo da loja meses depois da troca:
 * ninguém percebe que um template fora do repositório envelheceu.
 *
 * `scripts/gerar-templates-email.mjs` monta os dois com esta função e
 * grava em supabase/templates/. Uma casca só para tudo que a loja
 * manda — inclusive a declaração de tema escuro, que o e-mail de conta
 * precisa pelo mesmo motivo que os outros.
 */
export function shell(opts: {
  kicker: string;
  title: string;
  lead: string;
  accent: string;
  body: string;
  /** Sem botão só o e-mail que entrega um CÓDIGO: um botão que não usa
      o código levaria a pessoa para longe dele. */
  ctaLabel?: string;
  ctaHref?: string;
  siteUrl: string;
  /** Rodapé do cartão, DEPOIS do botão: o plano B de quem o botão
      não serviu. Antes do botão ele responderia uma pergunta que a
      pessoa ainda não fez, e empurraria o botão para baixo da dobra. */
  nota?: string;
}): string {
  /* O <head> existe por UM motivo: `color-scheme`.
     Sem ele o Gmail no Android assume que precisa "consertar" o e-mail
     para o tema escuro do aparelho e reescreve cores por conta própria,
     elemento a elemento. Num e-mail que JÁ nasce escuro o conserto é o
     estrago: a frase do depósito chegou preta sobre azul-quase-preto,
     ilegível, enquanto o resto do cartão ficou intacto. Declarar que o
     e-mail suporta escuro é o que faz o cliente parar de reescrever. */
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<style>:root { color-scheme: dark; supported-color-schemes: dark; }</style>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};margin:0;padding:0">
  <tr><td align="center" style="padding:26px 14px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;font-family:${FONT}">

      <tr><td style="padding:0 4px 16px">
        <span style="color:${C.amber};font-size:11px;letter-spacing:2.4px;font-weight:700">⚓ AT GANGWAY</span>
        <span style="color:${C.faint};font-size:11px;letter-spacing:1.4px"> · SANTOS</span>
      </td></tr>

      <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:24px 22px">
        <p style="margin:0 0 6px;color:${opts.accent};font-size:11px;letter-spacing:2px;font-weight:700">${esc(
          opts.kicker
        )}</p>
        <h1 style="margin:0 0 10px;color:${C.ink};font-size:23px;line-height:1.25;font-weight:800">${esc(
          opts.title
        )}</h1>
        <p style="margin:0 0 18px;color:${C.faint};font-size:14px;line-height:1.55">${opts.lead}</p>
        ${opts.body}
        ${
          opts.ctaLabel && opts.ctaHref
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 2px">
          <tr><td style="border-radius:12px;background:${C.amber}">
            <a href="${opts.ctaHref}" style="display:inline-block;padding:13px 22px;color:#06121F;font-size:15px;font-weight:800;text-decoration:none;font-family:${FONT}">${esc(
              opts.ctaLabel
            )}</a>
          </td></tr>
        </table>`
            : ""
        }
        ${opts.nota ?? ""}
      </td></tr>

      <tr><td style="padding:18px 6px 0;color:${C.faint};font-size:12px;line-height:1.6">
        <span style="color:${C.faint}">At Gangway — Porto de Santos.</span><br>
        <span style="color:${C.faint}">Questions? Just reply to this e-mail.</span>
        <a href="${opts.siteUrl}" style="color:${C.faint}">${esc(
          opts.siteUrl.replace(/^https?:\/\//, "")
        )}</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * A última chamada: a janela do navio da pessoa fecha em horas.
 *
 * Não é e-mail de pedido — não existe pedido ainda; é exatamente por
 * isso que ele existe. O corte fechava em silêncio e quem estava
 * montando a caixa descobria no empurrão do checkout. Nas 12 horas
 * antes do corte está a compra do que FALTOU, não do que se planejou.
 *
 * Um por pessoa por escala, garantido pelo livro-razão call_reminders —
 * este builder é puro e não sabe disso; quem garante é o claim no banco.
 *
 * A lista de desejos entra no texto quando existe: é o único "carrinho"
 * que o servidor enxerga de verdade (o carrinho mesmo vive no
 * localStorage do navegador), e "suas N coisas guardadas" é mais
 * concreto que qualquer frase de urgência.
 */
export type LastCallData = {
  to_email: string;
  to_name?: string | null;
  ship: string;
  berth?: string | null;
  eta: string;
  closes_at: string;
  wish_count?: number | null;
};

export function buildLastCallEmail(d: LastCallData, siteUrl: string): BuiltEmail {
  const who = (d.to_name ?? "sailor").split(/\s+/)[0] || "sailor";
  const site = siteUrl.replace(/\/$/, "");
  const fecha = santosTime(d.closes_at);
  const chega = santosTime(d.eta);
  const wishes = Number(d.wish_count ?? 0);

  const lead =
    `The order window for <b style="color:${C.ink}">${esc(d.ship)}</b> closes at ` +
    `<b style="color:${C.ink}">${esc(fecha)}</b> — after that we can\u2019t buy in time for the gangway.` +
    (wishes > 0
      ? ` Your wish list has <b style="color:${C.ink}">${wishes} item${wishes === 1 ? "" : "s"}</b> waiting to become an order.`
      : "");

  return {
    subject: `Last call for ${d.ship} — ordering closes ${fecha}`,
    html: shell({
      kicker: "ORDER WINDOW CLOSING",
      title: `Last call, ${who}.`,
      lead,
      accent: C.amber,
      /* Duas frases, dois <span> com a cor escrita em cada um. O <br>
         separava dois trechos de texto solto que herdavam a cor do <p>
         — e herança é justamente o que o Gmail perde quando reescreve
         cores: a primeira linha saiu legível e a segunda, preta. Cor
         herdada em e-mail é cor que um cliente pode não ver. */
      body: `<p style="margin:0;padding:12px 14px;background:#06121F;border:1px solid ${C.line};border-radius:12px;color:${C.faint};font-size:13px;line-height:1.55">
          <span style="color:${C.faint}">${esc(d.ship)}${d.berth ? ` · berth ${esc(d.berth)}` : ""} · alongside ${esc(chega)}.</span><br>
          <span style="color:${C.faint}">30% deposit now, the rest at the gangway — and if the ship skips the call, the deposit becomes full credit.</span>
        </p>`,
      ctaLabel: wishes > 0 ? "Turn my wish list into an order" : "Order before the cut-off",
      ctaHref: wishes > 0 ? `${site}/wishlist` : `${site}/shop`,
      siteUrl: site,
    }),
    text: [
      `Last call for ${d.ship} — ordering closes ${fecha}`,
      ``,
      `Last call, ${who}.`,
      ``,
      `The order window for ${d.ship} closes at ${fecha}.`,
      `After that we can't buy in time for the gangway.`,
      wishes > 0 ? `Your wish list has ${wishes} item${wishes === 1 ? "" : "s"} waiting to become an order.` : "",
      ``,
      `${d.ship}${d.berth ? ` - berth ${d.berth}` : ""} - alongside ${chega}.`,
      `30% deposit now, the rest at the gangway.`,
      ``,
      wishes > 0 ? `${site}/wishlist` : `${site}/shop`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Monta assunto, HTML e texto puro de um dos três e-mails do fluxo. */
export function buildOrderEmail(d: OrderEmailData, siteUrl: string): BuiltEmail {
  const site = siteUrl.replace(/\/+$/, "");
  const href = `${site}/orders/${encodeURIComponent(d.code)}`;
  const items = d.items ?? [];
  const who = firstName(d.to_name);
  const ship = shipLine(d);
  const credit = n(d.credit_applied_usd);
  const balance = n(d.balance_usd);

  const table = items.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};margin:4px 0 14px">
         ${itemsHtml(items)}
       </table>`
    : "";

  const totals = (rows: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;

  const textItems = items
    .map((i) => `  ${i.qty}x ${i.name} — ${usd(n(i.unit_usd) * n(i.qty))}`)
    .join("\n");

  if (d.kind === "deposit_paid") {
    const rows =
      money("Subtotal", usd(n(d.subtotal_usd))) +
      money("Deposit paid (30%)", usd(n(d.deposit_usd)), true, C.teal) +
      (credit > 0 ? money("Captain credit applied", `−${usd(credit)}`, false, C.teal) : "") +
      money("Balance at the gangway", usd(balance), true);

    return {
      subject: `Deposit received — order #${d.code} is locked in`,
      html: shell({
        kicker: "DEPOSIT RECEIVED",
        title: `You're on the list, ${who}.`,
        lead: ship
          ? `We're buying fresh in Santos and meeting <b style="color:${C.ink}">${esc(
              ship
            )}</b>. Nothing else for you to do until we're at the gangway.`
          : "We're buying fresh in Santos. Nothing else for you to do until we're at the gangway.",
        accent: C.teal,
        body: table + totals(rows),
        ctaLabel: "Track order",
        ctaHref: href,
        siteUrl: site,
      }),
      text: [
        `Deposit received — order #${d.code}`,
        ``,
        `You're on the list, ${who}.`,
        ship ? `Vessel: ${ship}` : "",
        ``,
        textItems,
        ``,
        `Subtotal: ${usd(n(d.subtotal_usd))}`,
        `Deposit paid (30%): ${usd(n(d.deposit_usd))}`,
        credit > 0 ? `Captain credit applied: -${usd(credit)}` : "",
        `Balance at the gangway: ${usd(balance)}`,
        ``,
        `Track your order: ${href}`,
        ``,
        `At Gangway — Porto de Santos.`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (d.kind === "at_gangway") {
    const rows = money("Balance due at handover", usd(balance), true, C.amber);
    return {
      subject: `We're at the gangway — order #${d.code}`,
      html: shell({
        kicker: "AT THE GANGWAY",
        title: "Your box is dockside.",
        lead: ship
          ? `We're waiting at <b style="color:${C.ink}">${esc(
              ship
            )}</b>. Send anyone down with the order code — card or cash at handover, and you get a delivery photo either way.`
          : `We're waiting dockside. Send anyone down with the order code — card or cash at handover.`,
        accent: C.amber,
        body:
          `<p style="margin:0 0 14px;color:${C.ink};font-size:15px">Order code: <b style="letter-spacing:1px">#${esc(
            d.code
          )}</b></p>` +
          table +
          totals(rows),
        ctaLabel: "Open order",
        ctaHref: href,
        siteUrl: site,
      }),
      text: [
        `We're at the gangway — order #${d.code}`,
        ``,
        ship ? `Vessel: ${ship}` : "",
        `Balance due at handover: ${usd(balance)}`,
        ``,
        `Show this code at the gangway: #${d.code}`,
        `Open order: ${href}`,
        ``,
        `At Gangway — Porto de Santos.`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (d.kind === "credited") {
    /* O e-mail que faltava — e o mais importante dos quatro.
       
       Os outros tres avisam quando algo deu CERTO. Este avisa quando
       deu errado: o navio pulou a escala e a caixa nao foi entregue.
       Era o unico momento em que o sistema ficava calado, e calar-se
       justamente na ma noticia e o que ensina uma tripulacao a nao
       confiar numa loja.
       
       Ambar, e nao vermelho: nada foi perdido. O tom e o de quem avisa,
       nao o de quem se desculpa — desculpa longa faz parecer que houve
       falha nossa, e desvio de navio nao e falha de ninguem. */
    const rows =
      money("Deposit you had paid", usd(n(d.deposit_usd))) +
      money("Held as credit", usd(n(d.deposit_usd)), true, C.amber);

    return {
      subject: `${ship || "Your vessel"} skipped the call — your ${usd(
        n(d.deposit_usd)
      )} is credit now`,
      html: shell({
        kicker: "CREDIT HELD",
        title: `No paperwork, ${who}.`,
        lead: ship
          ? `<b style="color:${C.ink}">${esc(
              ship
            )}</b> didn't make the call at Santos, so order #${esc(
              d.code
            )} never reached the gangway. Exactly as promised at checkout, your deposit is now credit — the full amount, on your account.`
          : `Your vessel didn't make the call at Santos, so order #${esc(
              d.code
            )} never reached the gangway. Exactly as promised at checkout, your deposit is now credit — the full amount, on your account.`,
        accent: C.amber,
        body:
          table +
          totals(rows) +
          `<p style="margin:16px 0 0;padding:12px 14px;background:#06121F;border:1px solid ${C.line};border-radius:12px;color:${C.faint};font-size:13px;line-height:1.55">
             The credit never expires and works on any future call at Santos. It comes off your next deposit on its own — nothing to claim, nothing to send us.
           </p>`,
        ctaLabel: "Order for your next call",
        ctaHref: `${site}/shop`,
        siteUrl: site,
      }),
      text: [
        `${ship || "Your vessel"} skipped the call — order #${d.code}`,
        ``,
        `No paperwork, ${who}.`,
        ``,
        ship
          ? `${ship} didn't make the call at Santos, so order #${d.code} never reached the gangway.`
          : `Your vessel didn't make the call at Santos, so order #${d.code} never reached the gangway.`,
        `Exactly as promised at checkout, your deposit is now credit — the full amount.`,
        ``,
        textItems,
        ``,
        `  Deposit you had paid   ${usd(n(d.deposit_usd))}`,
        `  Held as credit         ${usd(n(d.deposit_usd))}`,
        ``,
        `The credit never expires and works on any future call at Santos.`,
        `It comes off your next deposit on its own — nothing to claim.`,
        ``,
        `${site}/shop`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  // delivered
  const rows =
    money("Subtotal", usd(n(d.subtotal_usd))) +
    (credit > 0 ? money("Captain credit applied", `−${usd(credit)}`, false, C.teal) : "") +
    money("Paid in full", usd(Math.max(0, n(d.subtotal_usd) - credit)), true, C.teal);

  return {
    subject: `Delivered on board — order #${d.code}`,
    html: shell({
      kicker: "DELIVERED",
      title: `Fair winds, ${who}.`,
      lead: d.has_photo
        ? `Handed over${
            ship ? ` at <b style="color:${C.ink}">${esc(ship)}</b>` : ""
          }. The delivery photo is on your order page — it stays there as your proof.`
        : `Handed over${
            ship ? ` at <b style="color:${C.ink}">${esc(ship)}</b>` : ""
          }. Your receipt is on the order page.`,
      accent: C.teal,
      body:
        table +
        totals(rows) +
        `<p style="margin:16px 0 0;padding:12px 14px;background:#06121F;border:1px solid ${C.line};border-radius:12px;color:${C.faint};font-size:13px;line-height:1.55">
           🧢 <b style="color:${C.amber}">Captains earn.</b> Share your code with the next crew — you get credit on their first order, they skip the queue.
         </p>`,
      ctaLabel: d.has_photo ? "See delivery photo" : "See receipt",
      ctaHref: href,
      siteUrl: site,
    }),
    text: [
      `Delivered on board — order #${d.code}`,
      ``,
      `Fair winds, ${who}.`,
      ship ? `Vessel: ${ship}` : "",
      ``,
      textItems,
      ``,
      `Paid in full: ${usd(Math.max(0, n(d.subtotal_usd) - credit))}`,
      d.has_photo ? `Delivery photo on your order page.` : "",
      ``,
      `Order: ${href}`,
      `Captains earn: share your code with the next crew and get credit on their first order.`,
      ``,
      `At Gangway — Porto de Santos.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
