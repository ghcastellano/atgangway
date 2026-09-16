/**
 * Gera os templates de e-mail de CONTA que moram no Supabase.
 *
 *   node scripts/gerar-templates-email.mjs            # regrava o JSON
 *   node scripts/gerar-templates-email.mjs --conferir # só compara (usado no teste)
 *
 * Por que existe
 * -------------
 * Os e-mails de conta (confirmar cadastro, redefinir senha, trocar
 * e-mail, convite, link de acesso, código de verificação e os avisos de
 * segurança) são os únicos da loja que NÃO saem do nosso servidor: quem
 * manda é o Auth do Supabase, a partir de um HTML guardado no projeto —
 * fora do repositório, fora do build, fora de qualquer teste.
 *
 * O preço disso já foi cobrado. O HTML no ar ainda assinava o nome
 * antigo da loja meses depois da troca de marca, em todo cadastro novo,
 * e ninguém viu porque não havia onde ver: o arquivo versionado dizia
 * uma coisa e o projeto mandava outra. Aqui os dois passam a ter uma
 * origem só — a mesma casca dos e-mails transacionais (lib/emails.ts) —
 * e um teste reprova se o JSON commitado sair de sincronia.
 *
 * Aplicar no projeto é outro passo, e é manual de propósito:
 * `scripts/aplicar-templates-email.mjs`, que precisa de um token
 * pessoal.
 *
 * As chaves do JSON são os nomes de campo da Management API do
 * Supabase (PATCH /v1/projects/{ref}/config/auth), não uma invenção
 * nossa — o script de aplicar manda este objeto como está.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { shell } from "../lib/emails.ts";

const SITE = "https://atgangway.com";
const DESTINO = "supabase/templates/email-templates.json";

/* O `{{ .Variavel }}` é do template Go do Supabase, substituído por ele
   no envio. `{{ .SiteURL }}` já vem com a barra no fim — a concatenação
   abaixo é literalmente o que o link tem de virar.

   O `&` fica cru, e não como `&amp;`, porque é exatamente a forma que
   está no ar e funciona hoje. Trocar por `&amp;` é mais correto em
   HTML e não dá para verificar daqui sem disparar um cadastro de
   verdade — e link de confirmação quebrado tranca gente do lado de
   fora da loja. Não é o lugar de arriscar por elegância. */
const rota = (tipo, next) =>
  `{{ .SiteURL }}auth/confirm?token_hash={{ .TokenHash }}&type=${tipo}` +
  (next ? `&next=${next}` : "");

/**
 * O plano B do botão, para o cliente de e-mail que não renderiza <a>
 * como botão — ou para quem abre o e-mail num aparelho e quer terminar
 * noutro. Vai no `nota`, depois do botão: antes dele responderia uma
 * pergunta que a pessoa ainda não fez.
 */
function alternativa(href) {
  return `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #16304F;color:#8CA3BC;font-size:12px;line-height:1.6">
          <span style="color:#8CA3BC">Button not working? Copy this link into your browser:</span><br>
          <a href="${href}" style="color:#FFB648;word-break:break-all;text-decoration:none">${href}</a>
        </p>`;
}

/** Caixa de destaque do miolo: um título curto e uma frase. */
function destaque(titulo, texto) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0">
          <tr><td style="padding:14px 16px;background:#06121F;border:1px solid #16304F;border-radius:12px">
            <p style="margin:0 0 4px;color:#EAF2FB;font-size:13.5px;font-weight:700">${titulo}</p>
            <p style="margin:0;color:#8CA3BC;font-size:13px;line-height:1.55">${texto}</p>
          </td></tr>
        </table>`;
}

const confirmacao = shell({
  kicker: "WELCOME ABOARD",
  title: "Welcome aboard, sailor ⚓",
  lead:
    `Confirm your e-mail to activate your <b style="color:#EAF2FB">At Gangway</b> account — ` +
    `after that, every kit you order rides with your ship's ETA into Santos.`,
  accent: "#FFB648",
  body: destaque(
    "One tap and you're aboard.",
    "Pre-order before you dock, pay a 30% deposit, collect at the gangway. " +
      "If your ship skips Santos, the deposit becomes full credit."
  ),
  ctaLabel: "Confirm my email",
  ctaHref: rota("email", "{{ .RedirectTo }}"),
  nota: alternativa(rota("email", "{{ .RedirectTo }}")),
  siteUrl: SITE,
});

