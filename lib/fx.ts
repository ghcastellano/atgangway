/**
 * Câmbio.
 *
 * A loja cobra em DÓLAR. O real aparece num lugar só — a referência do
 * checkout, para quem vai pagar em PIX — e precisa sair da cotação de
 * verdade, não de uma constante.
 *
 * Antes era NEXT_PUBLIC_USD_BRL_RATE=5.30, congelada no build, com o
 * PTAX real em 5,1490. Como a cobrança era feita em real, a diferença
 * de 3% virava sobrepreço decidido por variável de ambiente esquecida.
 *
 * As funções puras ficam aqui para serem testáveis sem banco nem rede.
 */

/** Resposta do Olinda/BCB, só o que a gente usa. */
export type PtaxRow = {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string;
};

export type FxRate = {
  /** Data da cotação (AAAA-MM-DD), não a data de hoje. */
  quoteDate: string;
  buy: number;
  sell: number;
};

/** MM-DD-AAAA, que é o formato que o Olinda exige. */
export function bcbDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${d.getUTCFullYear()}`;
}

/**
 * URL do PTAX por período. Sempre período, nunca dia: o PTAX não
 * publica em sábado, domingo nem feriado, e pedir "hoje" num feriado
 * devolve lista vazia. Uma janela para trás sempre traz o último.
 */
export function ptaxUrl(from: Date, to: Date): string {
  const base =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";
  // Montado à mão, e não com URLSearchParams: ele percent-encoda o @ e
  // o $ dos parâmetros OData (%40dataInicial, %24top) e o Olinda
  // responde 400. Os VALORES continuam encodados; só os nomes ficam
  // literais, que é o que o serviço exige.
  const qs = [
    `@dataInicial='${bcbDate(from)}'`,
    `@dataFinalCotacao='${bcbDate(to)}'`,
    "$top=10",
    `$orderby=${encodeURIComponent("dataHoraCotacao desc")}`,
    "$format=json",
  ].join("&");
  return `${base}?${qs}`;
}

/** Pega a cotação mais recente do payload, descartando o que vier torto. */
export function latestPtax(rows: PtaxRow[] | null | undefined): FxRate | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const valid = rows
    .filter(
      (r) =>
        r &&
        Number.isFinite(r.cotacaoCompra) &&
        Number.isFinite(r.cotacaoVenda) &&
        r.cotacaoVenda > 0 &&
        typeof r.dataHoraCotacao === "string" &&
        r.dataHoraCotacao.length >= 10
    )
    .sort((a, b) => (a.dataHoraCotacao < b.dataHoraCotacao ? 1 : -1));
  const top = valid[0];
  if (!top) return null;
  return {
    quoteDate: top.dataHoraCotacao.slice(0, 10),
    buy: top.cotacaoCompra,
    sell: top.cotacaoVenda,
  };
}

/**
 * Quantos reais são estes centavos de dólar.
 *
 * Usa a cotação de VENDA: é a que o banco cobra de quem compra dólar, e
 * portanto a que corresponde ao que a pessoa gasta. Usar a de compra
 * mostraria um número menor do que ela vai pagar.
 *
 * Arredonda para real inteiro de propósito — é referência, não cobrança,
 * e centavo de referência dá falsa precisão.
 */
export function usdCentsToBrl(usdCents: number, rate: FxRate | null): number | null {
  if (!rate || !Number.isFinite(usdCents)) return null;
  return Math.round((usdCents / 100) * rate.sell);
}

/** "R$ 165" — a mesma referência arredondada, já formatada. */
export function brlRef(usdCents: number, rate: FxRate | null): string | null {
  const v = usdCentsToBrl(usdCents, rate);
  return v === null ? null : `R$ ${v.toLocaleString("pt-BR")}`;
}

/** Quantos dias a cotação está atrasada. Fim de semana conta. */
export function rateAgeDays(rate: FxRate | null, now: Date): number | null {
  if (!rate) return null;
  const q = Date.parse(`${rate.quoteDate}T12:00:00Z`);
  if (!Number.isFinite(q)) return null;
  return Math.floor((now.getTime() - q) / 86_400_000);
}

/**
 * Cotação velha demais para ser chamada de referência. Quatro dias
 * cobre feriado emendado com fim de semana; acima disso é cron parado,
 * e aí é melhor não mostrar número nenhum do que mostrar um errado.
 */
export const MAX_RATE_AGE_DAYS = 4;

export function rateIsUsable(rate: FxRate | null, now: Date): boolean {
  const age = rateAgeDays(rate, now);
  return age !== null && age >= 0 && age <= MAX_RATE_AGE_DAYS;
}
