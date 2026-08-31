import Stripe from "stripe";

// Chave secreta só existe no servidor (env da Vercel — nunca no repo).
// Sem ela o app continua funcionando no fluxo manual: pedido nasce
// awaiting_deposit e o staff confirma no board.
/**
 * Lida A CADA CHAMADA, nunca no topo do módulo.
 *
 * Era `const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)`
 * — e um const de módulo congela o que existia no momento em que o
 * bundle foi avaliado. Variável marcada como *sensitive* na Vercel não
 * chega ao build, então a constante nascia `false` e ficava `false`
 * para sempre: o webhook (que lê dentro do handler) enxergava a chave e
 * confirmava pagamentos, enquanto o checkout dizia "Online payment
 * isn't enabled yet" com a chave ali, presente. Função pequena, lida na
 * hora, imune a como o segredo foi cadastrado.
 */
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return client;
}

/**
 * Chave de idempotência do Stripe, presa ao pedido E ao valor: o mesmo
 * pedido com o mesmo valor em 24h devolve a MESMA session (clique duplo
 * cai na mesma página de pagamento); valor mudou (crédito aplicado
 * depois), chave nova — em vez do erro de parâmetros divergentes que o
 * Stripe dá quando a mesma chave chega com payload diferente.
 */
export const depositIdempotencyKey = (orderId: string, usdCents: number) =>
  `deposit-${orderId}-${usdCents}`;

/**
 * O status HTTP para cada outcome de confirm_stripe_deposit.
 *
 * 500 SÓ onde a reentrega do Stripe ajuda (misconfiguração de segredo,
 * outcome desconhecido). No-op legítimo com 500 viraria reentrega
 * infinita de um evento que nunca vai mudar; era o defeito espelhado do
 * boolean antigo, que respondia 200 até para pagamento não gravado.
 */
export function webhookOutcomeStatus(outcome: string): number {
  switch (outcome) {
    case "confirmed":
    case "duplicate_event":
    case "already_paid":
    case "no_order":
      return 200;
    default:
      return 500;
  }
}
