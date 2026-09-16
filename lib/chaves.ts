/**
 * Nomes das chaves que a loja guarda no navegador.
 *
 * Nasceram com o prefixo `ms.`, do nome antigo da loja. A troca para
 * `ag.` não pode apagar o carrinho de quem já tem um: na primeira carga
 * depois do deploy, o valor da chave antiga passa para a nova e a
 * antiga sai. Roda quando este módulo é carregado — antes de qualquer
 * efeito de componente, que é onde as chaves são lidas. Filho roda
 * efeito antes do pai, então migrar dentro de um efeito deixaria algum
 * leitor olhando a chave nova ainda vazia.
 */

export const CHAVE_CARRINHO = "ag.cart.v2";
export const CHAVE_INDICACAO = "ag.ref.v1";
export const CHAVE_DESEJOS = "ag.wish.pending";

/** antiga → nova. Os nomes antigos só existem aqui, para a migração. */
const RENOMEADAS: Record<string, string> = {
  "ms.cart.v2": CHAVE_CARRINHO,
  "ms.ref.v1": CHAVE_INDICACAO,
  "ms.wish.pending": CHAVE_DESEJOS,
};

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Leva cada valor da chave antiga para a nova. Se a nova já tem valor,
 * ela vence: é o que a pessoa fez depois do deploy.
 */
export function migrarChaves(s: Armazem): void {
  for (const [antiga, nova] of Object.entries(RENOMEADAS)) {
    const valor = s.getItem(antiga);
    if (valor === null) continue;
    if (s.getItem(nova) === null) s.setItem(nova, valor);
    s.removeItem(antiga);
  }
}

if (typeof window !== "undefined") {
  try {
    migrarChaves(window.localStorage);
  } catch {
    // storage indisponível (modo privado etc.) — não há o que migrar
  }
}
