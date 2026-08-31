/**
 * O middleware repete a regra de "cadastro completo" porque roda no
 * runtime de borda e não pode importar lib/profile.ts inteiro. Regra
 * copiada vira duas regras diferentes na primeira mudança — e aqui a
 * divergência é cara: uma versão deixa a pessoa navegar, a outra barra
 * no checkout com o cartão na mão.
 *
 * Este teste extrai a função do arquivo do middleware e compara o
 * veredito das duas, campo a campo, em todas as combinações.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { profileIsComplete } = await import("../lib/profile.ts");

/** Recorta faltaCadastro() do middleware e avalia, sem importar o módulo. */
function carregarDoMiddleware() {
  const fonte = readFileSync("lib/supabase/middleware.ts", "utf-8");
  const m = fonte.match(/function faltaCadastro\([\s\S]*?\n\}/);
  assert.ok(m, "faltaCadastro sumiu do middleware — o gate foi removido?");
  const js = m[0]
    .replace(/: Record<string, unknown> \| null/g, "")
    .replace(/: boolean/g, "")
    .replace(/: unknown/g, "");
  return new Function(`${js}; return faltaCadastro;`)();
}

const faltaCadastro = carregarDoMiddleware();

const CAMPOS = ["full_name", "vessel_name", "port_id", "whatsapp"];

test("as duas versões da regra concordam em todas as combinações", () => {
  // 16 combinações: cada campo presente ou ausente.
  for (let mascara = 0; mascara < 1 << CAMPOS.length; mascara++) {
    const perfil = {};
    CAMPOS.forEach((c, i) => {
      perfil[c] = mascara & (1 << i) ? `valor de ${c}` : null;
    });
    assert.equal(
      faltaCadastro(perfil),
      !profileIsComplete(perfil),
      `divergiram em ${JSON.stringify(perfil)}`
    );
  }
});

test("espaço em branco não conta como preenchido, nos dois", () => {
  const soEspaco = { full_name: "  ", vessel_name: "  ", port_id: "  ", whatsapp: "  " };
  assert.equal(faltaCadastro(soEspaco), true);
  assert.equal(profileIsComplete(soEspaco), false);
});

test("perfil ausente falta cadastro nos dois", () => {
  assert.equal(faltaCadastro(null), true);
  assert.equal(profileIsComplete(null), false);
});

test("o portão de cadastro vale só no checkout e não gira em círculo", () => {
  const fonte = readFileSync("lib/supabase/middleware.ts", "utf-8");

  // O portão tem de estar preso ao /checkout. Já foi o contrário — uma
  // lista de exceções (LIVRES) barrando todo o resto — e o efeito era
  // expulsar da própria vitrine quem entrava pelo Google sem completar
  // o perfil. Navegar não pede cadastro; pagar é que pede.
  const portao = fonte.match(/user && pathname\.startsWith\("([^"]+)"\)/);
  assert.ok(portao, "o portão de cadastro sumiu do middleware");
  assert.equal(portao[1], "/checkout", "o portão voltou a barrar além do checkout");
  assert.ok(!fonte.includes("LIVRES"), "a lista de exceções voltou — o portão largo junto?");

  // O desvio manda para /account; se /account um dia cair dentro do
  // prefixo do portão, o redirecionamento vira loop infinito.
  assert.ok(fonte.includes('url.pathname = "/account"'), "o desvio tem de ir para /account");
  assert.ok(!"/account".startsWith(portao[1]), "destino do desvio dentro do portão = loop");
});
