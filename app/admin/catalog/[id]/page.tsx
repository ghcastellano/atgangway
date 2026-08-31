import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { imageUrl, type Category } from "@/lib/catalog";
import { usd } from "@/lib/money";
import {
  deleteProductImage,
  saveCatalogProduct,
  uploadProductImage,
} from "../actions";

export const dynamic = "force-dynamic";

type P = {
  id: string; name: string; sku: string | null; slug: string | null;
  short_description: string | null; description: string | null; specs: string[] | null;
  badge: string | null; tax_class: string; sort_order: number; active: boolean;
  price_cents: number; compare_at_cents: number | null; stock_qty: number;
  primary_category_id: string | null;
  product_images: { id: string; path: string; alt: string | null; sort_order: number }[];
  product_variants: { id: string; sku: string; price_cents: number; compare_at_cents: number | null;
                      stock_qty: number; track_stock: boolean; option_label: string | null }[];
};

const money = (c: number | null | undefined) =>
  c === null || c === undefined ? "" : (c / 100).toFixed(2);

export default async function ProductEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        `id, name, sku, slug, short_description, description, specs, badge, tax_class,
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
    <main className="pb-nav">
      <p className="subhead">{isNew ? "Novo produto" : p!.name}</p>

      <form action={saveCatalogProduct} className="adm-form">
        {!isNew && <input type="hidden" name="id" value={p!.id} />}

        <div className="form2">
          <div className="field">
            <label>SKU *</label>
            <input name="sku" required defaultValue={p?.sku ?? ""} placeholder="MS-1042" />
          </div>
          <div className="field">
            <label>Ordem</label>
            <input name="sort_order" type="number" defaultValue={p?.sort_order ?? 100} />
          </div>
        </div>

        <div className="field">
          <label>Nome *</label>
          <input name="name" required defaultValue={p?.name ?? ""} placeholder="Marshall Minor IV" />
        </div>

        <div className="field">
          <label>Resumo (aparece no card)</label>
          <input name="short_description" defaultValue={p?.short_description ?? ""} />
        </div>

        <div className="form2">
          <div className="field">
            <label>Preço USD *</label>
            <input name="price" required inputMode="decimal"
                   defaultValue={money(v?.price_cents ?? p?.price_cents)} placeholder="64.90" />
          </div>
          <div className="field">
            <label>Preço anterior (riscado)</label>
            <input name="compare_at" inputMode="decimal"
                   defaultValue={money(v?.compare_at_cents ?? p?.compare_at_cents)} placeholder="105.00" />
          </div>
        </div>

        <div className="form2">
          <div className="field">
            <label>Estoque</label>
            <input name="stock" type="number" min={0} defaultValue={v?.stock_qty ?? 0} />
          </div>
          <div className="field">
            <label>Selo</label>
            <select name="badge" className="phone-country" style={{ width: "100%" }}
                    defaultValue={p?.badge ?? ""}>
              <option value="">nenhum</option>
              <option value="promo">Promo</option>
              <option value="new">New</option>
              <option value="outlet">Outlet</option>
            </select>
          </div>
        </div>

        <div className="form2">
          <div className="field">
            <label>Categoria</label>
            <select name="category_id" className="phone-country" style={{ width: "100%" }}
                    defaultValue={p?.primary_category_id ?? ""}>
              <option value="">— sem categoria —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Regime</label>
            <select name="tax_class" className="phone-country" style={{ width: "100%" }}
                    defaultValue={p?.tax_class ?? "bonded"}>
              <option value="bonded">Bonded (entrega a bordo)</option>
              <option value="domestic">Nacional</option>
              <option value="digital">Digital (eSIM, recarga)</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Ficha técnica — uma linha por item</label>
          <textarea name="specs" rows={5} defaultValue={(p?.specs ?? []).join("\n")}
                    placeholder={"Bluetooth 5.4\nGPS\nDisplay AMOLED"} />
        </div>

        <div className="field">
          <label>Descrição longa</label>
          <textarea name="description" rows={4} defaultValue={p?.description ?? ""} />
        </div>

        <label className="checkline">
          <input type="checkbox" name="track_stock" defaultChecked={v ? v.track_stock : true} />
          Controlar estoque (desmarque para item digital, que não acaba)
        </label>
        <label className="checkline">
          <input type="checkbox" name="active" defaultChecked={p ? p.active : true} />
          Publicado na loja
        </label>

        <button className="btn small" type="submit">
          {isNew ? "+ Criar produto" : "Salvar alterações"}
        </button>
      </form>

      {!isNew && (
        <>
          <p className="subhead">Fotos ({images.length})</p>
          {images.length === 0 && (
            <p className="finehint" style={{ margin: "0 18px 8px" }}>
              Sem foto o produto aparece com um ícone genérico na grade — é o que mais derruba
              conversão numa loja de catálogo.
            </p>
          )}
          <div className="admlist">
            {images.map((img, i) => {
              const src = imageUrl(img.path);
              return (
                <div key={img.id} className="admrow">
                  <span className="th">
                    {src && <Image src={src} alt="" fill sizes="44px" style={{ objectFit: "contain" }} />}
                  </span>
                  <span className="info">
                    <span className="nm">{i === 0 ? "Capa" : `Foto ${i + 1}`}</span>
                    <span className="meta mono">{img.path.split("/").pop()}</span>
                  </span>
                  <form action={deleteProductImage}>
                    <input type="hidden" name="image_id" value={img.id} />
                    <input type="hidden" name="product_id" value={p!.id} />
                    <button className="btn small danger" type="submit">Remover</button>
                  </form>
                </div>
              );
            })}
          </div>

          <form action={uploadProductImage} className="adm-form">
            <input type="hidden" name="product_id" value={p!.id} />
            <div className="field">
              <label>Adicionar foto (até 5 MB · JPG, PNG ou WebP)</label>
              <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required />
            </div>
            <div className="field">
              <label>Texto alternativo</label>
              <input name="alt" placeholder="Fone Marshall Minor IV na caixa de carga" />
            </div>
            <button className="btn small ghost" type="submit">⇪ Enviar foto</button>
          </form>

          {p!.product_variants.length > 1 && (
            <>
              <p className="subhead">Variantes ({p!.product_variants.length})</p>
              <div className="admlist">
                {p!.product_variants.map((vr) => (
                  <div key={vr.id} className="admrow">
                    <span className="info">
                      <span className="nm">{vr.option_label ?? vr.sku}</span>
                      <span className="meta mono">
                        {vr.sku} · {usd(vr.price_cents)} · estoque {vr.stock_qty}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="finehint" style={{ margin: "0 18px" }}>
                Variante extra entra pela importação CSV (uma linha por SKU).
              </p>
            </>
          )}
        </>
      )}

      <div className="actions" style={{ padding: "14px 16px 20px" }}>
        <Link className="btn small ghost" href="/admin/catalog">← Voltar ao catálogo</Link>
      </div>
    </main>
  );
}
