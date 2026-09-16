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

const { resolveNext } = await import("../lib/authmsg.ts");
const O = "https://atgangway.com";

test("destino do link: caminho interno e URL do próprio site", () => {
  assert.equal(resolveNext("/orders", O), "/orders");
  assert.equal(resolveNext("https://atgangway.com/shop?x=1", O), "/shop?x=1");
  assert.equal(resolveNext(null, O), "/shop");
});

test("destino do link: nunca sai do site", () => {
  assert.equal(resolveNext("https://evil.example/x", O), "/shop");
  assert.equal(resolveNext("//evil.example", O), "/shop");
});

test("destino do link: /auth/confirm aninhado é desembrulhado", () => {
  // Exatamente o que os e-mails de cadastro carregavam: a conta era
  // confirmada e a pessoa caía em "link inválido".
  assert.equal(resolveNext("https://atgangway.com/auth/confirm?next=/shop", O), "/shop");
  assert.equal(resolveNext("https://atgangway.com/auth/confirm?next=%2Forders", O), "/orders");
  assert.equal(resolveNext("/auth/confirm?next=/checkout", O), "/checkout");
  assert.equal(resolveNext("/auth/confirm", O), "/shop");
  assert.equal(resolveNext("/auth/confirm?next=https://evil.example", O), "/shop");
  assert.equal(
    resolveNext("/auth/confirm?next=%2Fauth%2Fconfirm%3Fnext%3D%252Fauth%252Fconfirm", O),
    "/shop"
  );
});

test("o cadastro e o reenvio mandam o destino final, não /auth/confirm", () => {
  for (const f of ["app/signup/page.tsx", "app/login/page.tsx"]) {
    const src = readFileSync(f, "utf-8");
    assert.doesNotMatch(src, /emailRedirectTo:[^\n]*\/auth\/confirm/, `${f} voltou a aninhar /auth/confirm`);
  }
});
