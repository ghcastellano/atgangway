/**
 * Regime tributário por canal — e por que "duty-free" não é uma coisa só.
 *
 * O app dizia "Duty-free, delivered" em todo produto. Não se sustenta.
 * No Brasil existem TRÊS caminhos distintos para pôr mercadoria a bordo,
 * e o benefício fiscal tem dono — que não é o marinheiro:
 *
 * 1. FORNECIMENTO DE BORDO (Convênio ICM 12/75, redação do Convênio
 *    ICMS 55/21). Equipara a saída a EXPORTAÇÃO, então desonera. Mas as
 *    condições que sobreviveram à mudança de 2021 são duras: despacho de
 *    exportação com a expressão "fornecimento para consumo ou uso de
 *    embarcações", adquirente sediado no exterior, comprovação do
 *    embarque pela autoridade competente e — a que quebra o nosso
 *    desenho — PAGAMENTO EM MOEDA ESTRANGEIRA CONVERSÍVEL, por câmbio
 *    em banco autorizado ou débito na conta de suprimento que o agente
 *    mantém para o armador. Cartão pessoal em real via Stripe não
 *    cumpre nenhuma das duas.
 *
 * 2. LOJA FRANCA PARA TRIPULANTES (IN RFB 2.075/2022). Desonera e a
 *    entrega é DENTRO da embarcação — é literalmente o nosso modelo.
 *    Mas exige concessão da RFB por ADE precário, patrimônio líquido de
 *    R$ 2 milhões, loja em ZONA PRIMÁRIA escolhida pela administração do
 *    porto, e proíbe venda antecipada com entrega posterior: a entrega
 *    é na loja onde se comprou.
 *
 * 3. VAREJO COMUM. É onde a operação está hoje. ICMS e PIS/COFINS estão
 *    no preço. Não é duty-free, e chamar de duty-free é propaganda
 *    enganosa (CDC art. 37).
 *
 * Por isso tax_class no produto é ELEGIBILIDADE ("esta mercadoria pode
 * ir por fornecimento de bordo"), e o regime que vale de verdade sai do
 * CANAL do pedido. O mesmo alto-falante é desonerado se embarcar sob o
 * regime e tributado se sair pelo balcão.
 */

export type TaxClass = "bonded" | "domestic" | "digital";
export type Channel = "onboard" | "pickup" | "digital";

export type RegimeCopy = {
  /** Linha curta da tabela de atributos da ficha. */
  label: string;
  /** Título da seção explicativa. */
  headline: string;
  lines: string[];
};

/**
 * O que o produto PODE ser, pelo que ele é. Não promete o canal —
 * quem promete é o checkout, que sabe por onde o pedido vai sair.
 */
export const ELIGIBILITY: Record<TaxClass, RegimeCopy> = {
  bonded: {
    label: "Eligible as ship's stores",
    headline: "How tax works on this item",
    lines: [
      "Delivered on board against your vessel, this qualifies as ship's stores under Brazil's export regime — Brazilian taxes come out of the price.",
      "Collected at our counter instead, it is an ordinary Brazilian retail sale and the taxes stay in.",
      "The price you see is for the channel you pick at checkout. We show both before you pay.",
    ],
  },
  domestic: {
    label: "Brazilian retail — taxes included",
    headline: "How tax works on this item",
    lines: [
      "This one does not travel under a customs regime, so Brazilian taxes are included in the price.",
      "No paperwork, no waiting on customs — you can collect it the same day.",
    ],
  },
  digital: {
    label: "Digital — no customs",
    headline: "How tax works on this item",
    lines: [
      "It reaches your phone, so nothing crosses a border and no customs regime applies.",
      "Brazilian telecom taxes are already in the price.",
      "Nothing depends on your vessel's schedule or on port access.",
    ],
  },
};

/**
 * O que o CANAL faz com o imposto. É esta a frase honesta para o
 * checkout — a única que sabe se o regime de exportação vai ou não ser
 * usado no pedido concreto.
 */
export const CHANNEL_REGIME: Record<Channel, RegimeCopy> = {
  onboard: {
    label: "Ship's stores · export regime",
    headline: "Delivered on board",
    lines: [
      "Goods go on board under Brazil's ship's-stores export regime, handled by an accredited chandler. We prepare the export dispatch — nothing for you to sign.",
      "The regime requires the order to be settled against your vessel, in convertible currency, through its agent. If it is settled on your own card instead, the sale is an ordinary Brazilian one and taxes apply.",
    ],
  },
  pickup: {
    label: "Counter sale · taxes included",
    headline: "Collected at our counter",
    lines: [
      "A counter sale in Brazil. Brazilian taxes are in the price — this is not a duty-free purchase, and we would rather say so than let you find out from the receipt.",
      "In exchange: no customs window, no minimum, and you can walk out with it.",
    ],
  },
  digital: {
    label: "Digital · no customs",
    headline: "Delivered to your phone",
    lines: [
      "No goods, no border, no customs regime. It works the moment you are in range.",
    ],
  },
};

/** Frase de uma linha para card, e-mail e resumo de pedido. */
export function shortRegime(taxClass: TaxClass): string {
  return ELIGIBILITY[taxClass]?.label ?? ELIGIBILITY.domestic.label;
}
