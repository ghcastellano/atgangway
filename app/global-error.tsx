"use client";

/**
 * Último recurso: erro no PRÓPRIO layout raiz, onde error.tsx não
 * alcança porque o layout que o envolve é o que quebrou. Por isso esta
 * tela traz <html> e <body> próprios e não usa nada do site — nem
 * cabeçalho, nem CSS de componente, nem provider.
 *
 * Estilo inline pelo mesmo motivo: se a folha de estilo for a origem do
 * problema, uma tela que depende dela some junto.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#01060D",
          color: "#EEF4F8",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>
            ⚓
          </div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>At Gangway is down for a moment</h1>
          <p style={{ color: "#9FB4C8", fontSize: 14, margin: "0 0 20px" }}>
            We hit an error loading the site. Try again in a few seconds.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#FFB648",
              color: "#0B1B30",
              border: 0,
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ color: "#6B8299", fontSize: 12, marginTop: 18, fontFamily: "monospace" }}>
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
