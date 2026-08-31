import Image from "next/image";
import Link from "next/link";
import AddToCart from "./AddToCart";
import WishButton from "./WishButton";
import { IconPackage } from "./Icon";
import { BADGE_LABEL, imageUrl, inStock, packSize, type ProductCard as Card } from "@/lib/catalog";
import { discountPercent, usd } from "@/lib/money";

/**
 * Card da grade, na anatomia de loja de mantimento de verdade.
 *
 * O que mudou em relação ao card anterior, e por quê:
 *
 *   Preenchimento OU borda, nunca os dois. Antes cada elemento tinha
 *   fundo E contorno — card, painel da foto, selo, coração, botão. Isso
 *   é codificação dupla: dois sinais para dizer a mesma coisa, e o
 *   resultado é uma tela que pesa sem informar mais. Aqui a separação
 *   vem do preenchimento e do espaço; contorno só onde não há fundo.
 *
 *   Texto à esquerda. O centralizado veio do Sunny e é o que faz uma
 *   grade parecer catálogo de fim de ano: com nome de uma linha ao
 *   lado de um de duas, cada bloco começa num ponto diferente e o olho
 *   não tem margem para descer. Toda loja que se compara preço em
 *   coluna — Ocado, Waitrose, Amazon Fresh, Zé, iFood — alinha à
 *   esquerda, e alinhar é o que deixa varrer trinta itens.
 *
 *   Tamanho da embalagem em linha própria. Ver `packSize`.
 *
 *   Coração sobre a foto. Ao lado do botão ele disputava a ação
 *   primária de igual para igual, sendo secundário; no canto da foto
 *   fica onde toda loja o coloca, e o "Add to cart" fica com a largura
 *   inteira, que é o alvo que a pessoa quer acertar em navio balançando.
 *
 * [otim] Continua Server Component: só o botão e o coração viram
 * JavaScript. Uma grade de 24 cards não manda 24 componentes
 * interativos para o navegador.
 */
export default function ProductCardView({
  p,
  priority = false,
  wished = false,
  sizes = "(max-width: 620px) 92vw, (max-width: 900px) 46vw, 300px",
}: {
  p: Card;
  priority?: boolean;
  /** Já está na wishlist — usado na página da lista, para o coração nascer cheio. */
  wished?: boolean;
  /** O trilho da home mostra o card a ~74vw; a grade, a ~92vw. Servir a
   *  imagem no tamanho errado é foto borrada de um lado ou byte jogado
   *  fora do outro. */
  sizes?: string;
}) {
  const src = imageUrl(p.primary_image_path);
  const off = discountPercent(p.price_cents, p.compare_at_cents);
  // inStock, e não `stock_qty <= 0`: item sem controle de saldo está
  // sempre disponível — o chandler compra contra o pedido, e a contagem
  // em prateleira não é o que limita a venda.
  const soldOut = !inStock(p);
  const from = p.max_price_cents != null && p.max_price_cents > p.price_cents;
  const { title, unit } = packSize(p.name);

  return (
    <article className={`pcard ${soldOut ? "out" : ""}`}>
      <div className="pcard-top">
        <Link href={`/p/${p.slug}`} className="pcard-media" prefetch={false}>
          {src ? (
            <Image
              src={src}
              alt={p.name}
              fill
              sizes={sizes}
              className="pcard-img"
              priority={priority}
            />
          ) : (
            <span className="pcard-noimg" aria-hidden>
              <IconPackage size={38} />
            </span>
          )}
          {soldOut && (
            <span className="pout">
              <b>Out of stock</b>
            </span>
          )}
        </Link>

        {/* Empilhados: um produto pode ser promo E ter desconto, e dois
            selos disputando o mesmo canto se sobrepõem. */}
        <div className="pflags">
          {p.badge && <span className={`pbadge ${p.badge}`}>{BADGE_LABEL[p.badge]}</span>}
          {off && <span className="poff">−{off}%</span>}
        </div>

        <WishButton productId={p.id} name={p.name} initial={wished} />
      </div>

      <div className="pcard-body">
        {/* Sempre renderizada, como a linha do tamanho: sem marca a linha
            fica vazia mas ocupa a altura, e a fileira termina alinhada. */}
        <span className="pbrand">{p.brand_name ?? "\u00A0"}</span>
        <Link href={`/p/${p.slug}`} className="pname" prefetch={false}>
          {title}
        </Link>
        {/* Sempre renderizado, mesmo vazio: sem isto o card com tamanho
            e o sem tamanho terminam com alturas diferentes, e a grade
            fica com o botão dançando de coluna para coluna. */}
        <span className="punit">{unit ?? " "}</span>

        <div className="pprice">
          <b className="now">
            {from && <i className="from">from </i>}
            {usd(p.price_cents)}
          </b>
          {p.compare_at_cents ? <s className="was">{usd(p.compare_at_cents)}</s> : null}
        </div>

        <AddToCart
          variantId={p.default_variant_id}
          slug={p.slug}
          name={p.name}
          variantCount={p.variant_count}
          soldOut={soldOut}
        />
      </div>
    </article>
  );
}
