/**
 * Aplica no projeto do Supabase os templates de e-mail de conta.
 *
 *   export SUPABASE_ACCESS_TOKEN=...      # https://supabase.com/dashboard/account/tokens
 *   node scripts/aplicar-templates-email.mjs            # mostra o que mudaria
 *   node scripts/aplicar-templates-email.mjs --aplicar  # manda
 *
 * Confirmar cadastro e redefinir senha saem do Auth do Supabase, não
 * do nosso servidor: o HTML mora na configuração do projeto. É a única
 * parte da loja que um deploy não alcança — e foi por isso que o nome
 * antigo da marca sobreviveu lá dentro por meses, em todo cadastro
 * novo, enquanto o arquivo versionado já dizia o certo.
 *
 * Roda seco por padrão: primeiro LÊ o que está no ar e mostra campo a
 * campo o que mudaria. Aplicar é `--aplicar`, explícito, porque isto
 * escreve em produção — e no fim relê para provar que entrou, em vez
 * de confiar no 200.
 *
 * O token é pessoal e tem poder sobre o projeto inteiro. Ele entra por
 * variável de ambiente e nunca é impresso.
 */
import { readFileSync } from "node:fs";

const PROJETO = "cuaocjxofaizefzcxlyc";
const API = `https://api.supabase.com/v1/projects/${PROJETO}/config/auth`;
const ORIGEM = "supabase/templates/email-templates.json";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Falta SUPABASE_ACCESS_TOKEN.\n" +
      "Gere um token pessoal em https://supabase.com/dashboard/account/tokens e:\n" +
      "  export SUPABASE_ACCESS_TOKEN=<token>\n" +
      "Não cole o token em chat nem em commit."
  );
  process.exit(1);
}

const aplicar = process.argv.includes("--aplicar");
const desejado = JSON.parse(readFileSync(ORIGEM, "utf-8"));
const cabecalho = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function ler() {
  const r = await fetch(API, { headers: cabecalho });
  if (!r.ok) {
    // A mensagem da API pode conter eco do pedido; o corpo é seguro,
    // o token não aparece nele. Ainda assim, só o status e o texto.
    console.error(`GET falhou: HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    process.exit(1);
  }
  return r.json();
}

/** Diferença campo a campo, sem despejar 3 KB de HTML na tela. */
function comparar(atual) {
  const mudam = [];
  for (const [chave, novo] of Object.entries(desejado)) {
    const velho = atual[chave];
    if (velho === novo) continue;
    mudam.push(chave);
    const curto = (v) =>
      v === undefined || v === null
        ? "(vazio)"
        : String(v).length > 80
          ? `${String(v).slice(0, 77).replace(/\s+/g, " ")}… (${String(v).length} bytes)`
          : String(v);
    console.log(`\n  ${chave}`);
    console.log(`    no ar : ${curto(velho)}`);
    console.log(`    novo  : ${curto(novo)}`);
  }
  return mudam;
}

const antes = await ler();
console.log(`Comparando ${ORIGEM} com o projeto ${PROJETO}:`);
const mudam = comparar(antes);

if (mudam.length === 0) {
  console.log("\nNada a fazer — o projeto já está com estes templates.");
  process.exit(0);
}

if (!aplicar) {
  console.log(
    `\n${mudam.length} campo(s) mudariam. Nada foi enviado.\n` +
      `Para aplicar: node scripts/aplicar-templates-email.mjs --aplicar`
  );
  process.exit(0);
}

const r = await fetch(API, {
  method: "PATCH",
  headers: cabecalho,
  body: JSON.stringify(desejado),
});
if (!r.ok) {
  console.error(`PATCH falhou: HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);
  process.exit(1);
}

// Relê: 200 diz que a API aceitou, não que o projeto ficou como se quis.
const depois = await ler();
const teimosos = Object.entries(desejado)
  .filter(([k, v]) => depois[k] !== v)
  .map(([k]) => k);

if (teimosos.length) {
  console.error(`\nAplicou, mas estes campos NÃO ficaram como o esperado: ${teimosos.join(", ")}`);
  process.exit(1);
}
console.log(`\n${mudam.length} campo(s) aplicados e conferidos na releitura.`);
console.log("Mande um cadastro de teste para ver o e-mail que chega de verdade.");
