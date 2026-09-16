/**
 * Os e-mails de CONTA — todos os que o Auth do Supabase pode mandar.
 *
 * Eles são o ponto cego da loja: quem manda é o Auth do Supabase, a
 * partir de um HTML guardado na configuração do projeto. Deploy não
 * alcança, build não vê, nenhum teste tocava. O resultado apareceu na
 * caixa de entrada do dono: o e-mail de confirmação ainda assinava o
 * nome ANTIGO da marca, meses depois da troca, em todo cadastro novo —
 * enquanto o arquivo versionado já dizia o certo.
 *
 * O arquivo continua não sendo a verdade (a verdade está no projeto,
 * e só `scripts/aplicar-templates-email.mjs` a muda). Mas pelo menos
 * ele para de mentir: aqui se garante que o JSON commitado é
 * exatamente o que o gerador produz hoje, e que o que ele produz tem
 * as peças sem as quais o e-mail não serve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CAMINHO = "supabase/templates/email-templates.json";
/** Os nomes que a loja já teve. Nenhum pode chegar ao cliente. */
const NOMES_ANTIGOS = /mariner|vessel ?supplier/i;
const tpl = JSON.parse(readFileSync(CAMINHO, "utf-8"));

/* Todo e-mail que o Supabase sabe mandar. Se ele ganhar um tipo novo,
   entra aqui — e o teste abaixo exige que o gerador o cubra. */
const TIPOS = [
  "confirmation", "recovery", "email_change", "magic_link", "invite", "reauthentication",
  "password_changed_notification", "email_changed_notification", "phone_changed_notification",
  "identity_linked_notification", "identity_unlinked_notification",
  "mfa_factor_enrolled_notification", "mfa_factor_unenrolled_notification",
];
const CORPOS = TIPOS.map((t) => `mailer_templates_${t}_content`);

test("o JSON commitado é o que o gerador produz — sem desvio à mão", async () => {
  const { execFileSync } = await import("node:child_process");
  // O gerador tem modo de conferência justamente para isto: ele compara
  // e sai diferente de zero se o arquivo tiver sido editado à mão.
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/gerar-templates-email.mjs", "--conferir"],
    { stdio: "pipe" }
  );
});

test("a marca certa, e a antiga em lugar nenhum", () => {
  const tudo = JSON.stringify(tpl);
  assert.ok(
    !NOMES_ANTIGOS.test(tudo),
    "um nome antigo da marca voltou ao template de e-mail de conta"
  );
  assert.equal(tpl.smtp_sender_name, "At Gangway");
  for (const t of TIPOS) {
    assert.match(tpl[`mailer_subjects_${t}`] ?? "", /At Gangway/, `assunto de ${t} deve nomear a loja`);
  }
});

test("todo e-mail de conta tem assunto e corpo gerados — nenhum fica com o texto cru do Supabase", () => {
  for (const t of TIPOS) {
    assert.ok(tpl[`mailer_subjects_${t}`], `falta o assunto de ${t}`);
    assert.ok(tpl[`mailer_templates_${t}_content`], `falta o corpo de ${t}`);
  }
});

test("todos usam a mesma casca da loja", () => {
  for (const k of CORPOS) {
    const html = tpl[k];
    assert.match(html, /⚓ AT GANGWAY/, `${k} sem o cabeçalho da casca`);
    assert.match(html, /At Gangway — Porto de Santos\./, `${k} sem o rodapé da casca`);
    assert.match(html, /At Gangway/, `${k} não nomeia a loja no corpo`);
  }
});

test("cada e-mail leva o link que ele existe para entregar", () => {
  // Sem o token o link não confirma nada, e o e-mail vira um botão que
  // devolve "invalid or expired" — o defeito mais caro possível aqui,
  // porque tranca a pessoa do lado de fora no primeiro contato.
  assert.match(
    tpl.mailer_templates_confirmation_content,
    /auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=email/,
    "o e-mail de confirmação perdeu o token ou o tipo"
  );
  assert.match(
    tpl.mailer_templates_recovery_content,
    /auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=recovery&next=\/reset-password/,
    "o e-mail de senha perdeu o token, o tipo ou o destino"
  );
  const links = {
    email_change: /auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=email_change&next=\{\{ \.RedirectTo \}\}/,
    magic_link: /auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=email&next=\{\{ \.RedirectTo \}\}/,
    invite: /auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=invite&next=\/reset-password/,
  };
  for (const [t, re] of Object.entries(links)) {
    assert.match(tpl[`mailer_templates_${t}_content`], re, `${t} perdeu o token, o tipo ou o destino`);
  }
  // o código É o conteúdo do e-mail de verificação, no corpo e no assunto
  assert.match(tpl.mailer_templates_reauthentication_content, /\{\{ \.Token \}\}/);
  assert.match(tpl.mailer_subjects_reauthentication, /\{\{ \.Token \}\}/);
  // nenhum usa o ConfirmationURL cru, que pula o /auth/confirm da loja
  for (const k of CORPOS) assert.doesNotMatch(tpl[k], /ConfirmationURL/, `${k} usa ConfirmationURL`);
});

test("todos se declaram escuros, como o resto dos e-mails", () => {
  // Mesmo motivo de tests/emails.test.mjs: sem isto o Gmail reescreve
  // as cores por conta própria e some com frases inteiras.
  for (const k of CORPOS) {
    assert.match(tpl[k], /<meta name="color-scheme" content="dark">/, `${k} sem color-scheme`);
  }
});

test("nenhuma frase depois de <br> fica pendurada em cor herdada", () => {
  for (const k of CORPOS) {
    for (const m of tpl[k].matchAll(/<br>\s*([^<]*)</g)) {
      assert.equal(m[1].trim(), "", `${k}: texto solto depois de <br> — ${m[1].trim().slice(0, 50)}`);
    }
  }
});
