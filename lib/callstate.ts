/**
 * O estado da escala — a máquina de estados da loja.
 *
 * A janela de pedidos era calculada em quatro lugares com quatro contas:
 * o painel do navio somava 48h à ATA, o picker media horas até o corte,
 * o checkout comparava contra o relógio e o banco aposentava a escala na
 * rotação. Quatro réguas iguais até o dia em que uma muda. Esta é a
 * régua única — pura e com o relógio por parâmetro, mesmo desenho de
 * lib/delivery.ts, pelo mesmo motivo: regra de tempo só se testa com o
 * relógio na mão.
 *
 *   open    — janela aberta, compra normal
 *   closing — últimas horas; a loja liga a urgência
 *   closed  — o corte passou; o navio ainda está na escala
 *   sailed  — o navio esteve e foi; o vínculo do perfil envelheceu
 *
 * Os limiares são os que o sistema já usa em outros pontos: 48h depois
 * de coalesce(ata, eta) é a régua de rotate_ship_calls e do crédito de
 * desvio no banco; 12h é o limiar do e-mail de última chamada. Um
 * número só por régua — mudou aqui, mudou em todo lugar.
 */
import { orderCloseAt } from "./format.ts";

export type CallState = "open" | "closing" | "closed" | "sailed";

export type CallFacts = {
  eta: string | Date;
  ata?: string | Date | null;
  cutoff_hours?: number | null;
};

/** O navio esteve e foi: coalesce(ata, eta) + 48h — igual à rotação no banco. */
export const SAILED_AFTER_HOURS = 48;

/** Últimas horas da janela: mesmo limiar do e-mail de última chamada. */
export const CLOSING_HOURS = 12;

export function callState(v: CallFacts, now: Date = new Date()): CallState {
  const esteve = new Date(v.ata ?? v.eta).getTime();
  if (esteve + SAILED_AFTER_HOURS * 3600e3 <= now.getTime()) return "sailed";

  const falta = orderCloseAt(v.eta, v.cutoff_hours ?? 24).getTime() - now.getTime();
  if (falta <= 0) return "closed";
  if (falta <= CLOSING_HOURS * 3600e3) return "closing";
  return "open";
}

/** A única pergunta que o funil de compra faz a esta régua. */
export const canOrder = (s: CallState) => s === "open" || s === "closing";
