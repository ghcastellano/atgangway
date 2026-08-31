"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconAnchor } from "@/components/Icon";
import { CONTACT_EMAIL } from "@/lib/env";

/**
 * Barreira de erro das telas da loja.
 *
 * Sem ela, qualquer exceção em render derrubava a página inteira na
 * tela padrão do Next — sem cabeçalho, sem carrinho, sem caminho de
 * volta. Numa conexão de navio, a pessoa não recarrega: ela desiste.
 *
 * "Try again" chama reset(), que refaz só o segmento que quebrou. Na
 * maioria das falhas daqui (consulta que expirou no wifi de bordo) isso
 * resolve sem recarregar o site todo.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O digest é o que liga esta tela à linha do log da Vercel — sem
    // ele, "deu erro" é tudo que sobra para diagnosticar.
    console.error(JSON.stringify({ at: "render_error", digest: error.digest, message: error.message }));
  }, [error]);

  return (
    <main>
      <div className="okwrap">
        {/* traço da família, não emoji: cada sistema desenha a âncora
            de um jeito, e esta tela já aparece num momento ruim */}
        <div className="okring" aria-hidden>
          <IconAnchor size={30} />
        </div>
        <h2>Something slipped</h2>
        <p>This screen didn&apos;t load. It&apos;s on our side, not yours.</p>
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btn ghost" href="/shop">
          Back to the catalog
        </Link>
        <p className="finehint" style={{ textAlign: "center" }}>
          Still stuck? Write to{" "}
          <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          {error.digest ? (
            <>
              {" "}
              and quote <span className="mono">{error.digest}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      </div>
    </main>
  );
}
