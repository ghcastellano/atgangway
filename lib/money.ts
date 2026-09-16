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

/**
 * O "não" do pedido mínimo do porto, escrito uma vez.
 *
 * A regra vale mesmo no RPC `place_order` — é lá que ela barra. Mas
 * dizer "não" só depois do checkout preenchido é o pior momento, então
 * carrinho e checkout antecipam o aviso. Antecipar em dois arquivos era
 * ter a mesma frase digitada duas vezes, livre para discordar: mudar a
 * palavra numa tela e não na outra não quebra nada, só faz a loja falar
 * duas línguas sobre o mesmo pedido.
 *
 * Porto sem mínimo cadastrado guarda 0 — aí o aviso simplesmente não
 * existe, em nenhuma das duas telas.
 */
export function faltaParaMinimo(subtotalCents: number, minOrderCents: number) {
  const subtotal = fromDb(subtotalCents);
  const minimo = fromDb(minOrderCents);
  const below = minimo > 0 && subtotal < minimo;
  const missing = below ? minimo - subtotal : 0;
  return { below, missing, minimo, label: `Add ${usd(missing)} more to check out` };
}

/**
 * Por que o checkout não deixa pagar — UM valor, ou null.
 *
 * Eram booleanos paralelos (`canPay = !blocked && !belowMin && …`) e
 * dois ternários, um no botão e outro na letra miúda, cuja ORDEM
 * decidia qual "não" vencia. Concordavam por disciplina: um terceiro
 * motivo acrescentado num só deles e o botão diria uma coisa enquanto a
 * frase embaixo dizia outra. Aqui a precedência é escrita uma vez.
 *
 * O mínimo vence o perfil: ele se resolve no carrinho, sem sair do
 * fluxo de compra, e o botão já diz quanto falta.
 */
export type BloqueioCheckout =
  | { motivo: "minimo"; botao: string; minimo: number }
  | { motivo: "perfil"; botao: null }
  | null;

export function bloqueioDoCheckout(o: {
  subtotalCents: number;
  minOrderCents: number;
  temItens: boolean;
  perfilIncompleto: boolean;
}): BloqueioCheckout {
  const min = faltaParaMinimo(o.subtotalCents, o.minOrderCents);
  // carrinho vazio não está "abaixo do mínimo": a página já o manda embora
  if (min.below && o.temItens) return { motivo: "minimo", botao: min.label, minimo: min.minimo };
  if (o.perfilIncompleto) return { motivo: "perfil", botao: null };
  return null;
}

export const sumCents =(values: Array<number | string | null | undefined>) =>
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
