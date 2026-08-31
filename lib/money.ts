/**
 * Dinheiro em centavos inteiros.
 *
 * O banco guarda numeric, que é exato — mas numeric atravessa o JSON
 * como string e vira float em JavaScript, onde 0.1 + 0.2 não fecha
 * caixa. Do lado do app, dinheiro é int e só vira texto na renderização.
 *
 * Toda entrada passa por toCents/fromDb porque a mesma linha pode
 * chegar como number (colunas _cents) ou string (colunas numeric
 * antigas) dependendo de qual consulta a trouxe.
 */


/** numeric | number | string do Postgres → centavos inteiros. */
export function fromDb(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Valor em unidades (18.5) → centavos (1850).
 *
 * Feito por string, não por multiplicação: `1.005 * 100` em ponto
 * flutuante dá 100.49999999999999 e arredonda para 100, comendo um
 * centavo. Parseando os dígitos o valor nunca vira float.
 */
export function toCents(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(",", ".");
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) {
    // notação científica e afins: sem caminho exato, cai no genérico
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  const sign = m[1] === "-" ? -1 : 1;
  // três casas para arredondar o meio centavo com honestidade
  const milli = Number(m[2] || "0") * 1000 + Number((m[3] ?? "").padEnd(3, "0").slice(0, 3));
  return sign * Math.round(milli / 10);
}

export const usd = (cents: number) => `USD ${(fromDb(cents) / 100).toFixed(2)}`;

/* brl() saiu daqui. A conversão foi para lib/fx.ts, que recebe a
   cotação do PTAX como argumento em vez de ler uma constante global:
   função pura não pode depender de uma taxa que muda todo dia útil. */

export const sumCents = (values: Array<number | string | null | undefined>) =>
  values.reduce<number>((acc, v) => acc + fromDb(v), 0);

/**
 * Desconto exibido no card. Devolve null quando não há promoção real —
 * a UI usa isso para decidir se rende o preço riscado.
 */
export function discountPercent(
  priceCents: number,
  compareAtCents: number | null | undefined
): number | null {
  const price = fromDb(priceCents);
  const was = fromDb(compareAtCents);
  if (!was || was <= price) return null;
  const pct = Math.round(((was - price) / was) * 100);
  return pct >= 1 ? pct : null;
}

/** Depósito de 30%, arredondado ao centavo, sem passar por float. */
export const DEPOSIT_PCT = 30;

export function depositCents(subtotalCents: number): number {
  return Math.round((fromDb(subtotalCents) * DEPOSIT_PCT) / 100);
}

export function splitOrder(subtotalCents: number, creditCents = 0) {
  const subtotal = fromDb(subtotalCents);
  const deposit = depositCents(subtotal);
  const credit = Math.min(fromDb(creditCents), deposit);
  return {
    subtotal,
    deposit,
    credit,
    dueNow: deposit - credit,
    balance: subtotal - deposit,
  };
}
