import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { CONTACT_EMAIL } from "@/lib/env";
import { DEPOSIT_PCT } from "@/lib/money";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "How an order with Vessel Supplier works — deposit, balance at the gangway, cancellation rights and credit for a diverted call.",
};

/** Data da última revisão do texto. Termo sem data é termo que ninguém
 *  sabe se ainda vale — e o CDC exige que a versão vigente seja
 *  identificável. */
const LAST_UPDATED = "26 August 2026";

/**
 * Termos de uso.
 *
 * Reescrito com as âncoras legais que faltavam para uma venda a
 * distância no Brasil. A que mais importa: o CDC (art. 49) dá SETE
 * DIAS de arrependimento em compra fora do estabelecimento, contados
 * do recebimento. A versão anterior deste texto oferecia menos que
 * isso ("cancele antes de sair do balcão") — cláusula que promete
 * menos que a lei é nula, e pior, faz o cliente achar que não tem
 * direito. Agora está escrito.
 *
 * Cláusulas numeradas de propósito: é o que permite ao suporte dizer
 * "isso está na 7.2" em vez de mandar a pessoa ler tudo de novo.
 *
 * O aviso de rascunho fica ANTES do título. Continua valendo: falta
 * revisão de advogado e faltam CNPJ e razão social, que eu não invento.
 */
