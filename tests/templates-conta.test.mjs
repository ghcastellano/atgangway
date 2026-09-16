/**
 * Os e-mails de CONTA — confirmar cadastro e redefinir senha.
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
const tpl = JSON.parse(readFileSync(CAMINHO, "utf-8"));

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
    !/mariners/i.test(tudo),
    "o nome antigo da marca voltou ao template de e-mail de conta"
  );
  assert.equal(tpl.smtp_sender_name, "At Gangway");
  for (const k of ["mailer_subjects_confirmation", "mailer_subjects_recovery"]) {
    assert.match(tpl[k], /At Gangway/, `${k} deve nomear a loja`);
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
});

test("os dois se declaram escuros, como o resto dos e-mails", () => {
  // Mesmo motivo de tests/emails.test.mjs: sem isto o Gmail reescreve
  // as cores por conta própria e some com frases inteiras.
  for (const k of ["mailer_templates_confirmation_content", "mailer_templates_recovery_content"]) {
    assert.match(tpl[k], /<meta name="color-scheme" content="dark">/, `${k} sem color-scheme`);
  }
});

test("nenhuma frase depois de <br> fica pendurada em cor herdada", () => {
  for (const k of ["mailer_templates_confirmation_content", "mailer_templates_recovery_content"]) {
    for (const m of tpl[k].matchAll(/<br>\s*([^<]*)</g)) {
      assert.equal(m[1].trim(), "", `${k}: texto solto depois de <br> — ${m[1].trim().slice(0, 50)}`);
    }
  }
});