const recuperacao = shell({
  kicker: "PASSWORD RESET",
  title: "Reset your password",
  lead:
    `Happens at sea. Tap below to set a new password for your ` +
    `<b style="color:#EAF2FB">At Gangway</b> account. The link works once and expires soon.`,
  accent: "#FFB648",
  body: destaque(
    "Didn't ask for this?",
    "Then ignore this e-mail — your password stays exactly as it is, and the link below dies on its own."
  ),
  ctaLabel: "Reset my password",
  ctaHref: rota("recovery", "/reset-password"),
  nota: alternativa(rota("recovery", "/reset-password")),
  siteUrl: SITE,
});

/* ---- os outros e-mails de conta ------------------------------------
   Confirmar e redefinir eram os únicos com a casca da loja. Os outros
   onze eram o HTML cru do Supabase — um <h2> e um link, sem marca —
   e ninguém percebia porque quase não saem: a loja não usa link mágico
   nem convite, e os avisos de segurança estão desligados. Mas "quase
   não sai" é exatamente como o nome antigo da marca sobreviveu meses
   no e-mail de confirmação. Todo e-mail que o projeto PODE mandar ao
   cliente sai daqui, com a mesma cara. */

const acoes = {
  email_change: {
    kicker: "NEW EMAIL",
    title: "Confirm your new email",
    lead:
      `Tap below to make <b style="color:#EAF2FB">{{ .NewEmail }}</b> the e-mail of your ` +
      `<b style="color:#EAF2FB">At Gangway</b> account.`,
    body: destaque(
      "Didn't ask for this?",
      "Then ignore this e-mail — your account keeps the address it has now."
    ),
    cta: "Confirm new email",
    href: rota("email_change", "{{ .RedirectTo }}"),
    assunto: "Confirm your new email — At Gangway",
  },
  magic_link: {
    kicker: "SIGN IN",
    title: "Your sign-in link",
    lead:
      `Tap below to sign in to <b style="color:#EAF2FB">At Gangway</b>. ` +
      `The link works once and expires soon.`,
    body: destaque(
      "Didn't ask for this?",
      "Then ignore this e-mail — nobody gets in without this link."
    ),
    cta: "Sign me in",
    href: rota("email", "{{ .RedirectTo }}"),
    assunto: "Your sign-in link — At Gangway",
  },
  invite: {
    kicker: "YOU'RE INVITED",
    title: "Welcome aboard ⚓",
    lead:
      `An <b style="color:#EAF2FB">At Gangway</b> account was created for you. ` +
      `Tap below and choose your password to finish.`,
    body: destaque(
      "Pre-order before you dock.",
      "Pay a 30% deposit, collect at the gangway. If your ship skips Santos, the deposit becomes full credit."
    ),
    cta: "Accept and set my password",
    // direto para criar a senha: a conta existe, a senha não
    href: rota("invite", "/reset-password"),
    assunto: "You're invited — At Gangway",
  },
};

/** O código de verificação: sem botão, o código É o conteúdo. */
const reautenticacao = shell({
  kicker: "VERIFICATION CODE",
  title: "Your verification code",
  lead: `Use this code to confirm it's you on <b style="color:#EAF2FB">At Gangway</b>. It expires soon.`,
  accent: "#FFB648",
  body: `<p style="margin:0;padding:16px;background:#06121F;border:1px solid #16304F;border-radius:12px;text-align:center;color:#EAF2FB;font-size:28px;font-weight:800;letter-spacing:6px;font-family:ui-monospace,Menlo,Consolas,monospace">{{ .Token }}</p>`,
  nota: `<p style="margin:18px 0 0;color:#8CA3BC;font-size:12px;line-height:1.6">Didn't ask for this? Someone may have your password — reset it from the sign-in page.</p>`,
  siteUrl: SITE,
});

/* Avisos de segurança: todos com o mesmo fecho, porque a pergunta de
   quem recebe é sempre a mesma — "fui eu?". O botão responde o "não". */
