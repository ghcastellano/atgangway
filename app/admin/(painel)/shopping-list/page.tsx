import { createClient } from "@/lib/supabase/server";
import Imprimir from "@/components/admin/Imprimir";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: OrderStatus;
  ships: { name: string; eta: string } | null;
  order_items: { name: string; sku: string | null; qty: number }[];
};

/**
 * Compras: o que comprar HOJE, consolidado por item, com a quebra por
 * navio. Entram os pedidos com depósito confirmado e em separação —
 * pedido sem depósito não gera compra.
 */
export default async function ComprasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, code, status, ships(name, eta), order_items(name, sku, qty)")
    .in("status", ["deposit_paid", "preparing"]);

  const orders = (data ?? []) as unknown as Row[];

  const agg = new Map<string, { sku: string | null; total: number; por: Map<string, number> }>();
  for (const o of orders) {
    const navio = o.ships?.name ?? `#${o.code}`;
    for (const i of o.order_items) {
      const cur = agg.get(i.name) ?? { sku: i.sku, total: 0, por: new Map() };
      cur.total += i.qty;
      cur.por.set(navio, (cur.por.get(navio) ?? 0) + i.qty);
      agg.set(i.name, cur);
    }
  }
  const linhas = [...agg.entries()].sort((a, b) => b[1].total - a[1].total);
  const unidades = linhas.reduce((s, [, r]) => s + r.total, 0);

  return (
    <div className="adm-page">
      <section className="adm-kpis" aria-label="Resumo">
        <div className="adm-kpi"><b>{orders.length}</b><span>pedidos pagos a separar</span></div>
        <div className="adm-kpi teal"><b>{linhas.length}</b><span>itens distintos</span></div>
        <div className="adm-kpi"><b>{unidades}</b><span>unidades no total</span></div>
        <div className="adm-kpi"><b>{new Set(orders.map((o) => o.ships?.name ?? o.code)).size}</b><span>navios a atender</span></div>
      </section>

      <div className="adm-secao">
        <h2>Lista consolidada</h2>
        <Imprimir />
      </div>

      {linhas.length === 0 ? (
        <div className="adm-vazio">
          <b>Nada para comprar agora.</b>
          <p>Os pedidos entram aqui assim que o depósito é confirmado.</p>
        </div>
      ) : (
        <div className="adm-tablewrap adm-print">
          <table className="adm-table compras">
            <thead>
              <tr>
                <th className="num">Qtd</th>
                <th>Item</th>
                <th>Por navio</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(([nome, r]) => (
                <tr key={nome} className="sem-clique">
                  <td data-l="Quantidade" className="num"><b className="adm-qtd">{r.total}</b></td>
                  <td data-l="Item">
                    <b>{nome}</b>
                    {r.sku && <small className="mono">{r.sku}</small>}
                  </td>
                  <td data-l="Por navio">
                    <small>{[...r.por.entries()].map(([n, q]) => `${n} ×${q}`).join(" · ")}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
