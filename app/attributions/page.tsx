import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { clientePublico } from "@/lib/supabase/publico";
import { imageUrl } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Where the catalogue photos come from and under which licence.",
};

export const revalidate = 3600;

type Row = {
  path: string;
  license: string | null;
  attribution: string | null;
  source_url: string | null;
  source_title: string | null;
  products: { name: string; slug: string } | null;
};

/**
 * Créditos de foto.
 *
 * Não é firula: CC BY e CC BY-SA EXIGEM crédito ao autor e link para a
 * licença. Crédito que mora num commit não cumpre a licença — precisa
 * estar publicado onde o visitante alcança.
 *
 * A página também serve de lista de tarefa: cada linha aqui é uma foto
 * de acervo aberto esperando ser trocada pela do fornecedor. Quando
 * ficar vazia, o catálogo está com foto própria.
 */
export default async function AttributionsPage() {
  let rows: Row[] = [];
  try {
    const supabase = clientePublico();
    const { data } = await supabase
      .from("product_images")
      .select(
        "path, license, attribution, source_url, source_title, products!product_images_product_id_fkey(name, slug)"
      )
      .not("license", "is", null)
      .order("path");
    rows = (data ?? []) as unknown as Row[];
  } catch {
    rows = [];
  }

  return (
    <main>
      <Breadcrumb trail={[{ label: "Photo credits" }]} />
      <h1 className="pagettl">Photo credits</h1>
      <p className="pagelead">
        Photos of packaged goods come from the open Open Food Facts archives,
        matched to the exact barcode we stock. The rest are placeholders while we
        collect our suppliers&apos; own shots. Each one is credited below, as its
        licence requires.
      </p>

      {rows.length === 0 ? (
        <div className="infobox" style={{ marginTop: 14 }}>
          Every photo in the catalogue is ours or our suppliers&apos; — nothing to
          credit here.
        </div>
      ) : (
        <div className="cart-list" style={{ marginTop: 8 }}>
          {rows.map((r) => {
            const src = imageUrl(r.path);
            return (
              <div className="ci" key={r.path}>
                <span className="ci-thumb">
                  {src && (
                    <Image src={src} alt="" fill sizes="50px" style={{ objectFit: "contain" }} />
                  )}
                </span>
                <div>
                  <div className="nm">
                    {r.products ? (
                      <Link href={`/p/${r.products.slug}`} style={{ color: "inherit" }}>
                        {r.products.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="pr">{r.attribution}</div>
                  {r.source_url && (
                    <div className="pr">
                      <a
                        className="alink"
                        href={r.source_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Source on {r.source_title ?? "the original archive"}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="pdp-block">
        <h3>What the licences mean here</h3>
        <ul className="specs">
          <li>
            <b>Public domain / CC0</b> — free to use, no credit required. We
            credit anyway.
          </li>
          <li>
            <b>CC BY</b> — free to use commercially, credit required. Credited
            above.
          </li>
          <li>
            <b>CC BY-SA</b> — same, and anything we derive from the image
            carries the same licence. We only reframe these onto a white
            background; the reframed version stays under the original licence.
          </li>
        </ul>
        <p className="pdp-text" style={{ marginTop: 10 }}>
          Brand names and product shapes in these photos belong to their
          manufacturers. Where a photo was matched by barcode it shows the exact
          item we stock; the remaining ones illustrate the category and are
          replaced by the supplier&apos;s own photo as it arrives.
          If you own an image here and want it removed,{" "}
          <Link className="alink" href="/faq">
            write to us
          </Link>{" "}
          and we take it down the same day.
        </p>
      </section>
    </main>
  );
}
