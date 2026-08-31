import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Brochures",
  description:
    "Seasonal catalogues and flyers for the Santos call — published here as they are signed off.",
};

/**
 * Brochures — seção 9 da espec: migalha, título com sublinhado âmbar e
 * a lista vertical de capas.
 *
 * Não há PDF cadastrado ainda, e capa inventada é pior que prateleira
 * vazia: quem baixa um catálogo espera pedir exatamente pelo que viu
 * ali, e um flyer falso vira reclamação no balcão. Então o vazio é
 * honesto e empurra para onde a oferta REALMENTE está hoje — que é o
 * mesmo destino que a barra de anúncio ("View Catalog & Flyers")
 * usava enquanto esta rota não existia.
 */
export default function BrochuresPage() {
  return (
    <main>
      <Breadcrumb trail={[{ label: "Brochures" }]} />

      <h1 className="pagettl">Brochures</h1>
      <p className="pagelead">
        Seasonal catalogues and flyers for the Santos call, mirrored here so you
        can order from the same sheet the crew gets at the gangway.
      </p>

      <div className="empty">
        <div className="i" aria-hidden>
          📕
        </div>
        No catalogue is published yet.
        <br />
        The first seasonal flyer is being put together and appears on this page
        as soon as it is signed off — nothing before that.
      </div>

      <div className="stack">
        <Link className="btn" href="/shop?badge=promo" prefetch={false}>
          This month&apos;s promotions
        </Link>
        <Link className="btn ghost" href="/shop?badge=new" prefetch={false}>
          New arrivals
        </Link>
      </div>
    </main>
  );
}
