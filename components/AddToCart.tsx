"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

/**
 * Ação primária do card.
 *
 * Produto com mais de uma variante não entra no carrinho daqui: leva
 * para a ficha, porque adicionar "um tamanho qualquer" é como o
 * pedido chega errado na prancha.
 *
 * Com variante única, adiciona no lugar — e o botão vira contador. Era
 * um rótulo "In cart · 2" antes, que informa e não deixa fazer nada:
 * para pedir a terceira lata a pessoa tinha de abrir a gaveta do
 * carrinho e voltar. Toda loja de mantimento séria (Ocado, Instacart,
 * iFood, Rappi) troca o botão por −/+ no mesmo lugar, e a compra de
 * rancho é justamente a que repete quantidade: seis do mesmo café,
 * doze da mesma água.
 */
export default function AddToCart({
  variantId,
  slug,
  name,
  variantCount,
  soldOut,
}: {
  variantId: string | null;
  slug: string;
  name: string;
  variantCount: number;
  soldOut: boolean;
}) {
  const router = useRouter();
  const { items, add, change } = useCart();
  const qty = variantId ? (items[variantId] ?? 0) : 0;

  if (soldOut) {
    return (
      <button className="padd" disabled>
        Out of stock
      </button>
    );
  }

  if (variantCount > 1 || !variantId) {
    return (
      <button className="padd ghost" onClick={() => router.push(`/p/${slug}`)}>
        Choose option
      </button>
    );
  }

  if (qty > 0) {
    return (
      <div className="pstep" role="group" aria-label={`Quantity — ${name}`}>
        <button
          type="button"
          className="pstep-b"
          onClick={() => change(variantId, -1)}
          aria-label={qty === 1 ? `Remove ${name} from cart` : `One less ${name}`}
        >
          <span aria-hidden>−</span>
        </button>
        {/* aria-live: quem usa leitor de tela ouve a nova quantidade sem
            precisar reencontrar o botão que acabou de tocar. */}
        <output className="pstep-n" aria-live="polite">
          {qty}
        </output>
        <button
          type="button"
          className="pstep-b"
          onClick={() => change(variantId, 1)}
          aria-label={`One more ${name}`}
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    );
  }

  return (
    <button
      className="padd"
      onClick={() => add(variantId)}
      // O texto visível ("Add to cart") tem de ser prefixo do nome
      // acessível, senão comando de voz não acha o botão — WCAG 2.5.3.
      aria-label={`Add to cart — ${name}`}
    >
      Add to cart
    </button>
  );
}
