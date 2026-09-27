import Link from "next/link";
import JsonLd from "./JsonLd";
import { SITE_URL } from "@/lib/env";

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
  // A mesma trilha, para o Google: o último item não leva URL.
  const lista = [{ label: "Home", href: "/" }, ...trail].map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.label,
    ...(t.href ? { item: `${SITE_URL}${t.href}` } : {}),
  }));

  return (
    <nav className="crumb" aria-label="Breadcrumb">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: lista }} />
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
