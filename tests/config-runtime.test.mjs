/**
 * Segredo se lê na hora de usar, não quando o módulo carrega.
 *
 * O defeito que originou este arquivo: `lib/stripe.ts` tinha
 * `export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)`
 * no topo do módulo. Variável cadastrada como *sensitive* na Vercel não
 * chega ao build, então a constante nascia `false` e ficava `false`
 * para sempre — o webhook (que lê dentro do handler) confirmava
 * pagamentos com a chave presente, enquanto o checkout respondia
 * "Online payment isn't enabled yet" para o cliente com o cartão na
 * mão. Dois módulos, a mesma variável, vereditos opostos.
 *
 * O teste não olha o valor: olha o MOMENTO. Se alguém voltar a
 * congelar a leitura num const de módulo, mudar o env depois do import
 * deixa de mudar a resposta — e isto aqui fica vermelho.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { stripeConfigured } = await import("../lib/stripe.ts");
const { emailConfigured } = await import("../lib/mailer.ts");

/** Guarda e restaura o ambiente: teste que suja env envenena os vizinhos. */
function comEnv(valores, fn) {
  const antes = {};
  for (const [k, v] of Object.entries(valores)) {
    antes[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("stripeConfigured lê o ambiente na hora da chamada", () => {
  assert.equal(typeof stripeConfigured, "function", "virou const de módulo de novo");
  comEnv({ STRIPE_SECRET_KEY: undefined }, () => {
    assert.equal(stripeConfigured(), false, "sem chave deveria ser false");
  });
  comEnv({ STRIPE_SECRET_KEY: "sk_test_apareceu_depois_do_import" }, () => {
    assert.equal(
      stripeConfigured(),
      true,
      "chave que aparece depois do import TEM de contar — foi este o bug"
    );
  });
});

test("emailConfigured lê o ambiente na hora da chamada", () => {
  assert.equal(typeof emailConfigured, "function", "virou const de módulo de novo");
  comEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
    assert.equal(emailConfigured(), false);
  });
  comEnv(
    { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "help@atgangway.com", SMTP_PASS: "x" },
    () => {
      assert.equal(emailConfigured(), true, "SMTP que aparece depois do import TEM de contar");
    }
  );
});

test("SMTP pela metade não conta como configurado", () => {
  comEnv({ SMTP_HOST: "smtp.hostinger.com", SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
    assert.equal(emailConfigured(), false, "host sem credencial não manda e-mail nenhum");
  });
});
