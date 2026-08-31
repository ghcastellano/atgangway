/**
 * A voz do place_order.
 *
 * A validação de dinheiro migrou inteira para a RPC place_order — uma
 * transação, uma régua. O que fica no app é a TRADUÇÃO: a RPC devolve
 * códigos com dados (`{error:'min_order', missing_cents:1200}`) e aqui
 * cada código vira a mesma frase em inglês que o checkout sempre
 * mostrou. Função pura de propósito: mensagem de erro de compra é o
 * pior lugar para descobrir um typo só em produção.
 */
import { orderCloseAt, santosTime, usd } from "./format.ts";

export type PlaceOrderRpcError = {
  ok: false;
  error: string;
  ship?: string | null;
  closed_at?: string | null;
  name?: string | null;
  left?: number | null;
  port?: string | null;
  minimum_cents?: number | null;
  missing_cents?: number | null;
};

export function placeOrderErrorMessage(r: PlaceOrderRpcError): string {
  switch (r.error) {
    case "auth":
      return "You need to sign in to place an order.";
    case "bad_whatsapp":
      return "A valid WhatsApp number is required.";
    case "empty_kit":
      return "Your kit is empty.";
    case "no_window":
      return (
        "We couldn't verify your vessel's order window. Refresh and try again — " +
        "or pick your call again in My Account."
      );
    case "sailed":
      return (
        `${r.ship ?? "Your vessel"} has sailed. Pick your current vessel in ` +
        "My Account — your kit is saved and will be waiting."
      );
    case "window_closed":
      return (
        `The order window for ${r.ship ?? "this call"} closed` +
        (r.closed_at ? ` on ${santosTime(r.closed_at)}` : "") +
        ". Pick your next call in My Account and your kit will be waiting."
      );
    case "unavailable":
      return "An item in your kit is no longer available — review your cart.";
    case "out_of_stock":
      return `${r.name ?? "An item"} — only ${r.left ?? 0} left. Adjust your cart.`;
    case "min_order":
      return `Minimum order for ${r.port ?? "this port"} is ${usd(
        (r.minimum_cents ?? 0) / 100
      )} — add ${usd((r.missing_cents ?? 0) / 100)} more.`;
    default:
      // bad_key, bad_items e o que mais aparecer: nenhum caminho legítimo
      // da UI chega aqui, então a frase genérica basta.
      return "Couldn't place the order — try again.";
  }
}

/* re-export de conveniência para quem monta mensagens de janela fora da
   RPC (o checkout gate usa orderCloseAt direto) */
export { orderCloseAt };
