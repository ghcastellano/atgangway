// Templates de e-mail: montagem pura, sem SMTP. O que importa aqui é
// o que quebra em produção — escape de HTML (nome de contato vem do
// cliente), numeric do Postgres chegando como string, e o link do
// pedido apontando para o lugar certo.
import { test } from "node:test";
import assert from "node:assert/strict";

const { buildOrderEmail, esc } = await import("../lib/emails.ts");

const base = {
  to_email: "bosun@example.com",
  to_name: "Rafael Souza",
  code: "MS7K2Q",
  subtotal_usd: "148.50",
  deposit_usd: "44.55",
  balance_usd: "103.95",
  credit_applied_usd: "0",
  ship_name: "MSC LORENA",
  ship_berth: "39",
  ship_eta: "2026-09-02T14:00:00.000Z",
  items: [
    { name: "SIM card 20GB", emoji: "📶", qty: 2, unit_usd: "29.00" },
    { name: "Fresh fruit box", emoji: "🍎", qty: 1, unit_usd: "90.50" },
  ],
};

test("escape cobre os cinco caracteres perigosos", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
});

test("nome de contato hostil não vira HTML", () => {
  const mail = buildOrderEmail(
    { ...base, kind: "deposit_paid", to_name: "<script>alert(1)</script>" },
    "https://marinerssupplyco.com"
  );
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
});

test("nome de navio hostil não vira HTML", () => {
  const mail = buildOrderEmail(
    { ...base, kind: "at_gangway", ship_name: 'X" onerror="boom' },
    "https://marinerssupplyco.com"
  );
  assert.ok(!mail.html.includes('onerror="boom'));
  assert.ok(mail.html.includes("&quot; onerror=&quot;boom"));
});

test("numeric como string soma igual a número", () => {
  const asText = buildOrderEmail({ ...base, kind: "deposit_paid" }, "https://x.com");
  const asNum = buildOrderEmail(
    {
      ...base,
      kind: "deposit_paid",
      subtotal_usd: 148.5,
      deposit_usd: 44.55,
      balance_usd: 103.95,
      items: base.items.map((i) => ({ ...i, unit_usd: Number(i.unit_usd) })),
    },
    "https://x.com"
  );
  assert.equal(asText.html, asNum.html);
  assert.ok(asText.html.includes("USD 58.00")); // 2 × 29.00
  assert.ok(asText.html.includes("USD 44.55"));
});

test("os três tipos têm assunto, html e texto com o código do pedido", () => {
  for (const kind of ["deposit_paid", "at_gangway", "delivered"]) {
    const mail = buildOrderEmail({ ...base, kind }, "https://marinerssupplyco.com/");
    assert.ok(mail.subject.includes("MS7K2Q"), `assunto de ${kind}`);
    assert.ok(mail.text.includes("MS7K2Q"), `texto de ${kind}`);
    assert.ok(
      mail.html.includes("https://marinerssupplyco.com/orders/MS7K2Q"),
      `link de ${kind}`
    );
    // barra final duplicada é erro clássico de concatenação
    assert.ok(!mail.html.includes(".com//orders"), `barra dupla em ${kind}`);
    assert.ok(mail.text.length > 80 && mail.html.length > 500);
  }
});

test("crédito Captain só aparece quando existe", () => {
  const sem = buildOrderEmail({ ...base, kind: "deposit_paid" }, "https://x.com");
  const com = buildOrderEmail(
    { ...base, kind: "deposit_paid", credit_applied_usd: "12.00" },
    "https://x.com"
  );
  assert.ok(!sem.html.includes("Captain credit"));
  assert.ok(com.html.includes("Captain credit"));
  assert.ok(com.text.includes("-USD 12.00"));
});

test("entrega sem foto não promete foto", () => {
  const com = buildOrderEmail({ ...base, kind: "delivered", has_photo: true }, "https://x.com");
  const sem = buildOrderEmail({ ...base, kind: "delivered", has_photo: false }, "https://x.com");
  assert.ok(com.html.includes("See delivery photo"));
  assert.ok(sem.html.includes("See receipt"));
  assert.ok(!sem.text.includes("Delivery photo"));
});

