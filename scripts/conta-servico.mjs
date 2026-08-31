#!/usr/bin/env node
/**
 * Conta de serviço temporária para carga de catálogo.
 *
 * Por que ela precisa existir: o Supabase Storage — onde ficam as fotos
 * dos produtos — autoriza por JWT de usuário, não pela conexão do banco.
 * Quem tem acesso ao banco consegue criar produto, mas não consegue
 * subir foto. Para subir foto é preciso ESTAR LOGADO como admin.
 *
 * E o projeto não tem chave `service_role` de propósito: se houvesse,
 * ela viveria numa variável de ambiente da Vercel e valeria como acesso
 * irrestrito ao banco inteiro para qualquer um que a lesse.
 *
 * Então a carga inicial cria uma conta, usa, e apaga:
 *
 *   node scripts/conta-servico.mjs criar     # cria e imprime o e-mail
 *   # (promover a admin no banco — só quem já é admin consegue)
 *   node scripts/importar-catalogo.mjs docs/catalogo-demo.csv
 *   node scripts/conta-servico.mjs apagar    # some com ela
 *
 * A senha é aleatória, fica só em /tmp/conta-servico.json enquanto a
 * carga roda, e nunca é impressa. `apagar` remove o arquivo junto.
 *
 * Se algo falhar no meio, rode `apagar` mesmo assim: conta de serviço
 * esquecida com papel de admin é uma porta aberta sem dono.
 */

import { randomBytes } from "node:crypto";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";

/**
 * Lê .env.local sem depender de `set -a && . ./.env.local` na frente do
 * comando: comando composto não casa com a regra de permissão, e o
 * script que precisa da variável é quem deve saber onde ela mora.
 */
function carregarEnv(arquivo = ".env.local") {
  try {
    for (const linha of readFileSync(arquivo, "utf-8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const valor = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = valor;
    }
  } catch {
    // sem arquivo: as variáveis podem já vir do ambiente
  }
}
carregarEnv();

const ARQUIVO = "/tmp/conta-servico.json";
const EMAIL = "carga-catalogo@marinerssupply.test";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function morre(msg) {
  console.error(msg);
  process.exit(1);
}
if (!URL_SB || !ANON) morre("faltam NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY");

const acao = process.argv[2];

if (acao === "criar") {
  const senha = randomBytes(24).toString("base64url") + "Aa1!";
  const r = await fetch(`${URL_SB}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: senha }),
  });
  const j = await r.json();
  const id = j.id ?? j.user?.id;
  if (!id) morre(`falhou: HTTP ${r.status} ${JSON.stringify(j).slice(0, 300)}`);

  writeFileSync(ARQUIVO, JSON.stringify({ email: EMAIL, senha, id }), { mode: 0o600 });
  // O id sai para poder ser promovido a admin; a senha, não.
  console.log(`email: ${EMAIL}`);
  console.log(`id:    ${id}`);
  console.log(`\nAgora: promover a admin, rodar a importação, e apagar.`);
} else if (acao === "apagar") {
  // A remoção da conta em si é feita no banco por quem é admin — este
  // comando limpa o rastro local, que é o que fica na máquina.
  if (existsSync(ARQUIVO)) {
    const { id } = JSON.parse(readFileSync(ARQUIVO, "utf-8"));
    unlinkSync(ARQUIVO);
    console.log(`credenciais locais apagadas. Falta remover no banco: ${id}`);
  } else {
    console.log("nada a apagar aqui.");
  }
} else {
  morre("uso: conta-servico.mjs [criar | apagar]");
}
