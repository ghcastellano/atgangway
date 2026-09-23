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
        `console.log(JSON.stringify({ c: m.supabaseConfigured, u: m.SUPABASE_URL, s: m.SITE_URL, n: m.SUPABASE_URL_NAVEGADOR }));`,
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

/* A retaguarda deixou de ser o domínio customizado do Auth:
   ele caiu no instante em que outro domínio customizado entrou em verificação
   no mesmo projeto, e levou junto as fotos e a API do navegador. O endereço
   nativo do projeto não depende de domínio customizado nenhum. */
test("na Vercel, painel em branco cai para os valores públicos de produção", () => {
  const m = carrega({ ...LIMPO, NEXT_PUBLIC_ON_VERCEL: "1" });
  assert.equal(m.c, true);
  assert.equal(m.u, "https://cuaocjxofaizefzcxlyc.supabase.co");
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

/* O proxy do Supabase pelo domínio da loja.
 *
 * Existe para o cliente não ver "supabase.co" em requisição nenhuma, no
 * lugar do add-on de US$ 10/mês. O contrato tem dois lados, e os dois
 * importam: desligado, navegador e servidor falam o mesmo endereço (é o
 * comportamento de sempre); ligado, SÓ o navegador muda — se o servidor
 * migrasse junto, cada consulta viraria uma função da Vercel chamando o
 * próprio site para chegar ao banco. */
test("sem o proxy, navegador e servidor usam o mesmo endereço", () => {
  const m = carrega({
    ...LIMPO,
    NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
  });
  assert.equal(m.n, m.u);
  assert.equal(m.n, "https://exemplo.supabase.co");
});

test("com o proxy, o navegador usa o domínio da loja e o servidor não", () => {
  const m = carrega({
    ...LIMPO,
    NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
    NEXT_PUBLIC_SITE_URL: "https://atgangway.com",
    NEXT_PUBLIC_SUPABASE_PROXY: "1",
  });
  assert.equal(m.n, "https://atgangway.com");
  assert.equal(m.u, "https://exemplo.supabase.co");
});

test("o proxy só liga com o valor exato 1 — nada de string qualquer virar true", () => {
  for (const valor of ["", "0", "true", "sim"]) {
    const m = carrega({
      ...LIMPO,
      NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      NEXT_PUBLIC_SITE_URL: "https://atgangway.com",
      NEXT_PUBLIC_SUPABASE_PROXY: valor,
    });
    assert.equal(m.n, "https://exemplo.supabase.co", `valor ${JSON.stringify(valor)} não devia ligar o proxy`);
  }
});

test("proxy ligado sem backend configurado não inventa endereço", () => {
  const m = carrega({ ...LIMPO, NEXT_PUBLIC_SUPABASE_PROXY: "1" });
  assert.equal(m.c, false);
  assert.equal(m.n, "");
});

/* O repasse para o Supabase não pode passar pelo middleware.
 *
 * O matcher do proxy.ts captura quase tudo. Se os caminhos do rewrite
 * entrassem nele, cada consulta ao banco dispararia um getUser() — uma
 * ida EXTRA ao Supabase para autenticar a própria ida ao Supabase.
 * Dobraria a conta da Vercel e a latência de tudo que o navegador pede,
 * e nada no teste de integração denunciaria isso. */
test("o matcher do middleware não pega os caminhos repassados ao Supabase", async () => {
  const { readFileSync } = await import("node:fs");
  const origem = readFileSync(
    fileURLToPath(new URL("../proxy.ts", import.meta.url)),
    "utf-8"
  );
  const m = origem.match(/"\/\(\(\?!([^"]+)\)\.\*\)"/);
  assert.ok(m, "matcher do proxy.ts não encontrado");
  for (const caminho of ["auth/v1", "rest/v1", "storage/v1"]) {
    assert.ok(
      m[1].includes(caminho),
      `${caminho} precisa estar fora do middleware — senão cada consulta vira dois getUser()`
    );
  }
});
