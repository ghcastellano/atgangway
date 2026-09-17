/**
 * Sair tem de sair — no servidor E na tela.
 *
 * Este arquivo nasceu de um defeito e cresceu com o segundo, que era o
 * mesmo sintoma por outra porta: apertar sair e continuar dentro.
 *
 *   1ª vez: `signOut` apagava o cookie e redirecionava, e só. Quem
 *      desenha "Sign in / Sign out" é o estado do navegador, semeado
 *      uma vez quando o layout raiz monta — e o redirect de uma Server
 *      Action é navegação de cliente, que não remonta layout. Sessão
 *      morta, menu ainda oferecendo "Sign out".
 *
 *   2ª vez: no menu do cabeçalho a ação NEM RODAVA. O botão fechava o
 *      próprio menu no `onClick`, fechar desmonta o <form>, e um <form>
 *      que some no meio do envio leva a Server Action junto. Medido:
 *      cookies 2 antes, 2 depois. Os outros botões de sair funcionavam
 *      — nenhum deles fechava nada — e foi essa diferença silenciosa
 *      entre cinco cópias do mesmo <form> que escondeu o defeito.
 *
 * A correção das duas foi a mesma: um componente único, <SairDaConta/>,
 * e a ordem certa (apagar o cookie, DEPOIS esquecer no navegador,
 * DEPOIS navegar). Os testes abaixo guardam as decisões que somem sem
 * deixar rastro numa refatoração distraída — por isso leem a fonte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const fonte = readFileSync("app/account/actions.ts", "utf-8");
const corpo = fonte.slice(fonte.indexOf("export async function signOut"));
const signOut = corpo.slice(0, corpo.indexOf("\nexport "));
const botao = readFileSync("components/SairDaConta.tsx", "utf-8");

test("sair invalida o LAYOUT, não só a página", () => {
  assert.match(
    signOut,
    /revalidatePath\(\s*"\/"\s*,\s*"layout"\s*\)/,
    'sem revalidatePath("/", "layout") o que o SERVIDOR guardou do cabeçalho continua velho'
  );
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

test("a action NÃO redireciona — quem chama precisa continuar vivo", () => {
  /* O redirect saiu de propósito: ele encerra a Server Action, e o que
     falta fazer (esquecer a sessão no navegador) só o cliente pode. Se
     alguém o trouxer de volta, o cabeçalho volta a mentir e nenhum
     outro teste percebe. */
  assert.doesNotMatch(
    signOut,
    /^\s*redirect\(/m,
    "redirect() de volta dentro do signOut: o cliente nunca retoma, e a casca do site fica dizendo que há sessão"
  );
});

test("sair passa por UM componente só", () => {
  /* O defeito do menu existiu porque havia cinco <form action={signOut}>
     copiados, e um deles tinha um `onClick` a mais. Com um dono só, a
     diferença não tem onde nascer. */
  const arquivos = [];
  const varrer = (dir) => {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome === ".next" || nome === ".git") continue;
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) varrer(caminho);
      else if (/\.tsx?$/.test(nome)) arquivos.push(caminho);
    }
  };
  varrer("app");
  varrer("components");

  const importam = arquivos.filter(
    (f) =>
      f !== "components/SairDaConta.tsx" &&
      /import\s*\{[^}]*\bsignOut\b[^}]*\}\s*from\s*"@\/app\/account\/actions"/.test(
        readFileSync(f, "utf-8")
      )
  );
  assert.deepEqual(
    importam,
    [],
    `estes arquivos montam o próprio botão de sair em vez de usar <SairDaConta/>: ${importam.join(", ")}`
  );
});

test("o botão de sair não fecha nada no clique", () => {
  /* `onClick` num submit que está dentro de um menu ou gaveta é a
     armadilha: fechar desmonta o <form> e cancela a Server Action.
     Quem fecha é a navegação. */
  assert.doesNotMatch(
    botao,
    /onClick=/,
    "voltou um onClick ao botão de sair — se ele fechar o container, a ação morre com o <form>"
  );
});

test("depois de sair, o navegador esquece a sessão — e nessa ordem", () => {
  const acao = botao.slice(botao.indexOf("action={async"));
  const iSignOut = acao.indexOf("await signOut()");
  const iSeed = acao.indexOf("seed(0, [], false)");
  const iNav = acao.search(/router\.(replace|push)\(/);

  assert.ok(iSignOut >= 0, "o botão precisa esperar a action antes de qualquer outra coisa");
  assert.ok(
    iSeed > iSignOut,
    "esquecer a sessão ANTES de a action voltar troca este <form> por um link no meio do envio — é o defeito de novo"
  );
  assert.ok(iNav > iSignOut, "navegar antes de o cookie sair leva a pessoa para uma tela que ainda a considera logada");
  assert.match(botao, /router\.refresh\(\)/, "sem refresh, o que veio do servidor continua sendo o de antes");
});
