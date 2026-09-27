import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { imageUrl, type Category } from "@/lib/catalog";
import { usd } from "@/lib/money";
import BotaoAcao from "@/components/admin/BotaoAcao";
import Aviso from "@/components/admin/Aviso";
import { deleteProductImage, saveCatalogProduct, uploadProductImage } from "@/app/admin/catalog/actions";

export const dynamic = "force-dynamic";

type P = {
  id: string; name: string; sku: string | null; slug: string | null;
  short_description: string | null; description: string | null; specs: string[] | null; dietary: string[] | null;
  badge: string | null; tax_class: string; sort_order: number; active: boolean;
  price_cents: number; compare_at_cents: number | null; stock_qty: number;
  primary_category_id: string | null;
  product_images: { id: string; path: string; alt: string | null; sort_order: number }[];
  product_variants: { id: string; sku: string; price_cents: number; compare_at_cents: number | null;
                      stock_qty: number; track_stock: boolean; option_label: string | null }[];
};

const money = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const isNew = id === "new";
  const supabase = await createClient();

  const { data: cats } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, icon, image_path, path, depth, active, sort_order")
    .eq("active", true)
    .order("path");
  const categories = (cats ?? []) as Category[];

  let p: P | null = null;
  if (!isNew) {
    const { data } = await supabase
      .from("products")
      .select(
        `id, name, sku, slug, short_description, description, specs, dietary, badge, tax_class,
         sort_order, active, price_cents, compare_at_cents, stock_qty, primary_category_id,
         product_images(id, path, alt, sort_order),
         product_variants!product_variants_product_id_fkey(id, sku, price_cents, compare_at_cents, stock_qty, track_stock, option_label)`
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    p = data as unknown as P;
  }

  const v = p?.product_variants?.[0];
  const images = (p?.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="adm-page">
      {ok && <Aviso texto={ok} />}
      <div className="adm-secao">
        <h2>{isNew ? "Novo produto" : p!.name}</h2>
        <Link className="adm-link" href="/admin/catalog">← Catálogo</Link>
      </div>

      <form action={saveCatalogProduct} className="adm-card adm-form">
        {!isNew && <input type="hidden" name="id" value={p!.id} />}
        <div className="grid2">
          <label className="adm-field"><span>SKU *</span><input name="sku" required defaultValue={p?.sku ?? ""} placeholder="EAN-7891000286449" /></label>
          <label className="adm-field"><span>Ordem na vitrine</span><input name="sort_order" type="number" defaultValue={p?.sort_order ?? 100} /></label>
        </div>
        <label className="adm-field"><span>Nome *</span><input name="name" required defaultValue={p?.name ?? ""} placeholder="Nescafé Original 230 g" /></label>
        <label className="adm-field"><span>Resumo (aparece no card)</span><input name="short_description" defaultValue={p?.short_description ?? ""} /></label>
        <div className="grid2">
          <label className="adm-field"><span>Preço USD *</span><input name="price" required inputMode="decimal" defaultValue={money(v?.price_cents ?? p?.price_cents)} placeholder="25.50" /></label>
          <label className="adm-field"><span>Preço anterior (riscado)</span><input name="compare_at" inputMode="decimal" defaultValue={money(v?.compare_at_cents ?? p?.compare_at_cents)} /></label>
        </div>
        <div className="grid2">
          <label className="adm-field"><span>Estoque</span><input name="stock" type="number" min={0} defaultValue={v?.stock_qty ?? 0} /></label>
          <label className="adm-field">
            <span>Selo</span>
            <select name="badge" defaultValue={p?.badge ?? ""}>
              <option value="">nenhum</option>
              <option value="promo">Promo</option>
              <option value="new">New</option>
              <option value="outlet">Outlet</option>
            </select>
          </label>
        </div>
        <div className="grid2">
          <label className="adm-field">
            <span>Categoria</span>
            <select name="category_id" defaultValue={p?.primary_category_id ?? ""}>
              <option value="">— sem categoria —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            <span>Regime</span>
            <select name="tax_class" defaultValue={p?.tax_class ?? "bonded"}>
              <option value="bonded">Bonded (entrega a bordo)</option>
              <option value="domestic">Nacional</option>
              <option value="digital">Digital (eSIM, recarga)</option>
            </select>
          </label>
        </div>
        <label className="adm-field"><span>Ficha técnica — uma linha por item</span><textarea name="specs" rows={4} defaultValue={(p?.specs ?? []).join("\n")} /></label>
        {/* Selos alimentares: a segunda pergunta depois do preço para
            tripulação filipina, indiana e ucraniana. Lista fechada, a
            mesma do check no banco. */}
        <fieldset className="adm-field">
          <span>Selos alimentares (aparecem no card e na ficha)</span>
          <div className="adm-selos">
            {[["halal", "Halal"], ["vegetarian", "Vegetariano"], ["vegan", "Vegano"], ["gluten_free", "Sem glúten"], ["lactose_free", "Sem lactose"], ["contains_nuts", "Contém nozes"]].map(([v, rotulo]) => (
              <label key={v} className="check">
                <input type="checkbox" name="dietary" value={v} defaultChecked={(p?.dietary ?? []).includes(v)} /> {rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="adm-field"><span>Descrição longa</span><textarea name="description" rows={4} defaultValue={p?.description ?? ""} /></label>
        <label className="check"><input type="checkbox" name="track_stock" defaultChecked={v ? v.track_stock : false} /> Controlar estoque (a loja bloqueia a venda quando zera)</label>
        <label className="check"><input type="checkbox" name="active" defaultChecked={p ? p.active : true} /> Publicado na loja</label>
        <div className="adm-form-acoes">
          <BotaoAcao className="adm-btn primario" ocupado="Salvando…">{isNew ? "Criar produto" : "Salvar alterações"}</BotaoAcao>
          <Link className="adm-btn ghost" href="/admin/catalog">Cancelar</Link>
        </div>
      </form>

      {!isNew && (
        <>
          <div className="adm-secao"><h2>Fotos</h2><small>{images.length}</small></div>
          {images.length === 0 && (
            <p className="adm-muted">Sem foto o produto aparece com um ícone genérico na grade — é o que mais derruba conversão numa loja de catálogo.</p>
          )}
          <div className="adm-lista">
            {images.map((img, i) => {
              const src = imageUrl(img.path);
              return (
                <div key={img.id} className="adm-linha com-foto">
                  <span className="th">{src && <Image src={src} alt="" fill sizes="44px" style={{ objectFit: "contain" }} />}</span>
                  <div>
                    <div className="nm">{i === 0 ? "Capa" : `Foto ${i + 1}`}</div>
                    <div className="sub mono">{img.path.split("/").pop()}</div>
                  </div>
                  <form action={deleteProductImage}>
                    <input type="hidden" name="image_id" value={img.id} />
                    <input type="hidden" name="product_id" value={p!.id} />
                    <BotaoAcao className="adm-btn perigo ghost small" ocupado="Removendo…">Remover</BotaoAcao>
                  </form>
                </div>
              );
            })}
          </div>
          <form action={uploadProductImage} className="adm-card adm-form">
            <input type="hidden" name="product_id" value={p!.id} />
            <label className="adm-field"><span>Adicionar foto (até 5 MB · JPG, PNG ou WebP)</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label>
            <label className="adm-field"><span>Texto alternativo</span><input name="alt" placeholder="Pote de Nescafé Original 230 g" /></label>
            <div className="adm-form-acoes"><BotaoAcao className="adm-btn" ocupado="Enviando…">Enviar foto</BotaoAcao></div>
          </form>

          {p!.product_variants.length > 1 && (
            <>
              <div className="adm-secao"><h2>Variantes</h2><small>{p!.product_variants.length}</small></div>
              <div className="adm-lista">
                {p!.product_variants.map((vr) => (
                  <div key={vr.id} className="adm-linha">
                    <div>
                      <div className="nm">{vr.option_label ?? vr.sku}</div>
                      <div className="sub"><span className="mono">{vr.sku}</span> · {usd(vr.price_cents)} · estoque {vr.stock_qty}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="adm-muted">Variante extra entra pela importação CSV (uma linha por SKU).</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
