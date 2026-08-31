import Link from "next/link";
import { IconCap, IconHeart, IconPackage, IconUser } from "./Icon";
import CategoryIcon from "./CategoryIcon";
import { CONTACT_EMAIL } from "@/lib/env";
import { signOut } from "@/app/account/actions";

/**
 * Navegação das telas de conta. UMA lista, nas quatro telas e em todas
 * as larguras.
 *
 * Eram cinco menus diferentes para quatro telas, e dava para ver: em
 * /account o menu trazia My Orders, My Wish List, Captain rewards,
 * Staff panel, Sign Out e o contato; em /orders e /wishlist o Staff
 * panel e o Sign Out sumiam; em /captain não havia menu nenhum; e a
 * /wishlist ainda tinha um <select> com uma sexta combinação.
 *
 * A causa não foi descuido de quem escreveu cada página: era ESTE
 * componente exigir que o chamador lembrasse de passar isAdmin e de
 * enfiar o Sign Out como children. Três dos quatro esqueceram, e o
 * default silencioso (isAdmin = false) escondeu — um admin deixava de
 * ser admin ao clicar em "My Orders".
 *
 * Agora nada é opcional: isAdmin é obrigatório, então o compilador cobra
 * de quem esquecer, e o Sign Out mora aqui dentro, então não há como uma
 * tela ficar sem ele.
 *
 * Server Component, sem JavaScript no cliente.
 */

type Item = { href: string; icon: React.ReactNode; nome: string; nota: string };

/* Traço da família no lugar do emoji: o rail vive ao lado dos catcards
   da home, que já usam o traço — dois estilos de ícone na mesma classe
   liam como duas interfaces. */
const ITENS: Item[] = [
  { href: "/account", icon: <IconUser className="ic" size={19} />, nome: "My Account", nota: "Name, vessel and port" },
  { href: "/orders", icon: <IconPackage className="ic" size={19} />, nome: "My Orders", nota: "Track every delivery" },
  { href: "/wishlist", icon: <IconHeart className="ic" size={19} />, nome: "My Wish List", nota: "Saved for the next call" },
  { href: "/captain", icon: <IconCap className="ic" size={19} />, nome: "Captain rewards", nota: "Your code and credit" },
];

export default function AccountRail({
  current,
  isAdmin,
}: {
  /** Rota da tela atual — recebe aria-current e deixa de ser link. */
  current: string;
  /** Obrigatório de propósito: com default, três telas esqueceram. */
  isAdmin: boolean;
}) {
  return (
    <nav className="acct-rail" aria-label="My account">
      <div className="catgrid">
        {ITENS.map((i) => {
          /* A tela atual FICA na lista, marcada, em vez de sumir dela.
             Sumindo, o menu mudava de tamanho a cada clique e a pessoa
             perdia a referência de onde está — e o estilo de
             aria-current que já existia no CSS nunca chegava a valer,
             porque nada o recebia. <span> em vez de <Link>: link para a
             página onde já se está é afordância mentirosa. */
          if (i.href === current) {
            return (
              <span key={i.href} className="catcard" aria-current="page">
                {i.icon}
                <span className="tx">
                  <span className="nm">{i.nome}</span>
                  <span className="ct">{i.nota}</span>
                </span>
              </span>
            );
          }
          return (
            <Link key={i.href} href={i.href} className="catcard">
              {i.icon}
              <span className="tx">
                <span className="nm">{i.nome}</span>
                <span className="ct">{i.nota}</span>
              </span>
              <span className="chev" aria-hidden>
                ›
              </span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link href="/admin" className="catcard">
            {/* o traço de "tools" já existe no CategoryIcon — reúso, não desenho novo */}
            <CategoryIcon slug="tools" size={19} />
            <span className="tx">
              <span className="nm">Staff panel</span>
              <span className="ct">Orders, catalog and line-up</span>
            </span>
            <span className="chev" aria-hidden>
              ›
            </span>
          </Link>
        )}
      </div>

      {/* Sign Out e contato vivem AQUI, não como children de quem chama:
          era esse o motivo de /orders, /wishlist e /captain terminarem
          sem saída de sessão. Como position:sticky não gruda dois
          irmãos, o bloco segue sendo filho do <nav>. */}
      <div className="stack">
        <form action={signOut}>
          <button className="btn danger" type="submit">
            Sign Out
          </button>
        </form>
        <p className="finehint">
          Questions about an order? Write{" "}
          <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          or find us at our counter in Santos.
        </p>
      </div>
    </nav>
  );
}
