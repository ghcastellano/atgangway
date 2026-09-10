import { createClient } from "@/lib/supabase/server";
import SobrasBoard from "@/components/admin/SobrasBoard";
import { SOBRA_SELECT, ehSobra, type ProximaEscala, type Sobra, type SobraBruta } from "@/lib/painel";

export const dynamic = "force-dynamic";

type Perfil = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  vessel_name: string | null;
  ships: ProximaEscala | null;
};

/**
 * Não entregues: o servidor carrega os candidatos (creditados vindos de
 * separação/escada, ou abertos nesses estados) e a régua de lib/painel
 * decide quem é sobra de verdade. Cliente e saldo vêm em duas consultas
 * à parte porque orders.user_id não tem FK para profiles — não dá para
 * embutir na mesma seleção.
 */
export default async function NaoEntreguesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(SOBRA_SELECT)
    .or("status.in.(preparing,at_gangway),and(status.eq.credited,previous_status.in.(preparing,at_gangway))")
    .order("created_at", { ascending: false })
    .limit(200);

  const agora = new Date();
  const brutas = ((data ?? []) as unknown as SobraBruta[]).filter((o) => ehSobra(o, agora));
  const ids = [...new Set(brutas.map((o) => o.user_id))];

  const [perfis, creditos] = ids.length
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, whatsapp, vessel_name, ships(name, eta, ata, berth, cutoff_hours, active)")
          .in("id", ids),
        supabase.from("credits").select("user_id, amount_usd").in("user_id", ids),
      ])
    : [{ data: [] as Perfil[] }, { data: [] as { user_id: string; amount_usd: number }[] }];

  const porPerfil = new Map<string, Perfil>();
  for (const p of (perfis.data ?? []) as unknown as Perfil[]) porPerfil.set(p.id, p);
  const saldo = new Map<string, number>();
  for (const c of creditos.data ?? []) saldo.set(c.user_id, (saldo.get(c.user_id) ?? 0) + Number(c.amount_usd));

  const sobras: Sobra[] = brutas.map((o) => {
    const p = porPerfil.get(o.user_id);
    return {
      ...o,
      cliente: p
        ? { full_name: p.full_name, email: p.email, whatsapp: p.whatsapp, vessel_name: p.vessel_name, proxima: p.ships }
        : null,
      saldo_usd: saldo.get(o.user_id) ?? 0,
    };
  });

  return <SobrasBoard inicial={sobras} />;
}
