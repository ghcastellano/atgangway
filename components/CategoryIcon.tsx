/**
 * Ícones das categorias, no mesmo traço do cabeçalho.
 *
 * As categorias guardam um emoji no banco (categories.icon), o que
 * resolveu o começo mas envelheceu mal: emoji colorido ao lado de
 * ícones de traço monocromático lê como duas interfaces coladas — e
 * cada sistema desenha o seu, então a grade muda de cara entre iOS e
 * Android.
 *
 * O emoji do banco vira RETAGUARDA: categoria nova criada no painel
 * continua mostrando o que o admin escolheu, até alguém desenhar o
 * traço dela. Assim nada quebra quando o catálogo crescer.
 */

const PATHS: Record<string, string> = {
  promo:
    "M8.6 4.2 10.4 7l3.2.5-2.3 2.3.5 3.2-2.9-1.5-2.9 1.5.6-3.2L4.3 7.5 7.5 7ZM14 14l6 6M17.5 13.6l1.5 1.5M13.6 17.5l1.5 1.5",
  "new-arrivals":
    "m12 3.2 2 4.6 4.9.5-3.7 3.3 1.1 4.8L12 13.9l-4.3 2.5 1.1-4.8L5.1 8.3l4.9-.5ZM18.6 17.4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7Z",
  connectivity: "M5 19.5v-4M10 19.5v-7.5M15 19.5V8M20 19.5V4.5",
  "food-drinks":
    "M4.6 4.5h9.2l-.8 15h-7.6ZM4.6 9h9.2M17.5 6.5h1.6a2.2 2.2 0 0 1 0 4.4h-1.4M17.4 4.5v15",
  "beauty-health":
    "M9.6 3.5h4.8v2.8H9.6ZM8 6.3h8v1.8a3 3 0 0 1-1 2.2 3 3 0 0 0-1 2.2v6a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-6a3 3 0 0 0-1-2.2 3 3 0 0 1-1-2.2Z",
  electronics:
    "M7 4.6h10a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.6a2 2 0 0 1 2-2ZM9.6 8.4h4.8v4.8H9.6ZM9.6 16.6h4.8",
  fashion:
    "M9 3.6 12 6l3-2.4 4.6 2.6-2 4-2-1v10.2H8.4V9.2l-2 1-2-4Z",
  "watches-jewellery":
    "M12 7.2a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8ZM12 9.6v2.6l1.7 1.1M9.3 7.6 9.6 3.6h4.8l.3 4M9.3 16.6l.3 3.8h4.8l.3-3.8",
  "travel-leisure":
    "M6.2 8.4h11.6a1.8 1.8 0 0 1 1.8 1.8v7.5a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8v-7.5a1.8 1.8 0 0 1 1.8-1.8ZM9.2 8.4V5.6a1.4 1.4 0 0 1 1.4-1.4h2.8a1.4 1.4 0 0 1 1.4 1.4v2.8M9.6 19.5v1.3M14.4 19.5v1.3",
  "domestic-appliances":
    "M6.4 3.8h11.2a1.6 1.6 0 0 1 1.6 1.6v13.2a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6ZM12 9.4a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8ZM8 6.6h.1M11 6.6h.1",
  tools:
    "M14.4 3.9a4.4 4.4 0 0 0 5.4 5.9l-9.6 9.6a2.1 2.1 0 0 1-3-3l9.6-9.6a4.4 4.4 0 0 0-2.4-2.9ZM6.4 17.6h.1",
  tobacco:
    "M3.6 15.4h12.8v3.4H3.6ZM18.4 15.4h2v3.4h-2M16.6 12.4c1.6-.5 2.6-1.6 2.6-3.1s-1-2.6-2.6-3.1M19.6 13.2c1.2-.7 1.9-1.9 1.9-3.4s-.7-2.7-1.9-3.4",
  outlet:
    "M4.6 11.2V5.8a1.2 1.2 0 0 1 1.2-1.2h5.4l8.2 8.2a1.7 1.7 0 0 1 0 2.4l-4.6 4.6a1.7 1.7 0 0 1-2.4 0L4.2 11.6ZM8.4 8.4h.1",
};

export default function CategoryIcon({
  slug,
  fallback,
  size = 21,
}: {
  slug: string;
  /** Emoji do banco, usado quando não há traço desenhado para a categoria. */
  fallback?: string | null;
  size?: number;
}) {
  const d = PATHS[slug];
  if (!d) {
    return (
      <span className="ic" aria-hidden>
        {fallback ?? "▪"}
      </span>
    );
  }
  return (
    <svg
      className="ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <path d={d} />
    </svg>
  );
}
