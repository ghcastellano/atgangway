import Image from "next/image";
import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { clientePublico } from "@/lib/supabase/publico";
import { imageUrl } from "@/lib/catalog";
import { tituloNavio } from "@/lib/navio";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Where the vessel photos come from and under which licence.",
  // Sem link em lugar nenhum e fora do índice: a página existe para
  // cumprir a licença, não para trazer visita.
  robots: { index: false },
};

/** A lista muda uma vez por semana (cron das fotos); uma hora de cache basta. */
export const revalidate = 3600;

type Row = {
  name: string;
  imo: string | null;
  flag: string | null;
  image_path: string | null;
  image_credit: string | null;
  image_source: string | null;
};

/**
 * Créditos das fotos de navio.
 *
 * As fotos vêm do Wikimedia Commons sob licença livre, e CC BY exige
 * atribuição "razoável para o meio". O dono do produto não quis crédito
 * escrito na tela do tripulante (o concorrente não mostra nada), então
 * a atribuição vive aqui, acessível pela URL, e no `title` da imagem.
 *
 * Lê pelo cliente público, sem cookie, para a página sair pronta do
 * cache.
 */
export default async function CreditsPage() {
  let rows: Row[] = [];
  try {
    // RPC estreita (só as colunas de crédito, security definer): a RLS
    // esconde do anon os navios do line-up ainda não revisados, e a
    // atribuição tem de cobrir TODAS as fotos que a busca mostra.
    const { data } = await clientePublico().rpc("vessel_photo_credits");
    rows = (data ?? []) as Row[];
  } catch {
    rows = [];
  }

  return (
    <main>
      <Breadcrumb trail={[{ label: "Photo credits" }]} />
      <h1 className="pagettl">Photo credits</h1>
      <p className="pagelead">
        Vessel photos come from Wikimedia Commons contributors, published under
        free licences (CC BY, CC BY-SA, CC0 or public domain). Each one is
        credited below, as its licence asks.
      </p>

      {rows.length === 0 ? (
        <div className="infobox" style={{ marginTop: 14 }}>
          No third-party vessel photos on file right now.
        </div>
      ) : (
        <div className="cart-list" style={{ marginTop: 8 }}>
          {rows.map((r) => {
            const src = imageUrl(r.image_path);
            return (
              <div className="ci credit-ship" key={`${r.name}-${r.imo ?? ""}`}>
                {/* Mesma moldura da foto de navio do checkout: fundo branco
                    e contain, para não recortar o casco. */}
                <span className="ph" style={src ? { background: "#FFFFFF" } : undefined}>
                  {src ? (
                    <Image src={src} alt="" fill sizes="52px" style={{ objectFit: "contain" }} />
                  ) : (
                    <span aria-hidden>⚓</span>
                  )}
                </span>
                <div>
                  <div className="nm">{tituloNavio(r)}</div>
                  <div className="pr">{r.image_credit}</div>
                  {r.image_source && (
                    <div className="pr">
                      <a
                        className="alink"
                        href={r.image_source}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                      >
                        Source
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
