"use client";

import { usePathname } from "next/navigation";

/**
 * O painel tem casca própria (Vessel Ops + abas). Sem esta porteira
 * o cabeçalho da loja — hambúrguer, busca, carrinho — apareceria em
 * cima dele, oferecendo ao operador uma navegação que não é a dele.
 *
 * Cliente só por causa do pathname: o filho continua sendo Server
 * Component e é renderizado no servidor normalmente.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
