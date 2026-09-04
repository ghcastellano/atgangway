import { createClient } from "@/lib/supabase/server";
import PedidosBoard from "@/components/admin/PedidosBoard";
import SaudeStrip, { type Saude } from "@/components/admin/Saude";
import { PEDIDO_SELECT, type Pedido } from "@/lib/painel";

export const dynamic = "force-dynamic";

/**
 * Pedidos. O servidor só carrega; quem desenha, filtra e age é o
 * PedidosBoard (cliente), que troca uma linha por vez conforme as
 * actions respondem — nada de reconstruir a página a cada clique.
 *
 * Abertos inteiros + os 40 encerrados mais recentes: o histórico
 * completo é assunto de relatório, não de tela de operação.
 */
export default async function PedidosPage() {
  const supabase = await createClient();
  const [abertos, encerrados, saude] = await Promise.all([
    supabase
      .from("orders")
      .select(PEDIDO_SELECT)
      .in("status", ["awaiting_deposit", "deposit_paid", "preparing", "at_gangway"])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(PEDIDO_SELECT)
      .in("status", ["delivered", "credited", "cancelled"])
      .order("status_changed_at", { ascending: false, nullsFirst: false })
      .limit(40),
    supabase.rpc("ops_health"),
  ]);

  const pedidos = [
    ...((abertos.data ?? []) as unknown as Pedido[]),
    ...((encerrados.data ?? []) as unknown as Pedido[]),
  ];

  return (
    <>
      {saude.data && <SaudeStrip s={saude.data as unknown as Saude} />}
      <PedidosBoard inicial={pedidos} />
    </>
  );
}
