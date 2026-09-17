"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SairDaConta from "./SairDaConta";
import { IconCap, IconHeart, IconLogout, IconPackage, IconUser } from "./Icon";

/**
 * Navegação da área da conta no celular: uma barra de abas fixa
 * EMBAIXO, sempre visível.
 *
 * O menu ficava em cima do conteúdo (a lista de cartões do AccountRail),
 * e o efeito era este: a pessoa tocava em "My Orders", a tela nova
 * chegava com o MESMO menu no topo e o conteúdo abaixo da dobra — nada
 * parecia ter mudado, então ela tocava de novo, ou desistia. Todo app
 * de banco e de compras resolve isto do mesmo jeito: abas embaixo, o
 * conteúdo dono da tela, a aba ativa marcada.
 *
 * A partir de 1024px a barra some e o AccountRail volta como coluna
 * lateral, que é o padrão do desktop.
 */
const ABAS = [
  { href: "/account", rotulo: "Account", Icone: IconUser },
  { href: "/orders", rotulo: "Orders", Icone: IconPackage },
  { href: "/wishlist", rotulo: "Wish list", Icone: IconHeart },
  { href: "/captain", rotulo: "Captain", Icone: IconCap },
];

export default function AccountTabs() {
  const path = usePathname();
  return (
    <nav className="acct-tabs sup-escura" aria-label="My account">
      {ABAS.map((a) => {
        const on = path === a.href || path.startsWith(a.href + "/");
        return (
          <Link key={a.href} href={a.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <a.Icone size={20} />
            <span>{a.rotulo}</span>
          </Link>
        );
      })}
      <SairDaConta ariaLabel="Sign out">
        <IconLogout size={20} />
        <span>Sign out</span>
      </SairDaConta>
    </nav>
  );
}
