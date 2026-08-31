import Link from "next/link";

/**
 * Migalha de pão, como a do Sunny ("Home › Brochures").
 *
 * Substitui o botão de voltar por página: com o cabeçalho global, o
 * que orienta é onde a pessoa está na árvore, não de onde veio.
 */
export default function Breadcrumb({
  trail,
}: {
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      {trail.map((t, i) => (
        <span key={`${i}-${t.label}`} style={{ display: "contents" }}>
          <span className="sep" aria-hidden>›</span>
          {t.href ? <Link href={t.href}>{t.label}</Link> : <span aria-current="page">{t.label}</span>}
        </span>
      ))}
    </nav>
  );
}
