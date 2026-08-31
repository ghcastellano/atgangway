/**
 * Sair tem de derrubar a MEMÓRIA DO LAYOUT, não só o cookie.
 *
 * O defeito que originou este arquivo: `signOut` apagava o cookie e
 * fazia `redirect("/")` — e pronto. Só que quem desenha o cabeçalho é o
 * SiteChrome, que pergunta ao servidor quem está logado e mora no
 * LAYOUT RAIZ. Layout não re-renderiza em navegação de cliente, que é
 * exatamente o que o redirect faz: a sessão morria e o menu continuava
 * oferecendo "Sign out" até alguém recarregar na mão. Quem clicou em
 * sair ficava achando que não tinha saído.
 *
 * O teste lê a fonte porque o que precisa ser garantido é uma DECISÃO
 * (invalidar o layout, não só a página), e ela some sem deixar rastro
 * numa refatoração distraída.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("app/account/actions.ts", "utf-8");
const corpo = fonte.slice(fonte.indexOf("export async function signOut"));
const signOut = corpo.slice(0, corpo.indexOf("\nexport "));

test("sair invalida o LAYOUT, não só a página", () => {
  assert.match(
    signOut,
    /revalidatePath\(\s*"\/"\s*,\s*"layout"\s*\)/,
    'sem revalidatePath("/", "layout") o cabeçalho continua dizendo que você está logado'
  );
});

test("sair continua terminando na home", () => {
  assert.match(signOut, /redirect\("\/"\)/);
});

test("falha de rede no signOut não deixa a pessoa logada", () => {
  // A revogação do refresh token é uma chamada de rede; se ela falhar,
  // o cookie tem de sair mesmo assim.
  assert.match(signOut, /const \{ error \} = await supabase\.auth\.signOut\(\)/,
    "o erro do signOut precisa ser olhado, não descartado");
  assert.match(signOut, /startsWith\("sb-"\)/,
    "sem a limpeza pelo prefixo sb-, cookie partido em .0/.1 fica para trás");
  assert.match(signOut, /store\.delete\(c\.name\)/);
});
