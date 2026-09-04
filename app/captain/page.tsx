import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import Breadcrumb from "@/components/Breadcrumb";
import AccountRail from "@/components/AccountRail";
import ShareCode from "@/components/ShareCode";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { usd } from "@/lib/format";
import { sessionUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

const TIERS = [
  { em: "⚓", name: "Deckhand", range: "0–4 orders", pct: 5, min: 0 },
  { em: "🧭", name: "Bosun", range: "5–14 orders", pct: 6, min: 5 },
  { em: "🧢", name: "Captain", range: "15+ orders · gift on every call", pct: 7, min: 15 },
];

export default async function CaptainPage() {
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) redirect("/login?next=/captain");

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const code = profile?.referral_code ?? "—";
  /* Sai da consulta que já era feita: o menu precisa saber se mostra o
     Staff panel, e abrir uma segunda ida ao banco para uma coluna que
     já estava ao alcance seria desperdício numa página server-rendered. */
  const isAdmin = profile?.role === "admin";

  const [{ data: countData }, { data: rateData }, { data: credits }] = await Promise.all([
    supabase.rpc("referral_order_count", { p_user: user.id }),
    supabase.rpc("referral_rate", { p_user: user.id }),
    supabase.from("credits").select("amount_usd").eq("user_id", user.id),
  ]);

  const orders = Number(countData ?? 0);
  const rate = Number(rateData ?? 5);
  const earned = (credits ?? []).reduce((s, c) => s + Number(c.amount_usd), 0);

  const link = `${SITE_URL}/r/${code}`;
  const qr = await QRCode.toString(link, {
    type: "svg",
    margin: 1,
    color: { dark: "#0B1B30", light: "#EEF4F8" },
  });

  return (
    <main className="pg-acct">
      <Breadcrumb trail={[{ label: "Captain rewards" }]} />

      {/* Esta tela era a única da área de conta sem menu nenhum: quem
          entrava em Captain rewards só saía pelo cabeçalho. */}
      <AccountRail current="/captain" isAdmin={isAdmin} />

      <div className="acct-main">

      <div className="crew-hero">
        <div className="cap">🧢</div>
        <h2>
          Be your ship&apos;s <b>Captain</b>
        </h2>
        <p>
          Your crew orders with your code — you earn <b>{rate}% in credit</b> on every order.
          Forever.
        </p>
      </div>

      <div className="qrcard">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="info">
          <div className="code">{code}</div>
          <p>On your cap, in the mess room, in the ship&apos;s group — whoever scans it orders in your name.</p>
          <ShareCode code={code} link={link} />
        </div>
      </div>

      <div className="crew-stats">
        <div className="cstat">
          <b>{orders}</b>
          <span>orders via your code</span>
        </div>
        <div className="cstat">
          <b>{usd(earned)}</b>
          <span>credit earned</span>
        </div>
      </div>

      <div className="tiers">
        {TIERS.map((t) => {
          const on = t.pct === rate;
          return (
            <div key={t.name} className={`tier ${on ? "on" : ""}`}>
              <span className="em">{t.em}</span>
              <div>
                <h4>
                  {t.name}
                  {on ? " — you are here" : ""}
                </h4>
                <p>{t.range}</p>
              </div>
              <span className="pct">{t.pct}%</span>
            </div>
          );
        })}
      </div>

      <p className="crew-note">
        Credit lands as soon as the deposit on a referred order clears, works on any future call
        at Santos and never expires. Open and above board — the master knows and approves.
        Commission is for crew only; never for terminal staff, agency or authorities.{" "}
        <Link className="alink" href="/orders">
          See my orders →
        </Link>
      </p>

      </div>
    </main>
  );
}
