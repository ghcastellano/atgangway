"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/account/actions";
import { IconAnchor, IconCart, IconCompass, IconLogout, IconPackage } from "@/components/Icon";
import { ToastProvider } from "./Toast";
import Sino, { type Notificacao } from "./Sino";

/**
 * A casca do painel.
 *
 * Desktop: barra lateral fixa com as seções, conteúdo à direita.
 * Celular: barra de abas embaixo, sempre visível — o conteúdo ocupa a
 * tela toda e nunca fica "escondido debaixo do menu", que era a
 * reclamação da área do cliente e vale aqui também.
 *
 * Só o estado de UI é cliente (menu do usuário). Quem decide se a
 * pessoa pode estar aqui é o layout servidor que a envolve.
 */
const SECOES = [
  { href: "/admin", rotulo: "Pedidos", icone: IconPackage },
  { href: "/admin/ships", rotulo: "Navios", icone: IconAnchor },
  { href: "/admin/catalog", rotulo: "Catálogo", icone: IconCompass },
  { href: "/admin/shopping-list", rotulo: "Compras", icone: IconCart },
];

export default function AdminShell({
  email,
  notificacoes,
  children,
}: {
  email: string;
  notificacoes: Notificacao[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const ativa = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const atual = SECOES.find((s) => ativa(s.href));

  return (
    <ToastProvider>
      <div className="adm">
        <aside className="adm-side" aria-label="Seções do painel">
          <Link href="/admin" className="adm-brand" aria-label="Painel At Gangway">
            <IconAnchor className="mark" size={20} />
            <span>
              <b>At Gangway</b>
              <small>Painel da operação</small>
            </span>
          </Link>
          <nav className="adm-nav">
            {SECOES.map((s) => (
              <Link key={s.href} href={s.href} className={ativa(s.href) ? "on" : ""} aria-current={ativa(s.href) ? "page" : undefined}>
                <s.icone size={18} />
                <span>{s.rotulo}</span>
              </Link>
            ))}
          </nav>
          <div className="adm-side-foot">
            <Link href="/" className="adm-side-link">← Ver a loja</Link>
          </div>
        </aside>

        <div className="adm-main">
          <header className="adm-top">
            <h1>{atual?.rotulo ?? "Painel"}</h1>
            <div className="adm-top-acoes">
              <Sino inicial={notificacoes} />
              <div className="adm-user" ref={box}>
                <button
                  type="button"
                  className="adm-avatar"
                  onClick={() => setMenu((m) => !m)}
                  aria-expanded={menu}
                  aria-label={`Conta ${email}`}
                  title={email}
                >
                  {email.slice(0, 1).toUpperCase()}
                </button>
                {menu && (
                  <div className="adm-menu" role="menu">
                    <p className="adm-menu-email">{email}</p>
                    <Link href="/reset-password" role="menuitem" onClick={() => setMenu(false)}>
                      Trocar senha
                    </Link>
                    <Link href="/" role="menuitem" onClick={() => setMenu(false)}>
                      Ver a loja
                    </Link>
                    <form action={signOut}>
                      <button type="submit" role="menuitem">
                        <IconLogout size={16} /> Sair
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="adm-content">{children}</div>
        </div>

        <nav className="adm-tabs" aria-label="Seções do painel">
          {SECOES.map((s) => (
            <Link key={s.href} href={s.href} className={ativa(s.href) ? "on" : ""} aria-current={ativa(s.href) ? "page" : undefined}>
              <s.icone size={20} />
              <span>{s.rotulo}</span>
            </Link>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