test("sem itens e sem navio ainda monta", () => {
  const mail = buildOrderEmail(
    { kind: "at_gangway", to_email: "a@b.c", code: "ZZ1", subtotal_usd: 0, deposit_usd: 0, balance_usd: 0 },
    "https://x.com"
  );
  assert.ok(mail.subject.includes("ZZ1"));
  assert.ok(mail.html.includes("USD 0.00"));
});

test("primeiro nome curto demais vira 'sailor'", () => {
  const a = buildOrderEmail({ ...base, kind: "delivered", to_name: "R" }, "https://x.com");
  const b = buildOrderEmail({ ...base, kind: "delivered", to_name: null }, "https://x.com");
  assert.ok(a.text.includes("Fair winds, sailor."));
  assert.ok(b.text.includes("Fair winds, sailor."));
  const c = buildOrderEmail({ ...base, kind: "delivered" }, "https://x.com");
  assert.ok(c.text.includes("Fair winds, Rafael."));
});

/* O e-mail do desvio — o quarto tipo, e o único que dá má notícia.
 *
 * O que se testa aqui é o que o dinheiro exige. Se o valor sair errado
 * neste e-mail, a pessoa acredita num crédito que não tem (ou deixa de
 * usar o que tem), e nenhuma das duas dá para consertar com pedido de
 * desculpas depois. */
test("desvio: credita o depósito INTEIRO, não só o dinheiro que entrou", () => {
  // 44.55 de depósito, dos quais 20.00 vieram de crédito já acumulado.
  // Devolver 24.55 seria confiscar o crédito gasto por tecnicalidade.
  const mail = buildOrderEmail(
    { ...base, kind: "credited", credit_applied_usd: "20.00" },
    "https://marinerssupplyco.com"
  );
  assert.ok(mail.subject.includes("44.55"), "o valor no assunto é o depósito inteiro");
  assert.ok(mail.text.includes("44.55"));
  assert.ok(!mail.subject.includes("24.55"), "não desconta o crédito que a pessoa já tinha gasto");
});

test("desvio: nomeia o navio e o pedido, que é o que a pessoa procura", () => {
  const mail = buildOrderEmail({ ...base, kind: "credited" }, "https://marinerssupplyco.com");
  assert.ok(mail.subject.includes("MSC LORENA"));
  assert.ok(mail.html.includes("MS7K2Q"));
  assert.ok(mail.text.includes("MS7K2Q"));
});

test("desvio: navio hostil não vira HTML nem no assunto nem no corpo", () => {
  const mail = buildOrderEmail(
    { ...base, kind: "credited", ship_name: 'X" onerror="boom' },
    "https://marinerssupplyco.com"
  );
  assert.ok(!mail.html.includes('onerror="boom'));
  assert.ok(mail.html.includes("&quot; onerror=&quot;boom"));
});

test("desvio: sem navio no cadastro, o texto ainda fecha", () => {
  const mail = buildOrderEmail(
    { ...base, kind: "credited", ship_name: null },
    "https://marinerssupplyco.com"
  );
  assert.ok(mail.subject.startsWith("Your vessel"));
  assert.ok(mail.text.includes("Your vessel"));
  assert.ok(!mail.html.includes("null"), "nada de 'null' vazando para o corpo");
});

test("desvio: manda para a loja, não para a página do pedido morto", () => {
  const mail = buildOrderEmail({ ...base, kind: "credited" }, "https://marinerssupplyco.com");
  assert.ok(mail.html.includes("https://marinerssupplyco.com/shop"));
  assert.ok(mail.html.includes("Order for your next call"));
});

/* A última chamada — o quinto e-mail, e o único que nasce sem pedido.
 * O claim no banco garante um por pessoa por escala; aqui se testa o
 * que o texto promete. */
