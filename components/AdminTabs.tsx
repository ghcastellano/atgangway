"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Board" },
  { href: "/admin/ships", label: "Ships" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/shopping-list", label: "Buy list" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="admtabs">
      {TABS.map((t) => {
        const on = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab ${on ? "on" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
