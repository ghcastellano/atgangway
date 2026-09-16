/**
 * A voz da autenticação (lib/authmsg.ts).
 *
 * Prega três coisas: cada código da URL vira a frase certa, texto livre
 * na URL NUNCA chega à tela, e as rotas mandam código — não frase.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { authUrlMessage, loginErrorPath, signInFailure, signInMessage } = await import(
  "../lib/authmsg.ts"
);

test("sem erro na URL, nada a mostrar", () => {
  assert.equal(authUrlMessage(null), null);
  assert.equal(authUrlMessage(""), null);
});

test("link gasto de confirmação diz que a conta está ativa, não manda pedir outro", () => {
  const m = authUrlMessage("link_used");
  assert.match(m, /account is confirmed/);
  assert.doesNotMatch(m, /request a new/i);
});

test("link de redefinição gasto manda pedir outro", () => {
  assert.match(authUrlMessage("reset_expired"), /Request a new one/);
});

test("outro navegador, link ruim e Google têm frase própria", () => {
  assert.match(authUrlMessage("other_browser"), /different browser/);
  assert.match(authUrlMessage("bad_link"), /invalid or expired/);
  assert.match(authUrlMessage("google_cancelled"), /cancelled/);
  assert.match(authUrlMessage("google_failed"), /Google sign-in failed/);
});

test("texto livre na URL nunca é exibido", () => {
  const isca = "Your account is locked. Call +1 555 0100 to unlock.";
  const m = authUrlMessage(isca);
  assert.notEqual(m, isca);
  assert.equal(m, authUrlMessage("bad_link"));
  // nome de propriedade herdada também não é código
  assert.equal(authUrlMessage("toString"), authUrlMessage("bad_link"));
});

test("o destino de erro leva só o código", () => {
  assert.equal(loginErrorPath("link_used"), "/login?error=link_used");
});

test("a recusa do login é lida pelo código do Supabase", () => {
  assert.equal(signInFailure({ code: "email_not_confirmed", message: "x" }), "unconfirmed");
  assert.equal(signInFailure({ code: "invalid_credentials", message: "x" }), "invalid");
  assert.equal(signInFailure({ code: "over_request_rate_limit", message: "Too many" }), "other");
});

test("sem código, o texto do Supabase ainda serve de retaguarda", () => {
  assert.equal(signInFailure({ message: "Email not confirmed" }), "unconfirmed");
  assert.equal(signInFailure({ message: "Invalid login credentials" }), "invalid");
  // "invalid" solto não é senha errada — era o que o regex antigo achava
  assert.equal(signInFailure({ message: "Invalid email format" }), "other");
});

test("cada recusa conhecida tem frase; a desconhecida devolve null", () => {
  assert.match(signInMessage("unconfirmed"), /isn't confirmed/);
  assert.match(signInMessage("invalid"), /Wrong email or password/);
  assert.equal(signInMessage("other"), null);
});

test("nenhuma rota escreve frase na query string de /login", () => {
  for (const f of ["app/auth/confirm/route.ts", "app/auth/callback/route.ts"]) {
    const src = readFileSync(f, "utf-8");
    assert.match(src, /loginErrorPath\(/, `${f} deveria montar o erro por loginErrorPath`);
    assert.doesNotMatch(
      src,
      /login\?error=\$\{encodeURIComponent/,
      `${f} voltou a mandar frase pela URL`
    );
  }
});