const chamada = {
  to_email: "cook@example.com",
  to_name: "Rafael Souza",
  ship: "MAERSK LANCO",
  berth: "35",
  eta: "2026-08-30T15:00:00.000Z",
  closes_at: "2026-08-27T15:00:00.000Z",
  wish_count: 4,
};

const { buildLastCallEmail } = await import("../lib/emails.ts");

test("última chamada: assunto carrega navio e hora do corte", () => {
  const mail = buildLastCallEmail(chamada, "https://marinerssupplyco.com");
  assert.ok(mail.subject.includes("MAERSK LANCO"));
  assert.ok(/closes/i.test(mail.subject));
});

test("última chamada: com wishlist, o botão leva para ELA", () => {
  const mail = buildLastCallEmail(chamada, "https://marinerssupplyco.com");
  assert.ok(mail.html.includes("https://marinerssupplyco.com/wishlist"));
  assert.ok(mail.html.includes("4 item"));
});

test("última chamada: sem wishlist, o botão leva para a loja", () => {
  const mail = buildLastCallEmail({ ...chamada, wish_count: 0 }, "https://marinerssupplyco.com");
  assert.ok(mail.html.includes("https://marinerssupplyco.com/shop"));
  assert.ok(!mail.html.includes("/wishlist"));
});

test("última chamada: nome de navio hostil não vira HTML", () => {
  const mail = buildLastCallEmail(
    { ...chamada, ship: 'X" onerror="boom' },
    "https://marinerssupplyco.com"
  );
  assert.ok(!mail.html.includes('onerror="boom'));
});

test("última chamada: um item usa o singular", () => {
  const mail = buildLastCallEmail({ ...chamada, wish_count: 1 }, "https://x.com");
  assert.ok(mail.html.includes("1 item</b>"));
  assert.ok(!mail.html.includes("1 items"));
});

/**
 * O e-mail nasce escuro — e o cliente de e-mail não pode "consertá-lo".
 *
 * O Gmail no Android, sem `color-scheme` declarado, assume que precisa
 * adaptar a mensagem ao tema do aparelho e reescreve cor por cor. Num
 * e-mail já escuro isso não melhora nada: a frase do depósito chegou
 * PRETA sobre azul-quase-preto, ilegível, enquanto o resto do cartão
 * passou intacto. Quem viu foi o dono da loja, na própria caixa.
 *
 * Duas defesas, e as duas precisam continuar aí:
 *   1. declarar que a mensagem suporta escuro (o cliente para de mexer);
 *   2. não deixar nenhum trecho de texto pendurado em cor HERDADA —
 *      herança é a primeira coisa que se perde quando o cliente
 *      reescreve, e foi exatamente o trecho depois do <br> que caiu.
 */
test("o e-mail se declara escuro para o cliente não reescrever cores", () => {
  const mail = buildOrderEmail({ ...base, kind: "at_gangway" }, "https://atgangway.com");
  assert.match(mail.html, /<meta name="color-scheme" content="dark">/);
  assert.match(mail.html, /<meta name="supported-color-schemes" content="dark">/);
});

test("nenhuma frase depois de <br> fica pendurada em cor herdada", async () => {
  const { buildLastCallEmail } = await import("../lib/emails.ts");
  const html = buildLastCallEmail(
    {
      to_email: "bosun@example.com",
      to_name: "Rajesh Kumar",
      ship: "BOW CHEETAH",
      eta: "2026-09-19T15:00:00.000Z",
      closes_at: "2026-09-16T15:00:00.000Z",
      wish_count: 0,
    },
    "https://atgangway.com"
  ).html;

  // Todo <br> tem de ser seguido (ignorando espaço) por um elemento que
  // escreva a própria cor — nunca por texto solto.
  for (const m of html.matchAll(/<br>\s*([^<]*)</g)) {
    assert.equal(
      m[1].trim(),
      "",
      `texto solto logo depois de um <br>: ${JSON.stringify(m[1].trim().slice(0, 60))}`
    );
  }
  assert.match(html, /<br>\s*<span style="color:#[0-9A-Fa-f]{6}">30% deposit now/);
});
