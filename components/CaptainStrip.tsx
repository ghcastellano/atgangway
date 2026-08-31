import Link from "next/link";
import ShareCode from "./ShareCode";

/**
 * O programa de indicação, na vitrine.
 *
 * Ele existia só como um item no menu da conta — atrás de um ícone de
 * 40px, dentro de um dropdown. Ninguém acha, e indicação que ninguém
 * acha não acontece. No começo de uma loja de porto, indicação é o
 * canal: quem entrega a bordo não tem vitrine na rua, e um marinheiro
 * que já comprou vale mais que qualquer anúncio, porque ele fala com
 * os outros vinte da mesma tripulação todo dia.
 *
 * Fica na home e SÓ para quem tem conta: quem não tem ainda não tem
 * código, e mostrar o programa antes do cadastro é vender uma coisa
 * que a pessoa não pode pegar. Para quem chega de fora, o convite está
 * em HeroSteps.
 *
 * O código aparece INTEIRO e grande. Um botão "ver meu código" custa um
 * toque e uma tela — e a pessoa que ia ditar o código para o colega no
 * refeitório desiste no toque.
 */
export default function CaptainStrip({
  code,
  rate,
  link,
}: {
  code: string;
  /** Percentual da faixa atual — vem de referral_rate, não de constante. */
  rate: number;
  link: string;
}) {
  return (
    <section className="capstrip">
      <div className="capmain">
        <p className="kick">Captain rewards</p>
        <h3>
          Your crew orders with your code — you earn <b>{rate}% in credit</b>, forever
        </h3>
        <p className="sub">
          Credit lands when their deposit clears, works on any future call at Santos and never
          expires.
        </p>
      </div>

      <div className="capcode">
        <span className="lbl">Your code</span>
        <strong className="code">{code}</strong>
        <ShareCode code={code} link={link} />
        <Link className="capmore" href="/captain" prefetch={false}>
          How it works ›
        </Link>
      </div>
    </section>
  );
}
