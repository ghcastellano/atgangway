/**
 * De quem é o carrinho guardado no navegador.
 *
 * O carrinho vive no localStorage, e o localStorage é do NAVEGADOR, não
 * da pessoa: quem saía da conta e entrava com outra encontrava o
 * carrinho de quem saiu. O padrão das lojas grandes é o contrário — o
 * carrinho acompanha a conta, e o de visitante é levado junto no login.
 *
 * Regras, com `dono` = quem tinha o carrinho e `uid` = quem está agora:
 *   - visitante → entrou: leva os itens (dono passa a ser a conta);
 *   - mesma conta: mantém;
 *   - outra conta, ou saiu: descarta.
 */
export type Itens = Record<string, number>;

export function reconciliar(
  guardado: { items: Itens; dono: string | null },
  uid: string | null
): Itens {
  if (guardado.dono === uid) return guardado.items;
  if (guardado.dono === null && uid !== null) return guardado.items;
  return {};
}
