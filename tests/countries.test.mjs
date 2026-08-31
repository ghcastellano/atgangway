// Detecção de país e montagem do número: erra aqui e o cliente fica
// inalcançável — é o único canal que chega em quem já embarcou.
import { test } from "node:test";
import assert from "node:assert/strict";

const { detectCountry, buildPhone, dialOf, COUNTRIES } = await import("../lib/countries.ts");

function withEnv({ languages, timeZone }, fn) {
  const origNav = globalThis.navigator;
  const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  try {
    if (languages) {
      Object.defineProperty(globalThis, "navigator", {
        value: { languages, language: languages[0] },
        configurable: true,
      });
    } else {
      // simula ambiente sem navigator (SSR)
      Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
    }
    if (timeZone) {
      Intl.DateTimeFormat.prototype.resolvedOptions = function () {
        return { timeZone };
      };
    }
    return fn();
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: origNav, configurable: true });
    Intl.DateTimeFormat.prototype.resolvedOptions = origResolved;
  }
}

test("detecta país pela região da língua do navegador", () => {
  assert.equal(withEnv({ languages: ["en-PH", "fil"] }, detectCountry), "PH");
  assert.equal(withEnv({ languages: ["pt-BR"] }, detectCountry), "BR");
  assert.equal(withEnv({ languages: ["ru-UA"] }, detectCountry), "UA");
});

test("ignora língua sem região e usa a próxima pista", () => {
  assert.equal(withEnv({ languages: ["en", "hi-IN"] }, detectCountry), "IN");
});

test("cai no fuso do aparelho quando a língua não diz a região", () => {
  assert.equal(withEnv({ languages: ["en"], timeZone: "Asia/Manila" }, detectCountry), "PH");
  assert.equal(withEnv({ languages: ["en"], timeZone: "Europe/Kyiv" }, detectCountry), "UA");
});

test("usa o padrão quando nada identifica o país", () => {
  assert.equal(withEnv({ languages: ["en"], timeZone: "Antarctica/Troll" }, detectCountry), "BR");
  assert.equal(withEnv({ languages: null, timeZone: "Antarctica/Troll" }, detectCountry), "BR");
});

test("buildPhone monta E.164 e derruba o zero do tronco", () => {
  assert.equal(buildPhone("PH", "912 345 678"), "+63912345678");
  assert.equal(buildPhone("BR", "13 99999-8888"), "+5513999998888");
  assert.equal(buildPhone("IN", "09876543210"), "+919876543210"); // zero inicial some
});

test("buildPhone recusa número curto, vazio ou lixo", () => {
  assert.equal(buildPhone("BR", ""), null);
  assert.equal(buildPhone("BR", "123"), null);
  assert.equal(buildPhone("BR", "abc"), null);
  assert.equal(buildPhone("BR", "9".repeat(20)), null); // acima de 15 dígitos
});

test("todo país da lista tem dial válido e código único", () => {
  const codes = new Set();
  for (const c of COUNTRIES) {
    assert.match(c.dial, /^\+\d{1,4}$/, `dial inválido em ${c.code}`);
    assert.equal(codes.has(c.code), false, `código repetido: ${c.code}`);
    codes.add(c.code);
    assert.equal(dialOf(c.code), c.dial);
  }
  assert.ok(COUNTRIES.length >= 60);
});

test("nações que mais fornecem tripulação aparecem no topo da lista", () => {
  const top5 = COUNTRIES.slice(0, 5).map((c) => c.code);
  assert.deepEqual(top5, ["PH", "IN", "CN", "ID", "RU"]);
});

// ---- DDI que segue a nacionalidade ----
// O bug: dava para declarar Rússia no cadastro e o telefone continuar
// em +55, porque o país vinha do fuso do aparelho — e o aparelho está
// em Santos.
const { splitE164, resolveDialCountry, COUNTRIES: TODOS } = await import("../lib/countries.ts");

test("separa E.164 pelo prefixo mais longo, não pelo primeiro que casa", () => {
  // +380 da Ucrânia começa com +38: um find ingênuo erraria
  assert.deepEqual(splitE164("+380671234567"), { code: "UA", local: "671234567" });
  assert.deepEqual(splitE164("+5511970561448"), { code: "BR", local: "11970561448" });
  assert.deepEqual(splitE164("+639171234567"), { code: "PH", local: "9171234567" });
  assert.deepEqual(splitE164("+79161234567"), { code: "RU", local: "9161234567" });
});

test("aceita número salvo com espaço e traço", () => {
  assert.deepEqual(splitE164("+55 11 97056-1448"), { code: "BR", local: "11970561448" });
});

test("entrada que não é E.164 devolve null em vez de chutar país", () => {
  for (const v of ["", "11970561448", "abc", null, undefined, "0055119"]) {
    assert.equal(splitE164(v), null, String(v));
  }
});

test("o número salvo vence tudo — inclusive a nacionalidade", () => {
  // Russo com chip brasileiro é o caso comum a bordo. O DDI não pode
  // trocar só porque a nacionalidade diz outra coisa.
  assert.equal(
    resolveDialCountry({ savedE164: "+5511970561448", nationality: "RU", deviceCountry: "PH" }),
    "BR"
  );
});

test("sem número salvo, a nacionalidade vence o palpite do aparelho", () => {
  // É exatamente o caso do print: nacionalidade Rússia, aparelho em Santos.
  assert.equal(resolveDialCountry({ nationality: "RU", deviceCountry: "BR" }), "RU");
});

test("escolha manual vence a nacionalidade", () => {
  assert.equal(
    resolveDialCountry({ manualPick: "PH", nationality: "RU", deviceCountry: "BR" }),
    "PH"
  );
});

test("nacionalidade que não está na lista não derruba o palpite do aparelho", () => {
  assert.equal(resolveDialCountry({ nationality: "ZZ", deviceCountry: "PH" }), "PH");
  assert.equal(resolveDialCountry({ nationality: "", deviceCountry: "IN" }), "IN");
});

test("aceita nacionalidade em minúscula", () => {
  assert.equal(resolveDialCountry({ nationality: "ua" }), "UA");
});

test("sem nenhuma pista, cai no porto de casa", () => {
  assert.equal(resolveDialCountry({}), "BR");
});

test("todo país da lista tem DDI válido e código de duas letras", () => {
  const vistos = new Set();
  for (const c of TODOS) {
    assert.match(c.dial, /^\+\d{1,4}$/, `DDI de ${c.code}`);
    assert.match(c.code, /^[A-Z]{2}$/, `código ${c.code}`);
    assert.ok(!vistos.has(c.code), `país repetido: ${c.code}`);
    vistos.add(c.code);
    // Todo país precisa ser reencontrável a partir do próprio DDI
    const round = splitE164(`${c.dial}912345678`);
    assert.ok(round, `${c.code} não volta do próprio DDI`);
  }
});
