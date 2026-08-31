import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Vessel Supplier collects, why customs requires it, who processes it, and how to exercise your rights under Brazil's LGPD.",
};

const LAST_UPDATED = "26 August 2026";

/**
 * Política de privacidade.
 *
 * Reescrita na moldura da LGPD (Lei 13.709/2018), que é a lei que
 * governa este tratamento — o texto anterior descrevia bem o que se
 * coleta, mas não dizia a BASE LEGAL de cada coisa nem listava os
 * direitos do titular, que é o que a lei exige e o que dá ao cliente
 * como reclamar.
 *
 * A tabela de bases legais é o coração: "coletamos seu passaporte
 * porque sim" não existe. Nome, posto, navio e nacionalidade são
 * obrigação legal (declaração aduaneira), não escolha nossa — e dizer
 * isso protege os dois lados.
 *
 * Transferência internacional está declarada porque é real: Vercel e
 * Stripe processam fora do Brasil. Omitir isso seria a parte da
 * política que mais facilmente vira multa.
 *
 * Continua pendente de revisão jurídica e do CNPJ do controlador.
 */
export default function PrivacyPage() {
  return (
    <main>
      <Breadcrumb trail={[{ label: "Privacy Policy" }]} />

      <p className="draftnote">
        <b>Operational draft — pending legal review.</b> This describes what we
        actually do with your data today, mapped to Brazil&apos;s LGPD. The
        controller&apos;s registration details and the appointed data protection
        officer are still to be filled in below.
      </p>

      <h1 className="pagettl">Privacy Policy</h1>
      <p className="pagelead">
        Last updated {LAST_UPDATED}. Written to Brazil&apos;s Lei Geral de
        Proteção de Dados (Law 13.709/2018).
      </p>

      <section className="pdp-block">
        <h3>1 · Who controls your data</h3>
        <p className="pdp-text">
          Vessel Supplier, at Porto de Santos, São Paulo, Brazil, is the
          controller. Contact for anything on this page:{" "}
          <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          <b>Pending:</b> CNPJ, registered address and the name of the appointed
          data protection officer (<i>encarregado</i>, LGPD art. 41).
        </p>
      </section>

      <section className="pdp-block">
        <h3>2 · What we collect and why</h3>
        <p className="pdp-text">
          Under the LGPD every piece of data needs a lawful basis. Here is ours,
          item by item — nothing is collected &ldquo;just in case&rdquo;.
        </p>
        <div className="ptable" style={{ margin: "12px 0 0" }}>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Why</th>
                  <th>Legal basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Name, e-mail, password</td>
                  <td>Your account and order history</td>
                  <td>Performance of the contract (art. 7, V)</td>
                </tr>
                <tr>
                  <td>Rank, vessel name, IMO, flag, nationality</td>
                  <td>
                    Customs declaration for goods leaving Brazil as ship&apos;s
                    stores. Without these the shipment cannot be cleared.
                  </td>
                  <td>Legal and regulatory obligation (art. 7, II)</td>
                </tr>
                <tr>
                  <td>WhatsApp / telephone</td>
                  <td>
                    Reaching you at the gangway. It is the only channel that
                    works from a ship.
                  </td>
                  <td>Performance of the contract (art. 7, V)</td>
                </tr>
                <tr>
                  <td>Home port</td>
                  <td>Which delivery grid applies to your order</td>
                  <td>Performance of the contract (art. 7, V)</td>
                </tr>
                <tr>
                  <td>Order contents, amounts, delivery photo</td>
                  <td>
                    Fulfilling and proving delivery, tax records, and defending
                    a dispute if one arises
                  </td>
                  <td>Contract and legal obligation (art. 7, II and V)</td>
                </tr>
                <tr>
                  <td>Payment status and Stripe reference</td>
                  <td>Confirming payment and issuing refunds</td>
                  <td>Performance of the contract (art. 7, V)</td>
                </tr>
                <tr>
                  <td>Referral code and credit balance</td>
                  <td>Running the Captain programme you opted into</td>
                  <td>Consent (art. 7, I)</td>
                </tr>
                <tr>
                  <td>Wish list, recently viewed</td>
                  <td>Making the shop useful to you</td>
                  <td>Legitimate interest (art. 7, IX)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="pdp-text" style={{ marginTop: 12 }}>
          We do not collect sensitive personal data as the LGPD defines it —
          health, religion, biometrics, union membership — and we ask you not to
          send any in an order note.
        </p>
      </section>

      <section className="pdp-block">
        <h3>3 · Your card number</h3>
        <p className="pdp-text">
          We never see it. Card details go straight to Stripe, which is PCI-DSS
          certified. What reaches us is whether the payment succeeded and a
          reference number.
        </p>
      </section>

      <section className="pdp-block">
        <h3>4 · Who else processes it</h3>
        <ul className="specs">
          <li>
            <b>Brazilian customs (Receita Federal) and the accredited ship
            chandler</b> — the declaration for on-board delivery. Legal
            obligation; we cannot deliver on board without it.
          </li>
          <li>
            <b>Supabase</b> — database and authentication, hosted in São Paulo
            (sa-east-1).
          </li>
          <li>
            <b>Vercel</b> — application hosting, served from São Paulo, company
            based in the United States.
          </li>
          <li>
            <b>Stripe</b> — payment processing, based in the United States and
            Ireland.
          </li>
          <li>
            <b>Google</b> — only if you choose to sign in with Google.
          </li>
          <li>
            <b>Hostinger</b> — the mail server that sends your order e-mails.
          </li>
        </ul>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          We do not sell your data, and we do not share it with advertisers.
        </p>
      </section>

      <section className="pdp-block">
        <h3>5 · Data leaving Brazil</h3>
        <p className="pdp-text">
          Your account and orders are stored in Brazil. Some of the processors
          above operate from outside it, so a limited transfer happens — LGPD
          article 33 allows this when it is necessary to perform the contract
          you asked for, which is the case here. Those processors are bound by
          their own contractual data-protection terms.
        </p>
      </section>

      <section className="pdp-block">
        <h3>6 · How long we keep it</h3>
        <ul className="specs">
          <li>
            <b>Account data</b> — while your account exists. Close it and we
            delete or anonymise, subject to the line below.
          </li>
          <li>
            <b>Orders, invoices and customs declarations</b> — five years, which
            is what Brazilian tax and customs rules require of us. This one we
            cannot delete on request.
          </li>
          <li>
            <b>Delivery photos</b> — two years, then deleted.
          </li>
          <li>
            <b>Wish list and browsing preferences</b> — until you clear them or
            close the account.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>7 · Your rights</h3>
        <p className="pdp-text">
          LGPD article 18 gives you the right to ask us, free of charge, to:
        </p>
        <ul className="specs">
          <li>confirm that we process your data, and give you access to it;</li>
          <li>correct anything incomplete, inaccurate or out of date;</li>
          <li>
            anonymise, block or delete data that is unnecessary, excessive, or
            processed outside the law;
          </li>
          <li>
            port your data to another provider, in a readable machine format;
          </li>
          <li>
            tell you who we have shared it with — the list in clause 4 is that
            answer, kept current;
          </li>
          <li>
            withdraw a consent you gave, at any time, without affecting what was
            lawful before you withdrew it;
          </li>
          <li>
            know what happens if you refuse to give a piece of data. For the
            customs fields, the honest answer is that we cannot deliver on
            board — but counter pickup and digital items stay open to you.
          </li>
        </ul>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          Write to{" "}
          <a className="alink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          and we answer within 15 days. Most of it you can also do yourself on
          your{" "}
          <Link className="alink" href="/account">
            account page
          </Link>
          . If you are not satisfied, you may complain to the ANPD, Brazil&apos;s
          data protection authority.
        </p>
      </section>

      <section className="pdp-block">
        <h3>8 · Cookies</h3>
        <ul className="specs">
          <li>
            <b>Session cookie</b> — keeps you signed in. Strictly necessary; the
            site does not work without it.
          </li>
          <li>
            <b>Cart</b> — kept in your browser&apos;s local storage, not sent to
            us until you check out.
          </li>
          <li>
            We run no advertising or third-party tracking cookies. If that ever
            changes, we will ask for your consent first, and this page will say
            so before it happens.
          </li>
        </ul>
      </section>

      <section className="pdp-block">
        <h3>9 · Security</h3>
        <p className="pdp-text">
          Traffic is encrypted end to end. Passwords are hashed, never stored in
          readable form, and checked against known breach lists when you choose
          one. Access to order data is enforced at the database level, row by
          row, so one account cannot read another&apos;s. Delivery photos sit in
          private storage reachable only by you and our staff. If a breach ever
          affects you, we will tell you and the ANPD, as the law requires.
        </p>
      </section>

      <section className="pdp-block">
        <h3>10 · Children</h3>
        <p className="pdp-text">
          The store is for adults, and we do not knowingly collect data from
          anyone under 18. If you believe a minor has created an account, tell
          us and we will remove it.
        </p>
      </section>

      <section className="pdp-block">
        <h3>11 · Changes</h3>
        <p className="pdp-text">
          If we change how we handle your data in a way that matters, we update
          the date at the top and, when the change is significant, e-mail
          account holders before it takes effect. See also our{" "}
          <Link className="alink" href="/terms">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
