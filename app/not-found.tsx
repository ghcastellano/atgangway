import Link from "next/link";
import { IconCompass } from "@/components/Icon";

export const metadata = { title: "Page not found" };

/**
 * 404 da casa. Sem isto o Next serve a tela branca padrão dele — sem
 * cabeçalho, sem rodapé, sem saída. Quem digitou errado o nome de uma
 * categoria simplesmente perdia a loja.
 *
 * As saídas não são decoração: link para a busca e para o catálogo é o
 * que transforma um erro de endereço em uma visita que continua.
 */
export default function NotFound() {
  return (
    <main>
      <div className="okwrap">
        {/* traço da família, não emoji: o 404 também é vitrine */}
        <div className="okring" aria-hidden>
          <IconCompass size={30} />
        </div>
        <h2>Off the chart</h2>
        <p>This page isn&apos;t on our map. It may have sailed, or the link is mistyped.</p>
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <Link className="btn" href="/shop">
          Browse the catalog
        </Link>
        <Link className="btn ghost" href="/">
          Back to home
        </Link>
        <p className="finehint" style={{ textAlign: "center" }}>
          Looking for an order? It&apos;s under{" "}
          <Link className="alink" href="/orders">
            My Orders
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
