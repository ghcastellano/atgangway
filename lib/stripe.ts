import Stripe from "stripe";

// Chave secreta só existe no servidor (env da Vercel — nunca no repo).
// Sem ela o app continua funcionando no fluxo manual: pedido nasce
// awaiting_deposit e o staff confirma no board.
export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return client;
}