const aviso = (titulo, frase, assunto) => ({
  html: shell({
    kicker: "ACCOUNT SECURITY",
    title: titulo,
    lead: frase,
    accent: "#FFB648",
    body: destaque(
      "Wasn't you?",
      "Reset your password right away and reply to this e-mail — we'll help you lock the account."
    ),
    ctaLabel: "Reset my password",
    ctaHref: "{{ .SiteURL }}forgot-password",
    siteUrl: SITE,
  }),
  assunto,
});

const b = (t) => `<b style="color:#EAF2FB">${t}</b>`;
const avisos = {
  password_changed_notification: aviso(
    "Your password was changed",
    `The password of your At Gangway account ${b("{{ .Email }}")} was just changed.`,
    "Your password was changed — At Gangway"
  ),
  email_changed_notification: aviso(
    "Your email was changed",
    `Your At Gangway account moved from ${b("{{ .OldEmail }}")} to ${b("{{ .Email }}")}.`,
    "Your email was changed — At Gangway"
  ),
  phone_changed_notification: aviso(
    "Your phone number was changed",
    `The phone on your At Gangway account changed from ${b("{{ .OldPhone }}")} to ${b("{{ .Phone }}")}.`,
    "Your phone number was changed — At Gangway"
  ),
  identity_linked_notification: aviso(
    "New sign-in method linked",
    `${b("{{ .Provider }}")} can now be used to sign in to ${b("{{ .Email }}")}.`,
    "New sign-in method linked — At Gangway"
  ),
  identity_unlinked_notification: aviso(
    "Sign-in method removed",
    `${b("{{ .Provider }}")} can no longer be used to sign in to ${b("{{ .Email }}")}.`,
    "Sign-in method removed — At Gangway"
  ),
  mfa_factor_enrolled_notification: aviso(
    "Verification method added",
    `A ${b("{{ .FactorType }}")} verification method was added to your At Gangway account.`,
    "Verification method added — At Gangway"
  ),
  mfa_factor_unenrolled_notification: aviso(
    "Verification method removed",
    `A ${b("{{ .FactorType }}")} verification method was removed from your At Gangway account.`,
    "Verification method removed — At Gangway"
  ),
};

/* `smtp_sender_name` entra junto porque o defeito era dos DOIS lados:
   o corpo dizia o nome antigo e o remetente também. Corrigir só um
   deixa a caixa de entrada ainda mostrando a marca errada na lista,
   que é o que se lê antes de abrir.

   Só os TEXTOS dos avisos de segurança vêm daqui; ligá-los ou não
   (`mailer_notifications_*_enabled`) é decisão de produto e fica no
   painel do Supabase. */
const config = {
  smtp_sender_name: "At Gangway",
  mailer_subjects_confirmation: "Confirm your email — At Gangway",
  mailer_templates_confirmation_content: confirmacao,
  mailer_subjects_recovery: "Reset your password — At Gangway",
  mailer_templates_recovery_content: recuperacao,
};
for (const [nome, a] of Object.entries(acoes)) {
  config[`mailer_subjects_${nome}`] = a.assunto;
  config[`mailer_templates_${nome}_content`] = shell({
    kicker: a.kicker,
    title: a.title,
    lead: a.lead,
    accent: "#FFB648",
    body: a.body,
    ctaLabel: a.cta,
    ctaHref: a.href,
    nota: alternativa(a.href),
    siteUrl: SITE,
  });
}
config.mailer_subjects_reauthentication = "{{ .Token }} is your At Gangway code";
config.mailer_templates_reauthentication_content = reautenticacao;
for (const [nome, a] of Object.entries(avisos)) {
  config[`mailer_subjects_${nome}`] = a.assunto;
  config[`mailer_templates_${nome}_content`] = a.html;
}

const texto = JSON.stringify(config, null, 2) + "\n";

if (process.argv.includes("--conferir")) {
  const atual = readFileSync(DESTINO, "utf-8");
  if (atual !== texto) {
    console.error(
      `${DESTINO} está fora de sincronia com o gerador.\n` +
        `Rode: node scripts/gerar-templates-email.mjs`
    );
    process.exit(1);
  }
  console.log(`${DESTINO} em dia.`);
} else {
  writeFileSync(DESTINO, texto);
  console.log(`${DESTINO} regravado (${texto.length} bytes).`);
}
