import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { saveProduct } from "../actions";

export const dynamic = "force-dynamic";

function ProductForm({ product, categories }: { product?: Product; categories: string[] }) {
  return (
    <form action={saveProduct} className="adm-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="form2">
        <div className="field">
          <label>Emoji</label>
          <input name="emoji" defaultValue={product?.emoji ?? ""} placeholder="☕" />
        </div>
        <div className="field">
          <label>Price (USD)</label>
          <input
            name="price_usd"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={product ? Number(product.price_usd) : ""}
          />
        </div>
      </div>
      <div className="field">
        <label>Name</label>
        <input name="name" required defaultValue={product?.name ?? ""} placeholder="Brazilian coffee kit" />
      </div>
      <div className="field">
        <label>Description</label>
        <input
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="500g moído + filtros"
        />
      </div>
      <div className="form2">
        <div className="field">
          <label>Category</label>
          <input
            name="category"
            list="cats"
            defaultValue={product?.category ?? ""}
            placeholder="Food"
          />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Sort</label>
          <input name="sort_order" type="number" defaultValue={product?.sort_order ?? 100} />
        </div>
      </div>
      <label className="checkline">
        <input type="checkbox" name="active" defaultChecked={product ? product.active : true} />
        Visible in the shop
      </label>
      <button className="btn small" type="submit">
        {product ? "Save changes" : "+ Add product"}
      </button>
    </form>
  );
}

export default async function AdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, description, emoji, category, price_usd, active, sort_order")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  const products = (data ?? []) as Product[];
  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <main className="pb-nav">
      <p className="subhead">New product</p>
      <ProductForm categories={categories} />

      <p className="subhead">Catalog ({products.length})</p>
      {products.map((p) => (
        <div key={p.id}>
          <p className="subhead" style={{ paddingTop: 6 }}>
            {p.emoji} {p.name} — {p.category}
            {p.active ? "" : " · hidden"}
          </p>
          <ProductForm product={p} categories={categories} />
        </div>
      ))}
    </main>
  );
}
