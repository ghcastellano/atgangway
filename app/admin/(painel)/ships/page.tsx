import { createClient } from "@/lib/supabase/server";
import NaviosBoard from "@/components/admin/NaviosBoard";
import type { Ship } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Navios: o servidor carrega as escalas dos próximos 21 dias e as da
 *  fila; o board decide as pilhas com a régua única de lib/callstate. */
export default async function NaviosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ships")
    .select("id, name, berth, eta, cutoff_hours, active, delay_hours, previous_eta, eta_source, ata")
    .gt("eta", new Date(Date.now() - 3 * 86400e3).toISOString())
    .order("eta", { ascending: true })
    .limit(400);
  return <NaviosBoard inicial={(data ?? []) as Ship[]} />;
}
