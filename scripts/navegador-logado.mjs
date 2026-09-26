#!/usr/bin/env node
/**
 * Abre um Chrome controlável que LEMBRA o login.
 *
 * O Chrome pessoal não serve para automação: ele guarda o perfil sob um
 * lock exclusivo e, no macOS, os cookies são cifrados pela Keychain — copiar
 * o diretório não leva a sessão junto. E derrubá-lo para reabrir com porta de
 * depuração custaria as abas abertas de quem está trabalhando.
 *
 * Então este roteiro mantém um perfil SEPARADO, só para automação, em
 * ~/.atgangway-navegador. Você loga uma vez, à mão, e a sessão fica ali para
 * as próximas execuções.
 *
 *   node scripts/navegador-logado.mjs --login       # abre para você entrar
 *   node scripts/navegador-logado.mjs --conferir    # diz onde já está logado
 *
 * O perfil fica FORA do repositório de propósito: ele contém sessão ativa de
 * contas reais.
 */
import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const PERFIL = join(homedir(), ".atgangway-navegador");

const SITES = [
  { nome: "Supabase", url: "https://supabase.com/dashboard/projects", logado: (u) => !/sign-in|\/login/.test(u) },
  { nome: "Vercel", url: "https://vercel.com/dashboard", logado: (u) => !/login|signup/.test(u) },
];

const modo = process.argv.includes("--conferir") ? "conferir" : "login";

/* --use-mock-keychain e --password-store=basic PRECISAM sair.
 *
 * O Playwright os injeta por padrão para não esbarrar na Keychain do
 * macOS. Só que no macOS os cookies do Chrome são cifrados com a chave
 * "Chrome Safe Storage" que vive justamente na Keychain: com a chave
 * falsa, o navegador abre, lê o arquivo de cookies e decifra tudo como
 * lixo — a sessão copiada simplesmente não existe. */
const ctx = await chromium.launchPersistentContext(PERFIL, {
  channel: "chrome",
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ["--use-mock-keychain", "--password-store=basic"],
  args: ["--start-maximized"],
});

const pag = ctx.pages()[0] || (await ctx.newPage());

if (modo === "conferir") {
  console.log("Onde este perfil já está logado:\n");
  for (const s of SITES) {
    await pag.goto(s.url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await pag.waitForTimeout(3500);
    const ok = s.logado(pag.url());
    console.log(`  ${ok ? "LOGADO    " : "deslogado "} ${s.nome.padEnd(10)} ${pag.url().slice(0, 62)}`);
  }
  await ctx.close();
  process.exit(0);
}

console.log("Chrome aberto com o perfil de automação.");
console.log(`  perfil: ${PERFIL}`);
console.log("");
console.log("Entre com ghcastellano@gmail.com nas abas que abrirem.");
console.log("A sessão fica gravada — nas próximas vezes não precisa de novo.");
console.log("");
console.log("Quando terminar, FECHE a janela do Chrome. Este processo espera.");

await pag.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded" }).catch(() => {});
const p2 = await ctx.newPage();
await p2.goto("https://vercel.com/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
await pag.bringToFront();

// segura o processo até a janela ser fechada
await new Promise((resolve) => ctx.on("close", resolve));
console.log("\nJanela fechada. Sessão gravada no perfil.");
