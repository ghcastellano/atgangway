/**
 * O que o checkout exige para liberar o pagamento.
 *
 * Mora sozinho porque três lugares perguntam a mesma coisa: a ação que
 * salva o cadastro, a tela da conta e o retorno do Google. Escrita três
 * vezes, a regra vira três regras diferentes na primeira mudança — e
 * quem descobre a divergência é o cliente, no checkout, com o cartão na
 * mão.
 *
 * Rank e nacionalidade ficam de fora de propósito: são recomendados,
 * não bloqueiam pagamento. Dizer "obrigatório" sobre o que não trava é
 * o jeito de ensinar a pessoa a ignorar os avisos.
 */

export type ProfileFacts = {
  full_name?: string | null;
  vessel_name?: string | null;
  port_id?: string | null;
  whatsapp?: string | null;
};

/** Campos que faltam, na ordem em que aparecem no formulário. */
export function missingProfileFields(p: ProfileFacts | null | undefined): string[] {
  const has = (v: string | null | undefined) => Boolean((v ?? "").trim());
  return [
    has(p?.full_name) ? null : "name",
    has(p?.vessel_name) ? null : "vessel",
    has(p?.port_id) ? null : "home port",
    has(p?.whatsapp) ? null : "telephone",
  ].filter((v): v is string => Boolean(v));
}

export function profileIsComplete(p: ProfileFacts | null | undefined): boolean {
  return missingProfileFields(p).length === 0;
}
