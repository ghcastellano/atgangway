/**
 * A retaguarda de env pertence à Vercel — e a mais lugar nenhum.
 *
 * O contrato tem três lados: (1) na Vercel, painel em branco ("") cai
 * para os valores públicos de produção — foi um "" passando por `??`
 * que derrubou o deploy com Invalid URL; (2) fora dela, env ausente NÃO
 * cai para produção — rodar `npm run dev` sem .env.local escrevia no
 * banco de produção sem avisar; (3) valor explícito ganha sempre.
 *
 * O módulo lê process.env no import, então cada caso roda num processo
 * filho com o ambiente montado do zero.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const lib = fileURLToPath(new URL("../lib/env.ts", import.meta.url));

function carrega(env) {
  const out = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `const m = await import(${JSON.stringify("file://" + lib)});` +
        `console.log(JSON.stringify({ c: m.supabaseConfigured, u: m.SUPABASE_URL, s: m.SITE_URL }));`,
    ],
    // PATH e afins continuam; só as chaves do contrato são controladas.
    { env: { ...process.env, ...env }, encoding: "utf-8" }
  );
  return JSON.parse(out.trim().split("\n").pop());
}

const LIMPO = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SITE_URL: "",
  NEXT_PUBLIC_ON_VERCEL: "",
};

test("fora da Vercel, sem env: NÃO configurado — nada de cair em produção", () => {
  const m = carrega(LIMPO);
  assert.equal(m.c, false);
  assert.equal(m.u, "");
});

test("na Vercel, painel em branco cai para os valores públicos de produção", () => {
  const m = carrega({ ...LIMPO, NEXT_PUBLIC_ON_VERCEL: "1" });
  assert.equal(m.c, true);
  assert.equal(m.u, "https://auth.marinerssupplyco.com");
});

test("valor explícito ganha da retaguarda, dentro e fora da Vercel", () => {
  const url = "https://exemplo.supabase.co";
  for (const flag of ["", "1"]) {
    const m = carrega({ ...LIMPO, NEXT_PUBLIC_ON_VERCEL: flag, NEXT_PUBLIC_SUPABASE_URL: url });
    assert.equal(m.u, url);
  }
});

test("SITE_URL tem retaguarda incondicional: o metadataBase precisa de URL válida em qualquer build", () => {
  const m = carrega(LIMPO);
  assert.equal(m.s, "https://atgangway.com");
  assert.doesNotThrow(() => new URL(m.s));
});
