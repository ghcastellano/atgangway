import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import { CONTACT_EMAIL } from "@/lib/env";
import { DEPOSIT_PCT } from "@/lib/money";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Accounts, delivery at Porto de Santos, deposits, customs paperwork and digital items.",
};

/**
 * FAQ no mesmo acordeão do rodapé (.sunfoot-sec): a tripulação já abre
 * e fecha aquilo todo dia, e uma segunda gramática de "abrir seção" na
 * mesma casca só cria dúvida. O que é compartilhado é a CASCA — a
 * resposta tem tipografia própria (.faq-a), porque é texto de leitura
 * e não uma fileira de links.
 *
 * [otim] <details>/<summary> nativos, sem estado em React: a página é
 * Server Component puro, abre antes de qualquer hidratação e o leitor
 * de tela já anuncia expandido/recolhido sem aria extra.
 *
 * O percentual do depósito sai de money.ts em vez de estar escrito no
 * texto — se a regra mudar, a resposta não fica mentindo.
 */
/** Texto puro de um trecho de JSX: é o que vai no FAQPage. */
function textoDe(n: React.ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join("");
  if (typeof n === "object" && "props" in n) return textoDe((n as { props: { children?: React.ReactNode } }).props.children);
  return "";
}

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do I need an account?",
    a: (
      <>
        Yes. Anything that goes on board leaves Brazil under a customs export
        regime, and the declaration has to name the buyer — full name, rank,
        vessel and nationality. That is why the{" "}
        <Link className="alink" href="/signup">
          sign-up
        </Link>{" "}
        asks for them and why we cannot take an order from an anonymous cart.
        It also keeps your order history and any store credit attached to you
        rather than to a phone number.
      </>
    ),
  },
  {
    q: "Where do you deliver?",
    a: (
      <>
        Porto de Santos (BRSSZ). Delivery at the gangway is carried out by an
        accredited ship chandler — that accreditation, not our stock, is what
        sets the schedule and the minimum time your vessel has to stay
        alongside. If the window is too tight, you can collect at our counter
        in Santos instead. The full grid is on{" "}
        <Link className="alink" href="/ports">
          Ports &amp; delivery schedule
        </Link>
        .
      </>
    ),
  },
  {
    q: "How does payment work?",
    a: (
      <>
        A {DEPOSIT_PCT}% deposit when you place the order, the remaining{" "}
        {100 - DEPOSIT_PCT}% at the gangway when you sign for the goods. The
        deposit is what reserves the stock and pays for the chandler&apos;s slot.
        Prices are in US dollars; any R$ figure on the site is a reference at
        the current rate, not the amount charged.
      </>
    ),
  },
  {
    q: "What if my vessel skips Santos?",
    a: (
      <>
        Nothing is lost. The deposit becomes store credit for the full amount,
        held on your account, and you spend it on the next call. A diverted or
        cancelled call is normal traffic, not a mistake on your side — you do
        not have to warn us in advance.
      </>
    ),
  },
  {
    q: "How fast is delivery?",
    a: (
      <>
        It depends on the port window your order falls into, not on how fast we
        pack. Order before the cut-off and the delivery day is fixed by the
        grid; order after it and you fall into the next window. The exact
        windows, delivery days and minimum stay are on{" "}
        <Link className="alink" href="/ports">
          Ports &amp; delivery schedule
        </Link>
        .
      </>
    ),
  },
  {
    q: "Do you handle customs paperwork?",
    a: (
      <>
        Yes, and it is on us — no fee and nothing for you to fill in at the
        gate. We prepare the export dispatch from what is on your profile. Keep
        it accurate: a wrong vessel name or rank is the one thing that stops a
        delivery at the terminal, and we cannot correct it once the declaration
        is filed.
      </>
    ),
  },
  {
    q: "Is this duty-free?",
    a: (
      <>
        It depends on how the goods reach you, and we would rather be exact
        than sell you a word.
        <br />
        <br />
        <b>On board.</b> Goods put aboard your vessel go under Brazil&apos;s
        ship&apos;s-stores export regime, which takes Brazilian taxes out of the
        price. The regime has conditions: the order is settled against the
        vessel, in convertible currency, through its agent. When it is settled
        that way, the price is genuinely tax-free.
        <br />
        <br />
        <b>Collected at our counter.</b> That is an ordinary Brazilian retail
        sale. Brazilian taxes are in the price. It is not duty-free, and we say
        so on every item rather than let you find out from the receipt.
        <br />
        <br />
        <b>Digital items.</b> No goods, no border, no customs. Brazilian telecom
        taxes are included.
        <br />
        <br />
        Each product page tells you which of the three applies to it, and the
        checkout tells you which one applies to your order.
      </>
    ),
  },
  {
    q: "What about eSIM and digital items?",
    a: (
      <>
        They reach the phone directly — the code and instructions go to the
        e-mail and WhatsApp on your account. No chandler, no port window, no
        minimum stay, so you can buy one from the anchorage. Once a code has
        been issued it cannot be returned.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: QA.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: textoDe(item.a) },
          })),
        }}
      />
      <Breadcrumb trail={[{ label: "FAQ" }]} />

      <h1 className="pagettl">FAQ</h1>
      <p className="pagelead">
        How ordering, delivery and customs actually work at Porto de Santos.
        Anything not answered here:{" "}
        <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      {QA.map((item) => (
        <details key={item.q} className="sunfoot-sec">
          <summary>{item.q}</summary>
          {/* Classe PRÓPRIA, não a do rodapé.
              O corpo da resposta usava `.sunfoot-body` com a resposta
              inteira dentro de um <span> — e a regra do rodapé fazia
              `span { display: flex }`. Flex é em LINHA por padrão, então
              cada trecho de texto e cada link viravam uma COLUNA: a
              resposta se partia em três pedaços lado a lado. O acordeão
              (.sunfoot-sec) continua compartilhado porque é casca; o
              conteúdo é texto de leitura e não tem nada a ver com uma
              fileira de links de rodapé. */}
          <div className="faq-a">{item.a}</div>
        </details>
      ))}
    </main>
  );
}
