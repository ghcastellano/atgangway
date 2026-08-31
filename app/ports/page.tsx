import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import DeliveryStrip from "@/components/DeliveryStrip";
import { createClient } from "@/lib/supabase/server";
import {
  resolveDelivery,
  type PortRule,
} from "@/lib/delivery";
import { usd } from "@/lib/money";

export const metadata: Metadata = {
  title: "Ports & delivery schedule",
  description:
    "Order windows, delivery days and minimum vessel stay for every port we serve.",
};

type PortRow = {
  slug: string;
  name: string;
  unlocode: string | null;
  timezone: string;
  fulfilment_kind: "onboard" | "pickup" | "digital";
  min_order_cents: number;
  delivery_fee_cents: number;
  sort_order: number;
  port_delivery_rules: (PortRule & { id: string })[];
};

/**
 * O `note` de cada porto existe no banco, mas está em português: é
 * anotação de operação, não texto de vitrine. A tripulação é
 * internacional, então a descrição visível sai do `fulfilment_kind`,
 * que é enum com CHECK no banco e não muda de idioma.
 */
const KIND: Record<PortRow["fulfilment_kind"], string> = {
  onboard: "Delivered at the gangway by an accredited ship chandler.",
  pickup: "Collect at the counter — no port pass, no accreditation, no window.",
  digital: "Delivered to your phone. No chandler and no port restriction.",
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 'time' do Postgres chega como '14:00:00'; o cliente lê relógio. */
const hhmm = (t: string | null | undefined) => String(t ?? "").slice(0, 5);

/** Null quando a regra vale todo dia — dizer "Sun Mon Tue…" é ruído. */
function daysLabel(days?: number[] | null): string | null {
  if (!days || days.length >= 7) return null;
  return [...days].sort((a, b) => a - b).map((d) => DAY[d] ?? "?").join(" ");
}

function deliveryLabel(r: PortRule): string {
  const base =
    r.delivery_offset_days === 0
      ? "Same day"
      : r.delivery_offset_days === 1
        ? "Next day"
        : `${r.delivery_offset_days} days later`;
  // Rota fixa vence o offset no cálculo (lib/delivery). Se ela existe e
  // não aparecer aqui, a tabela promete um dia que a regra não cumpre.
  const route = daysLabel(r.delivery_weekdays);
  return route ? `${base}, on ${route}` : base;
}

function stayLabel(r: PortRule): string {
  const bits: string[] = [];
  if (r.min_stay_hours) bits.push(`${r.min_stay_hours}h alongside`);
  if (r.vessel_must_stay_until) bits.push(`until ${hhmm(r.vessel_must_stay_until)}`);
  return bits.length ? bits.join(" · ") : "—";
}

/**
 * Ports & delivery schedule, no espírito da página equivalente do
 * Sunny: primeiro a promessa que vale AGORA para Santos, depois a
 * grade completa, porto por porto.
 *
 * A ordem é essa de propósito. Quem abre esta página está decidindo se
 * dá tempo de pedir para esta escala; a matriz inteira é consulta, a
 * promessa é a resposta. Ela não vem do ETA de um navio — vem da grade
 * do porto, que vale para qualquer casco que atracar ali.
 */
export default async function PortsPage() {
  let ports: PortRow[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ports")
      .select(
        `slug, name, unlocode, timezone, fulfilment_kind,
         min_order_cents, delivery_fee_cents, sort_order,
         port_delivery_rules(id, label, window_start, window_end, order_weekdays,
                             delivery_offset_days, delivery_weekdays,
                             vessel_must_stay_until, min_stay_hours, active, sort_order)`
      )
      .eq("active", true)
      .order("sort_order");
    ports = (data ?? []) as unknown as PortRow[];
  } catch {
    // Catálogo de portos fora do ar não pode virar 500: a página cai
    // no vazio e o rodapé continua servindo o contato.
    ports = [];
  }

  // A promessa sai do mesmo fetch dos portos — buscar Santos de novo
  // seria uma segunda ida ao banco para dados que já estão na mão.
  const santos = ports.find((p) => p.slug === "santos") ?? null;
  const now = new Date();
  const promise = santos
    ? resolveDelivery(santos.port_delivery_rules ?? [], now, santos.timezone)
    : null;
  return (
    <main>
      <Breadcrumb trail={[{ label: "Ports & delivery schedule" }]} />

      <h1 className="pagettl">Ports &amp; delivery schedule</h1>
      <p className="pagelead">
        The delivery day comes from the port&apos;s grid, not from your
        vessel&apos;s ETA. Find the window your order lands in and you have the
        date.
      </p>

      {/* Mesma tira do topo da loja: uma frase só para a promessa, um
          limiar só para a urgência, um formato só para a data. */}
      {santos && <DeliveryStrip promise={promise} portName={santos.name} />}

      {ports.length === 0 ? (
        <div className="empty">
          <div className="i" aria-hidden>
            ⚓
          </div>
          The schedule is not available right now.
          <br />
          Try again shortly, or ask us at our counter.
        </div>
      ) : (
        ports.map((p) => {
          const rules = (p.port_delivery_rules ?? [])
            .filter((r) => r.active !== false)
            .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));

          return (
            <section key={p.slug}>
              <h2 className="secttl left">{p.name}</h2>

              <p className="finehint" style={{ margin: "0 16px 4px" }}>
                {KIND[p.fulfilment_kind]}
                {p.unlocode ? ` · ${p.unlocode}` : ""}
                {p.min_order_cents > 0
                  ? ` · Minimum order ${usd(p.min_order_cents)}`
                  : " · No minimum order"}
                {p.delivery_fee_cents > 0
                  ? ` · Delivery fee ${usd(p.delivery_fee_cents)}`
                  : ""}
                {` · Times in ${p.timezone.replace("_", " ")}`}
              </p>

              {rules.length === 0 ? (
                <p className="finehint" style={{ margin: "0 16px 12px" }}>
                  No published window for this port yet.
                </p>
              ) : (
                <div className="ptable">
                  <div className="wrap">
                    {/* aria-label em vez de <caption>: a legenda visível
                        já é o h2 do porto, e uma caption repetiria o nome
                        na tela sem acrescentar nada. */}
                    <table aria-label={`Delivery grid for ${p.name}`}>
                      <thead>
                        <tr>
                          <th scope="col">Order arrives</th>
                          <th scope="col">We deliver</th>
                          <th scope="col">Vessel must stay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((r) => {
                          const days = daysLabel(r.order_weekdays);
                          return (
                            <tr key={r.id}>
                              <td>
                                {days && (
                                  <>
                                    <b>{days}</b>
                                    <br />
                                  </>
                                )}
                                {hhmm(r.window_start)} – {hhmm(r.window_end)}
                              </td>
                              <td>{deliveryLabel(r)}</td>
                              <td>{stayLabel(r)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </section>
          );
        })
      )}

      <p className="finehint" style={{ margin: "18px 16px 4px" }}>
        Gangway delivery also depends on the terminal letting the chandler in on
        the day. If the call is cancelled or the window closes on you, the
        deposit becomes store credit for the full amount — see the{" "}
        <Link className="alink" href="/faq">
          FAQ
        </Link>
        .
      </p>
    </main>
  );
}
