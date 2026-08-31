import { createClient } from "@/lib/supabase/server";
import { resolveDelivery, type PortRule } from "@/lib/delivery";
import DeliveryStrip from "./DeliveryStrip";

/**
 * A promessa de entrega, no formato que o Sunny usa: não é o ETA de um
 * navio, é a grade do porto — "peça nas próximas Xh e entregamos no
 * dia Y".
 *
 * Por que isso e não o ETA: a grade vale para QUALQUER navio que
 * atracar naquele porto, inclusive os que não estão no line-up.
 * Ninguém precisa curar escala para o cliente conseguir comprar, que
 * era o gargalo do desenho anterior.
 *
 * A urgência sai da própria regra, não de um contador inventado: se
 * faltam 3h para a janela fechar, é isso que aparece.
 */
type PortRow = { name: string; timezone: string; port_delivery_rules: PortRule[] };

export default async function DeliveryPromise({
  portSlug = "santos",
  compact = false,
}: {
  portSlug?: string;
  compact?: boolean;
}) {
  let port: PortRow | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ports")
      .select(
        `name, timezone,
         port_delivery_rules(label, window_start, window_end, order_weekdays,
                             delivery_offset_days, delivery_weekdays,
                             vessel_must_stay_until, min_stay_hours, active, sort_order)`
      )
      .eq("slug", portSlug)
      .eq("active", true)
      .maybeSingle();
    port = (data as unknown as PortRow) ?? null;
  } catch {
    return null;
  }
  if (!port) return null;

  const promise = resolveDelivery(
    port.port_delivery_rules ?? [],
    new Date(),
    port.timezone
  );
  return <DeliveryStrip promise={promise} portName={port.name} compact={compact} />;
}
