/**
 * Transporte SMTP dos e-mails transacionais.
 *
 * Usa o mesmo servidor que já autentica os e-mails de conta
 * (Hostinger, help@atgangway.com), então SPF/DKIM do domínio valem
 * para tudo que sai daqui — nada de remetente emprestado que cai em
 * spam de tripulação.
 *
 * Sem SMTP configurado o app não quebra: emailConfigured() responde
 * false e o disparo vira no-op silencioso. O pedido continua andando;
 * o e-mail é acessório do fluxo, não pré-requisito.
 *
 * As variáveis são lidas A CADA CHAMADA, nunca no topo do módulo:
 * const de módulo congela o que existia quando o bundle foi avaliado, e
 * segredo cadastrado como *sensitive* na Vercel não chega ao build — a
 * constante nasceria false e ficaria false com o SMTP ali, configurado.
 * Foi exatamente o que aconteceu com a chave do Stripe.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { escapeEmailText } from "./email-text.ts";
import { SITE_URL, CONTACT_EMAIL } from "./env.ts";
import { buildOrderEmail, type OrderEmailData } from "./emails.ts";
import { medir } from "./metricas.ts";

const conf = () => ({
  host: process.env.SMTP_HOST,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  port: Number(process.env.SMTP_PORT ?? 465),
  from: process.env.SMTP_FROM ?? `At Gangway <${CONTACT_EMAIL}>`,
});

export const emailConfigured = () => {
  const c = conf();
  return Boolean(c.host && c.user && c.pass);
};

let cached: Transporter | null = null;

/** Devolve null quando falta configuração — o chamador decide o que fazer. */
function transport(): Transporter | null {
  if (cached) return cached;
  const { host: HOST, user: USER, pass: PASS, port: PORT } = conf();
  if (!HOST || !USER || !PASS) return null;

  cached = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth: { user: USER, pass: PASS },
    // Apertado de propósito: o webhook do Stripe precisa responder em
    // menos de 10s ou o evento conta como falho. Estourar aqui devolve
    // a reivindicação e o Stripe reentrega — sem e-mail perdido e sem
    // webhook vermelho.
    connectionTimeout: 5000,
    greetingTimeout: 4000,
    socketTimeout: 8000,
  });
  return cached;
}

export type SendResult = { sent: boolean; skipped?: string; error?: string };

export async function sendMail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const smtp = transport();
  if (!smtp) return { sent: false, skipped: "smtp_not_configured" };
  if (!msg.to || !msg.to.includes("@")) return { sent: false, skipped: "no_recipient" };
  const inicio = Date.now();
  try {
    await smtp.sendMail({
      from: conf().from,
      to: msg.to,
      replyTo: CONTACT_EMAIL,
      subject: msg.subject,
      html: msg.html || `<pre style="font: 14px/1.5 ui-monospace, monospace">${escapeEmailText(msg.text)}</pre>`,
      text: msg.text,
    });
    medir("email.envio_ms", Date.now() - inicio, { resultado: "enviado" });
    return { sent: true };
  } catch (e) {
    // A mensagem do erro SMTP não vira tag: ela varia com o servidor e
    // com o destinatário. O que importa medir é que não saiu.
    medir("email.envio_ms", Date.now() - inicio, { resultado: "falhou" });
    return { sent: false, error: (e as Error).message };
  }
}

/**
 * Reivindica o envio no banco, monta e manda. Se o SMTP falhar,
 * devolve a reivindicação para que a próxima tentativa (retry do
 * Stripe, ou o admin clicando de novo) possa reenviar.
 *
 * O `rpc` entra por parâmetro porque quem chama tem um cliente
 * Supabase diferente: o webhook usa anon+segredo, o painel usa a
 * sessão do admin.
 */
export async function sendOrderEmail(
  rpc: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- adaptador
    // estrutural: aceita tanto o cliente tipado (createClient<Database>, cujo
    // rpc só aceita nomes do schema) quanto o cliente cru do webhook.
    rpc: (fn: any, args?: any) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  orderId: string,
  kind: OrderEmailData["kind"],
  secret?: string
): Promise<SendResult> {
  const args = { p_order: orderId, p_kind: kind, ...(secret ? { p_secret: secret } : {}) };

  const { data, error } = await rpc.rpc("claim_order_email", args);
  if (error) return { sent: false, error: "claim_failed" };

  const claim = data as (OrderEmailData & { claimed?: boolean; reason?: string }) | null;
  if (!claim?.claimed) return { sent: false, skipped: claim?.reason ?? "not_claimed" };

  const built = buildOrderEmail({ ...claim, kind }, SITE_URL);
  const result = await sendMail({
    to: claim.to_email,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  // Aviso para a OPERAÇÃO no momento que o dinheiro entra. Sem isto o
  // Gustavo só descobria o pedido abrindo o /admin — e a resposta dele a
  // "como vamos acompanhar tudo?" começa por: o pedido te procura, não o
  // contrário. Depois do e-mail do cliente e fora do caminho de erro:
  // aviso interno que falha não pode derrubar nem repetir o e-mail do
  // marinheiro (o claim é único por pedido).
  if (kind === "deposit_paid" && result.sent) {
    const linhas = (claim.items ?? [])
      .map((i) => `${i.qty}x ${i.name}`)
      .join("\n");
    await sendMail({
      to: CONTACT_EMAIL,
      subject: `⚓ New order #${claim.code} — ${claim.ship_name ?? "no vessel"} · deposit paid`,
      text:
        `Order #${claim.code}\n` +
        `Vessel: ${claim.ship_name ?? "—"}${claim.ship_berth ? ` · berth ${claim.ship_berth}` : ""}\n` +
        `ETA: ${claim.ship_eta ?? "—"}\n` +
        `Subtotal: $${Number(claim.subtotal_usd ?? 0).toFixed(2)} · ` +
        `deposit $${Number(claim.deposit_usd ?? 0).toFixed(2)} · ` +
        `balance $${Number(claim.balance_usd ?? 0).toFixed(2)}\n\n` +
        `${linhas}\n\n${SITE_URL}/admin`,
      // Aviso operacional é texto puro de propósito — <pre> preserva o
      // alinhamento e nenhum cliente de e-mail tem como quebrá-lo.
      html: "",
    }).catch(() => {
      // aviso interno é melhor-esforço; o log de order_email já conta a história
    });
  }

  if (!result.sent) {
    await rpc.rpc("release_order_email", args);
  }

  // E-mail que falha calado é o pior modo de falha aqui: o pedido
  // segue certo e ninguém descobre que o marinheiro nunca soube.
  // O log vai para o runtime da Vercel — sem endereço, que é dado
  // do cliente e não tem por que ficar em log.
  console.log(
    JSON.stringify({
      at: "order_email",
      kind,
      order: orderId,
      sent: result.sent,
      ...(result.skipped ? { skipped: result.skipped } : {}),
      ...(result.error ? { error: result.error } : {}),
    })
  );

  return result;
}
