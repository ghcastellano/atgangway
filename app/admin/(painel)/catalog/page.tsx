import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { imageUrl, type Category } from "@/lib/catalog";
import { usd } from "@/lib/money";
import BulkBar from "@/components/admin/BulkBar";
import Aviso from "@/components/admin/Aviso";

export const dynamic = "force-dynamic";

type Row = {
  id: string; name: string; sku: string | null; price_cents: number; compare_at_cents: number | null;
  stock_qty: number; tracks_stock: boolean; variant_count: number; active: boolean; badge: string | null;
  primary_image_path: string | null;
};

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string; state?: string; ok?: string }>;
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
    .select("id, name, sku, price_cents, compare_at_cents, stock_qty, tracks_stock, variant_count, active, badge, primary_image_path", { count: "exact" });

  // Termo saneado: vírgula e parênteses são sintaxe do filtro `or` do PostgREST.
  const term = (sp.q ?? "").replace(/[,()*\\%]/g, " ").trim().slice(0, 60);
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  if (sp.state === "inactive") query = query.eq("active", false);
  if (sp.state === "nostock") query = query.eq("tracks_stock", true).lte("stock_qty", 0);
  if (sp.state === "noimage") query = query.is("primary_image_path", null);
  if (selected) {
    const ids = categories.filter((c) => c.path.startsWith(selected.path)).map((c) => c.id);
    const { data: links } = await supabase.from("product_categories").select("product_id").in("category_id", ids);
    const productIds = [...new Set((links ?? []).map((l) => l.product_id as string))];
    query = query.in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, count } = await query.order("name").range((page - 1) * PER, page * PER - 1);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER));

  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (sp.cat) p.set("cat", sp.cat);
    if (sp.state) p.set("state", sp.state);
    for (const [k, v] of Object.entries(extra)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/admin/catalog?${s}` : "/admin/catalog";
  };

  return (
    <div className="adm-page">
      {sp.ok && <Aviso texto={sp.ok} />}

      <div className="adm-toolbar">
        <form className="adm-toolbar-right" action="/admin/catalog" role="search">
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          {sp.state && <input type="hidden" name="state" value={sp.state} />}
          <input className="adm-busca" name="q" type="search" defaultValue={term} placeholder="Buscar por nome ou SKU" aria-label="Buscar produtos" />
          <button className="adm-btn" type="submit">Buscar</button>
        </form>
        <div className="adm-toolbar-right">
          <Link className="adm-btn primario" href="/admin/catalog/new">+ Novo produto</Link>
          <Link className="adm-btn ghost" href="/admin/catalog/import">Importar CSV</Link>
        </div>
      </div>

      <div className="adm-chips" aria-label="Situação">
        <Link className={!sp.state ? "on" : ""} href={link({ state: undefined, page: undefined })}>Todos <small>{!sp.state ? total : ""}</small></Link>
        <Link className={sp.state === "inactive" ? "on" : ""} href={link({ state: "inactive", page: undefined })}>Despublicados</Link>
        <Link className={sp.state === "nostock" ? "on" : ""} href={link({ state: "nostock", page: undefined })}>Sem estoque</Link>
        <Link className={sp.state === "noimage" ? "on" : ""} href={link({ state: "noimage", page: undefined })}>Sem foto</Link>
      </div>
      <div className="adm-chips" aria-label="Categoria">
        <Link className={!sp.cat ? "on" : ""} href={link({ cat: undefined, page: undefined })}>Todas as categorias</Link>
        {categories.filter((c) => c.depth === 0).map((c) => (
          <Link key={c.id} className={sp.cat === c.slug ? "on" : ""} href={link({ cat: c.slug, page: undefined })}>{c.name}</Link>
        ))}
      </div>

      <BulkBar
        rows={rows.map((r) => ({ id: r.id, name: r.name }))}
        categoryPath={selected?.path ?? null}
        categoryName={selected?.name ?? null}
        categoryTotal={selected ? total : 0}
      />

      <div className="adm-secao">
        <h2>{selected ? selected.name : term ? `“${term}”` : "Catálogo"}</h2>
        <small>{total} produto{total === 1 ? "" : "s"}</small>
      </div>

      {rows.length === 0 ? (
        <div className="adm-vazio"><b>Nada com esses filtros.</b></div>
      ) : (
        <div className="adm-lista">
          {rows.map((r) => {
            const src = imageUrl(r.primary_image_path);
            return (
              <label key={r.id} className={`adm-linha com-foto ${r.active ? "" : "off"}`}>
                <span className="th">
                  {src ? <Image src={src} alt="" fill sizes="44px" style={{ objectFit: "contain" }} /> : <span aria-hidden>📦</span>}
                </span>
                <div>
                  <div className="nm">
                    <Link href={`/admin/catalog/${r.id}`} className="adm-link" style={{ fontSize: 14 }}>{r.name}</Link>
                    {!r.active && <span className="adm-pill faint">despublicado</span>}
                    {r.badge && <span className="adm-pill amber">{r.badge}</span>}
                  </div>
                  <div className="sub">
                    <span className="mono">{r.sku ?? "—"}</span> · {usd(r.price_cents)}
                    {r.compare_at_cents ? ` (de ${usd(r.compare_at_cents)})` : ""}
                    {r.variant_count > 1 ? ` · ${r.variant_count} variantes` : ""}
                    {r.tracks_stock ? ` · estoque ${r.stock_qty}` : " · sem controle de estoque"}
                  </div>
                </div>
                <input type="checkbox" name="ids" value={r.id} form="bulkform" aria-label={`Selecionar ${r.name}`} />
              </label>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="adm-pag">
          {page > 1 ? <Link className="adm-btn ghost small" href={link({ page: String(page - 1) })}>← Anterior</Link> : <span />}
          <span>Página {page} de {pages}</span>
          {page < pages ? <Link className="adm-btn ghost small" href={link({ page: String(page + 1) })}>Próxima →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
