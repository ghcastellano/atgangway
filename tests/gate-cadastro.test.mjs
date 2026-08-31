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

test("a lista de rotas livres não tranca ninguém para fora", () => {
  const fonte = readFileSync("lib/supabase/middleware.ts", "utf-8");
  const m = fonte.match(/const LIVRES = \[([^\]]*)\]/);
  assert.ok(m, "LIVRES sumiu — o desvio giraria em círculo");
  const livres = m[1].match(/"([^"]+)"/g).map((s) => s.replaceAll('"', ""));

  // /account é o DESTINO do desvio: sem ele, redireciona para si mesmo
  // para sempre e a pessoa vê um erro de loop no navegador.
  assert.ok(livres.includes("/account"), "/account tem de ser livre — é o destino");
  // /auth e /login são entrada e saída: barrar ali impede até deslogar.
  assert.ok(livres.includes("/auth"));
  assert.ok(livres.includes("/login"));
  // O staff não tem navio nem porto de casa. Barrar /admin trancaria a
  // própria equipe para fora do painel.
  assert.ok(livres.includes("/admin"), "/admin tem de ser livre — staff não tem navio");
});
