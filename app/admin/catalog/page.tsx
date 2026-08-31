import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { imageUrl, type Category } from "@/lib/catalog";
import { usd } from "@/lib/money";
import BulkBar from "@/components/admin/BulkBar";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  sku: string | null;
  slug: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock_qty: number;
  variant_count: number;
  active: boolean;
  badge: string | null;
  primary_image_path: string | null;
  primary_category_id: string | null;
};

export default async function AdminCatalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string; state?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const PER = 50;

  const { data: cats } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, icon, image_path, path, depth, active, sort_order")
    .order("path");
  const categories = (cats ?? []) as Category[];
  const selected = categories.find((c) => c.slug === sp.cat);

  let query = supabase
    .from("products")
    .select(
      "id, name, sku, slug, price_cents, compare_at_cents, stock_qty, variant_count, active, badge, primary_image_path, primary_category_id",
      { count: "exact" }
    );

  // O filtro `or` do PostgREST é uma string com vírgula e parênteses
  // como sintaxe. Termo de busca com esses caracteres não quebra só a
  // consulta — reescreve o filtro. Sanitiza antes de compor.
  const term = (sp.q ?? "").replace(/[,()*\\%]/g, " ").trim().slice(0, 60);
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  if (sp.state === "inactive") query = query.eq("active", false);
  if (sp.state === "nostock") query = query.lte("stock_qty", 0);
  if (sp.state === "noimage") query = query.is("primary_image_path", null);
  if (selected) {
    const ids = categories.filter((c) => c.path.startsWith(selected.path)).map((c) => c.id);
    const { data: links } = await supabase
      .from("product_categories")
      .select("product_id")
      .in("category_id", ids);
    const productIds = [...new Set((links ?? []).map((l) => l.product_id as string))];
    query = query.in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, count } = await query
    .order("name")
    .range((page - 1) * PER, page * PER - 1);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER));

  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (sp.cat) p.set("cat", sp.cat);
    if (sp.state) p.set("state", sp.state);
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/admin/catalog?${s}` : "/admin/catalog";
  };

  return (
    <main className="pb-nav">
      <div className="kpis">
        <div className="kpi"><b>{total}</b><span>produtos</span></div>
        <div className="kpi amber"><b>{rows.filter((r) => !r.active).length}</b><span>inativos na página</span></div>
        <div className="kpi"><b>{rows.filter((r) => r.stock_qty <= 0).length}</b><span>sem estoque</span></div>
        <div className="kpi amber"><b>{rows.filter((r) => !r.primary_image_path).length}</b><span>sem foto</span></div>
      </div>

      <div className="admbar">
        <form className="admsearch" action="/admin/catalog">
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          <input name="q" defaultValue={term} placeholder="Buscar por nome ou SKU…" />
          <button type="submit">Buscar</button>
        </form>
        <div className="admchips">
          <Link className={`tab ${!sp.state ? "on" : ""}`} href={link({ state: undefined, page: undefined })}>Todos</Link>
          <Link className={`tab ${sp.state === "inactive" ? "on" : ""}`} href={link({ state: "inactive", page: undefined })}>Inativos</Link>
          <Link className={`tab ${sp.state === "nostock" ? "on" : ""}`} href={link({ state: "nostock", page: undefined })}>Sem estoque</Link>
          <Link className={`tab ${sp.state === "noimage" ? "on" : ""}`} href={link({ state: "noimage", page: undefined })}>Sem foto</Link>
        </div>
        <div className="admchips">
          <Link className={`tab ${!sp.cat ? "on" : ""}`} href={link({ cat: undefined, page: undefined })}>Toda categoria</Link>
          {categories.filter((c) => c.depth === 0).map((c) => (
            <Link key={c.id} className={`tab ${sp.cat === c.slug ? "on" : ""}`} href={link({ cat: c.slug, page: undefined })}>
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
        <div className="actions" style={{ padding: "0 16px" }}>
          <Link className="btn small" href="/admin/catalog/new">+ Novo produto</Link>
          <Link className="btn small ghost" href="/admin/catalog/import">⇪ Importar CSV</Link>
        </div>
      </div>

      <BulkBar
        rows={rows.map((r) => ({ id: r.id, name: r.name }))}
        categoryPath={selected?.path ?? null}
        categoryName={selected?.name ?? null}
        categoryTotal={selected ? total : 0}
      />

      {rows.length === 0 ? (
        <div className="empty"><div className="i">📦</div>Nada com esses filtros.</div>
      ) : (
        <div className="admlist">
          {rows.map((r) => {
            const src = imageUrl(r.primary_image_path);
            return (
              <label key={r.id} className={`admrow ${r.active ? "" : "off"}`}>
                <input type="checkbox" name="ids" value={r.id} form="bulkform" />
                <span className="th">
                  {src ? <Image src={src} alt="" fill sizes="44px" style={{ objectFit: "contain" }} />
                       : <span aria-hidden>📦</span>}
                </span>
                <span className="info">
                  <Link href={`/admin/catalog/${r.id}`} className="nm">{r.name}</Link>
                  <span className="meta mono">
                    {r.sku ?? "—"} · {usd(r.price_cents)}
                    {r.compare_at_cents ? ` (de ${usd(r.compare_at_cents)})` : ""}
                    {r.variant_count > 1 ? ` · ${r.variant_count} variantes` : ""}
                  </span>
                </span>
                <span className="tags">
                  {r.badge && <b className={`pbadge ${r.badge}`} style={{ position: "static" }}>{r.badge}</b>}
                  <b className={`stk ${r.stock_qty > 0 ? "" : "zero"}`}>{r.stock_qty}</b>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="actions" style={{ padding: "12px 16px", justifyContent: "space-between" }}>
          {page > 1 ? <Link className="btn small ghost" href={link({ page: String(page - 1) })}>← Anterior</Link> : <span />}
          <span className="finehint">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn small ghost" href={link({ page: String(page + 1) })}>Próxima →</Link> : <span />}
        </div>
      )}
    </main>
  );
}
