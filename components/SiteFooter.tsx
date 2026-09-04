import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/env";

/**
 * Rodapé em acordeão, como o do Sunny. Fechado por padrão: no celular
 * um rodapé aberto com quatro colunas é uma tela inteira de rolagem
 * que ninguém lê.
 *
 * [otim] <details>/<summary> nativos em vez de estado em JavaScript —
 * abre mesmo antes de o React hidratar e funciona com leitor de tela
 * sem nenhuma aria extra.
 */
/**
 * Três colunas de peso parecido, e não cinco desiguais.
 *
 * Estavam 3, 5, 4 e 2 links — a última com um endereço postal
 * disfarçado de link para a home, que é afordância mentirosa: clicar
 * num endereço tem de fazer algo com o endereço, ou não ser link.
 * Rodapé com colunas de alturas muito diferentes lê como lista de
 * sobras, não como mapa do site.
 *
 * "Photo credits" saiu daqui e foi para a linha legal: é obrigação de
 * licença, e mora junto de termos e privacidade.
 */
const SECTIONS = [
  {
    title: "Shop",
    links: [
      { label: "Catalog & flyers", href: "/brochures" },
      { label: "New arrivals", href: "/shop?sort=newest" },
      { label: "Promotions", href: "/shop?badge=promo" },
      { label: "Captain rewards", href: "/captain" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Ports & delivery schedule", href: "/ports" },
      { label: "Contact us", href: `mailto:${CONTACT_EMAIL}` },
      // wa.me sem ?text= abre a conversa EM BRANCO: a pessoa clica em
      // "WhatsApp" no rodapé de uma loja, cai num campo vazio e tem de
      // inventar o que dizer — e nós recebemos "oi" sem contexto. A
      // mensagem já vem escrita, e diz de onde veio.
      {
        label: "WhatsApp",
        href:
          "https://wa.me/5511970561448?text=" +
          encodeURIComponent("Hi! I'm on atgangway.com and I have a question about supplies for my vessel."),
      },
    ],
  },
  {
    title: "My Account",
    links: [
      { label: "My orders", href: "/orders" },
      { label: "My wish list", href: "/wishlist" },
      { label: "Account information", href: "/account" },
    ],
  },
];

/**
 * Selos de pagamento no padrão de mercado: chips uniformes com a MARCA
 * desenhada, mudos de cor.
 *
 * Já foram duas coisas erradas. Primeiro cinco retângulos brancos com
 * texto preto — o elemento mais claro de uma página escura inteira.
 * Depois, na correção, viraram texto corrido em monoespaçada, que lê
 * como saída de terminal, não como selo. O padrão que toda loja grande
 * usa é o meio-termo: chips do mesmo tamanho, contorno discreto, marca
 * reconhecível pelo DESENHO (os círculos do Mastercard) ou pelo
 * logotipo, sem a cor berrante de cada bandeira.
 *
 * SVG desenhado aqui em vez de imagem: cinco arquivos de logo para um
 * rodapé é peso e pedido HTTP à toa, e currentColor deixa o conjunto
 * inteiro no mesmo tom — que é o que o faz parecer conjunto.
 */
function ChipPagamento({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <span className="paychip" role="img" aria-label={nome} title={nome}>
      {children}
    </span>
  );
}

function SelosPagamento() {
  return (
    <p className="paywall">
      <span className="lb">We accept</span>
      <ChipPagamento nome="Visa">
        <svg viewBox="0 0 44 14" width="34" height="12" aria-hidden>
          <text x="22" y="11.5" textAnchor="middle" fontFamily="var(--font-disp)"
            fontStyle="italic" fontWeight="800" fontSize="13" letterSpacing="1"
            fill="currentColor">VISA</text>
        </svg>
      </ChipPagamento>
      <ChipPagamento nome="Mastercard">
        <svg viewBox="0 0 30 18" width="26" height="16" aria-hidden>
          <circle cx="11" cy="9" r="7.5" fill="currentColor" opacity=".85" />
          <circle cx="19" cy="9" r="7.5" fill="currentColor" opacity=".45" />
        </svg>
      </ChipPagamento>
      <ChipPagamento nome="Apple Pay">
        <svg viewBox="0 0 54 14" width="42" height="12" aria-hidden>
          {/* a maçã: folha + corpo com a mordida recortada por um círculo do fundo */}
          <path fill="currentColor" d="M7.3 1.6c.5-.7 1.4-1.2 2.1-1.2.1.8-.2 1.6-.7 2.2-.5.7-1.3 1.2-2.1 1.1-.1-.7.3-1.5.7-2.1zM9.3 4c-1.2-.1-2.2.7-2.8.7-.6 0-1.5-.6-2.4-.6-1.2 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.6-.9 2.2-1.8.7-1 1-2 1-2.1 0 0-1.9-.7-1.9-2.9 0-1.8 1.5-2.7 1.6-2.7-.9-1.3-2.2-1.4-2.7-1.5z"/>
          <text x="14" y="11.5" fontFamily="var(--font-body)" fontWeight="700"
            fontSize="11.5" fill="currentColor">Pay</text>
        </svg>
      </ChipPagamento>
      <ChipPagamento nome="Google Pay">
        <svg viewBox="0 0 52 14" width="40" height="12" aria-hidden>
          <text x="0" y="11.5" fontFamily="var(--font-body)" fontWeight="700"
            fontSize="11.5" fill="currentColor">G&#8202;Pay</text>
        </svg>
      </ChipPagamento>
      <ChipPagamento nome="PIX">
        <svg viewBox="0 0 40 14" width="32" height="12" aria-hidden>
          {/* o losango de nós do PIX, simplificado a um tom */}
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M7 2.2 11.8 7 7 11.8 2.2 7Z" />
            <path d="M4.6 4.6 7 2.2l2.4 2.4M4.6 9.4 7 11.8l2.4-2.4" opacity=".55" />
          </g>
          <text x="15" y="11.5" fontFamily="var(--font-body)" fontWeight="700"
            fontSize="11.5" fill="currentColor">PIX</text>
        </svg>
      </ChipPagamento>
    </p>
  );
}

export default function SiteFooter() {
  return (
    <footer className="sunfoot">
      {/* Coluna de marca: só aparece no desktop, onde o rodapé vira
          colunas em vez de acordeão. No celular o CSS a esconde e o
          acordeão continua exatamente como está — ele foi validado. */}
      <div className="sunfoot-brand">
        <p className="bl">
          At <b>Gangway</b>
        </p>
        <p>
          Pre-order before docking. 30% deposit now, the rest at the gangway. Porto de Santos.
        </p>
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
      </div>
      {SECTIONS.map((s) => (
        <details key={s.title} className="sunfoot-sec">
          <summary>{s.title}</summary>
          <div className="sunfoot-body">
            {s.links.map((l) => (
              <Link key={l.label} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </details>
      ))}

      {/* Pagamento e linha legal num bloco só. Eram dois itens da grade,
          cada um com o próprio border-top, e o column-gap abria um corte
          visível no meio do fio — um traço partido lê como defeito de
          renderização. */}
      <div className="sunfoot-base">
      <SelosPagamento />

      <div className="sunfoot-legal">
        © {new Date().getFullYear()} At Gangway — Porto de Santos.
        <br />
        <Link href="/terms">Terms &amp; Conditions</Link> ·{" "}
        <Link href="/privacy">Privacy Policy</Link> ·{" "}
        <Link href="/attributions">Photo credits</Link>
      </div>
      </div>
    </footer>
  );
}
