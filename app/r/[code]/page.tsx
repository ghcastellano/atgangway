import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import StoreReferral from "@/components/StoreReferral";

export const dynamic = "force-dynamic";

// Página de aterrissagem do QR / link do Captain: guarda o código no
// aparelho e segue para a escolha do navio. O vínculo só é gravado no
// banco quando a pessoa tiver conta (ver components/ReferralClaim).
export default async function ReferralLanding({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().slice(0, 20);

  return (
    <>
      <StoreReferral code={clean} />
      <main>
        <Breadcrumb trail={[{ label: "Crew invite" }]} />
        <div className="okwrap">
          <div className="okring">🧢</div>
          <h2>You&apos;re on the crew list</h2>
          <p>
            Invited with code <span className="mono">{clean}</span>
          </p>
        </div>
        <div className="stack" style={{ marginTop: 18 }}>
          <p className="note">
            Pick your ship, build your kit and pay the 30% deposit — delivery happens at the
            gangway when you dock in Santos. Your shipmate gets credit for the order.
          </p>
          <Link className="btn" href="/">
            ⚓ Choose my ship
          </Link>
        </div>
      </main>
    </>
  );
}