export default function TermsPage() {
  return (
    <main>
      <Breadcrumb trail={[{ label: "Terms & Conditions" }]} />

      <p className="draftnote">
        <b>Operational draft — pending legal review.</b> This text describes how
        we work today and reflects the Brazilian consumer rules we know apply to
        us. It has not yet been reviewed by counsel, and the company
        registration details in clause 1 are still to be filled in. Until both
        are done, treat it as a good-faith description rather than a signed
        contract. Where this text gives you less than Brazilian law does, the
        law wins.
      </p>

      <h1 className="pagettl">Terms &amp; Conditions</h1>
      <p className="pagelead">
        Last updated {LAST_UPDATED}. These terms govern orders placed with
        Vessel Supplier.
      </p>

      <section className="pdp-block">
        <h3>1 · Who you are contracting with</h3>
        <p className="pdp-text">
          Vessel Supplier is the online store at Porto de Santos, São Paulo,
          Brazil. Orders are handled by the same
          people who run the counter — there is no marketplace between us and
          you.
        </p>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          <b>Pending:</b> registered company name, CNPJ and full registered
          address are to be published here before these terms are final. Ask us
          and we will send them today.
        </p>
      </section>

      <section className="pdp-block">
        <h3>2 · Who can order</h3>
        <ul className="specs">
          <li>
            You must be 18 or over. Tobacco and alcoholic ship&apos;s stores are
            sold only to adults, and we may ask for identification at handover.
          </li>
          <li>
            On-board delivery is for crew serving on a vessel calling at a port
            we list. Counter pickup in Santos is open to anyone who
            can collect in person.
          </li>
          <li>
            An account with your real name, rank, vessel and nationality is
            required. This is not marketing: goods delivered on board leave
            Brazil under an export regime and are declared to customs with those
            details. False information can cause the shipment to be seized.
          </li>
          <li>
            Keep your password to yourself. Orders placed from your account are
            treated as yours; tell us immediately if you think someone else got
            in.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>3 · When the order becomes binding</h3>
        <p className="pdp-text">
          Placing an order is an offer. The contract forms when we confirm your
          deposit payment by e-mail. Until that confirmation, nothing is
          reserved and either side can walk away.
        </p>
      </section>

      <section className="pdp-block">
        <h3>4 · Prices, payment and errors</h3>
        <ul className="specs">
          <li>
            Prices are shown in US dollars and include the duties applicable to
            the delivery channel you chose. Any R$ figure is a reference at the
            day&apos;s rate, not the amount charged.
          </li>
          <li>
            You pay a {DEPOSIT_PCT}% deposit when you order. That is what
            reserves the stock and pays for the delivery slot.
          </li>
          <li>
            The remaining {100 - DEPOSIT_PCT}% is paid at the gangway, or at the
            counter, when you check the goods and sign for them.
          </li>
          <li>
            Card payments are processed by Stripe. We never see or store your
            card number.
          </li>
          <li>
            If a price is obviously wrong — a decimal in the wrong place, a
            USD 900 speaker listed at USD 9 — we will tell you before charging
            anything and you can confirm at the correct price or cancel with a
            full refund. We will not quietly charge you the higher amount.
          </li>
          <li>
            Some ports set a minimum order. It is shown in your cart and on{" "}
            <Link className="alink" href="/ports">
              Ports &amp; delivery schedule
            </Link>
            .
          </li>
          <li>
            <b>Whether the price is tax-free depends on the channel.</b> Goods
            put on board under the ship&apos;s-stores export regime carry no
            Brazilian tax, but the regime requires the order to be settled
            against the vessel, in convertible currency, through its agent.
            Anything collected at our counter, or settled on your own card
            without that arrangement, is an ordinary Brazilian retail sale with
            Brazilian taxes in the price. The product page and the checkout say
            which one applies before you pay.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>5 · Delivery</h3>
        <ul className="specs">
          <li>
            The delivery day comes from the port grid, not from your
            vessel&apos;s ETA. Find your window on{" "}
            <Link className="alink" href="/ports">
              Ports &amp; delivery schedule
            </Link>
            .
          </li>
          <li>
            We handle the customs paperwork for on-board delivery at no extra
            charge.
          </li>
          <li>
            Delivery on board depends on an accredited ship chandler and on the
            terminal granting access on the day. Neither is under our control.
          </li>
          <li>
            If your vessel stays alongside for less than the minimum shown for
            that port, delivery may not be possible. The order then becomes
            store credit or moves to counter pickup, your choice.
          </li>
          <li>
            Risk in the goods passes to you at handover. We photograph every
            delivery and the photo stays on your order page.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>6 · If your vessel skips the port</h3>
        <p className="pdp-text">
          The deposit becomes store credit for the full amount, held on your
          account and usable on any later call. Nothing is forfeited and you do
          not have to justify the diversion — schedules change, that is the
          trade. If you would rather have the money back than the credit, ask
          and we refund it.
        </p>
      </section>

      <section className="pdp-block">
        <h3>7 · Your right to change your mind</h3>
        <p className="pdp-text">
          Because you are buying at a distance, Brazilian consumer law (Código
          de Defesa do Consumidor, article 49) gives you{" "}
          <b>seven calendar days</b> to withdraw from the purchase, counted from
          the day you receive the goods — or from the day you place the order,
          if that is later. You do not have to give a reason.
        </p>
        <ul className="specs">
          <li>
            Tell us within those seven days, by e-mail or WhatsApp, and return
            the goods in the condition you received them.
          </li>
          <li>
            We refund everything you paid, including any delivery charge, by the
            same means you paid. No restocking fee.
          </li>
          <li>
            Two things this cannot cover, by their nature: perishable food once
            it has left our cold chain, and digital codes (eSIM, top-ups) once
            they have been issued or redeemed. Digital codes not yet redeemed
            can be cancelled and refunded.
          </li>
          <li>
            Before the goods leave our counter you can also simply cancel, and
            the deposit returns as store credit or as a refund, your choice.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>8 · Faulty, wrong or missing goods</h3>
        <p className="pdp-text">
          Separate from clause 7, and never replaced by it: if something arrives
          damaged, wrong or short, tell us at the gangway or the same day and we
          put it right — replacement, repair or refund. Brazilian law gives you
          30 days for non-durable goods and 90 days for durable goods to report
          a defect that was not obvious at delivery. Manufacturer warranties
          apply on top of that, and we help you claim them.
        </p>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          If an item is out of stock when we pack, we remove it and the amount
          returns to your credit or your card. We never substitute a product
          without asking you first.
        </p>
      </section>

      <section className="pdp-block">
        <h3>9 · What we are not responsible for</h3>
        <ul className="specs">
          <li>
            Delays or cancellations caused by port strikes, weather, customs
            closures, terminal access decisions or your vessel&apos;s own
            schedule. In those cases you get credit or a refund, but not
            compensation beyond what you paid.
          </li>
          <li>
            Goods you carry across another country&apos;s border. Import rules
            at your next port are yours to check.
          </li>
          <li>
            Use of an item contrary to the manufacturer&apos;s instructions.
          </li>
        </ul>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          Nothing here limits our liability for our own fault, fraud, or
          anything Brazilian consumer law does not allow us to limit.
        </p>
      </section>

      <section className="pdp-block">
        <h3>10 · Store credit</h3>
        <p className="pdp-text">
          Credit from a diverted call, a removed item or the Captain referral
          programme is held on your account, does not expire, and is applied to
          the deposit of your next order. It is not transferable and cannot be
          exchanged for cash, except where it represents money you paid for
          goods you did not receive — in that case you can always ask for the
          money instead.
        </p>
      </section>

      <section className="pdp-block">
        <h3>11 · Changes to these terms</h3>
        <p className="pdp-text">
          We may update this text as the operation changes. The version in force
          for your order is the one published on the day you placed it, and the
          date at the top tells you which that is. Changes never apply
          retroactively to an order already confirmed.
        </p>
      </section>

      <section className="pdp-block">
        <h3>12 · If we disagree</h3>
        <p className="pdp-text">
          Write to us first — most things are settled the same day. Brazilian
          law applies. As a consumer you may also use{" "}
          <a className="alink" href="https://www.consumidor.gov.br" rel="noopener noreferrer" target="_blank">
            consumidor.gov.br
          </a>{" "}
          or your local PROCON, and you keep the right to bring a claim in the
          court of your own domicile. The precise wording of the jurisdiction
          clause is pending legal review.
        </p>
      </section>

      <section className="pdp-block">
        <h3>13 · Contact</h3>
        <p className="pdp-text">
          <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          · Vessel Supplier, Porto de Santos, São Paulo, Brazil. See also the{" "}
          <Link className="alink" href="/faq">
            FAQ
          </Link>
          , the{" "}
          <Link className="alink" href="/ports">
            delivery schedule
          </Link>{" "}
          and our{" "}
          <Link className="alink" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
