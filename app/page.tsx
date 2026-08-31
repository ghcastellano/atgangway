import Link from "next/link";
import Image from "next/image";
import CaptainStrip from "@/components/CaptainStrip";
import HeroSteps from "@/components/HeroSteps";
import { IconCompass, IconPackage } from "@/components/Icon";
import VesselPanel, { type VesselFacts } from "@/components/VesselPanel";
import { callState, canOrder } from "@/lib/callstate";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import CategoryIcon from "@/components/CategoryIcon";
import ProductCardView from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
import { imageUrl, listProducts, type Category, type ProductCard } from "@/lib/catalog";
import { wishedProductIds } from "@/lib/wishlist";
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";
import { DEPOSIT_PCT } from "@/lib/money";

/**
 * Home = vitrine, na ordem do Sunny: hero, "Categories", grade de
 * categorias raiz, e as faixas "On promo now" e "New arrivals".
 * O seletor de navio saiu daqui — navio agora mora no perfil, e a
 * pessoa chega na loja querendo ver o que tem, não preencher um passo.
 *
 * A rota é dinâmica porque a tira do navio lê a sessão, e sessão não
 * cabe em página estática. Isso NÃO custa o cache: as quatro consultas
 * públicas da vitrine ficam em unstable_cache por 300s (o revalidate
 * que a espec pede), então o que renderiza por requisição é só a tira.
 */
export const dynamic = "force-dynamic";

type RootCat = Pick<Category, "id" | "slug" | "name" | "icon"> & {
  /** Caminho materializado ("/new-arrivals/") — chave do filtro da RPC. */
  path: string;
  /** Corredores dentro do departamento. Vazio = departamento folha. */
  filhos: Pick<Category, "id" | "slug" | "name">[];
};

/** Peça na prateleira do cartão-coleção (departamento folha). */
type ShelfItem = { slug: string; name: string; img: string | null };

type Storefront = {
  roots: RootCat[];
  counts: Record<string, number>;
  /** Por departamento-folha: as primeiras peças da coleção. */
  shelves: Record<string, ShelfItem[]>;
  promo: ProductCard[];
  fresh: ProductCard[];
};

const EMPTY: Storefront = { roots: [], counts: {}, shelves: {}, promo: [], fresh: [] };

/**
 * Cliente anônimo, sem cookie, de propósito: unstable_cache não pode
 * tocar em nada de escopo de requisição (cookies() aborta o cache), e
 * catálogo é o mesmo para toda a tripulação. RLS de leitura pública
 * cobre categories e products ativos, então anon vê o que deve ver.
 */
const loadStorefront = unstable_cache(
  async (): Promise<Storefront> => {
    if (!supabaseConfigured) return EMPTY;
    try {
      const db = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const [cats, counts, promo, fresh] = await Promise.all([
        // Dois níveis, não um: o cartão de departamento lista os
        // corredores que tem dentro. Com dois departamentos, uma fileira
        // de dois cartõezinhos com uma seta deixava mil pixels vazios à
        // direita — e não dizia nada que a barra de cima já não diga.
        db
          .from("categories")
          .select("id, slug, name, icon, parent_id, depth, path")
          .eq("active", true)
          .lte("depth", 1)
          .order("sort_order"),
        db.rpc("category_counts"),
        listProducts(db, { badge: "promo", limit: 8 }),
        listProducts(db, { sort: "newest", limit: 8 }),
      ]);

      // Objeto simples, não Map: o valor atravessa a serialização do
      // cache e Map volta vazio do outro lado.
      const byId: Record<string, number> = {};
      for (const r of (counts.data ?? []) as { category_id: string; product_count: number }[]) {
        byId[r.category_id] = Number(r.product_count) || 0;
      }

      type Nivel = RootCat & { parent_id: string | null; depth: number };
      const todas = (cats.data ?? []) as Nivel[];
      const raizes = todas
        .filter((c) => c.depth === 0)
        .map((c) => ({ ...c, filhos: todas.filter((f) => f.parent_id === c.id) }));

      // Departamento SEM corredores (uma coleção, como New Arrivals) não
      // tem lista para encher o cartão — e o grid estica todos à altura do
      // mais alto, então sobrava um buraco anunciando que ali havia algo.
      // Em vez de encolher o cartão, ele passa a MOSTRAR a coleção, que é
      // exatamente o que o nome promete: "New Arrivals" deixa de contar o
      // que chegou e passa a mostrar. Só folha COM produto paga consulta,
      // e ela entra no mesmo cache de 300s da vitrine.
      const folhas = raizes.filter((c) => c.filhos.length === 0 && (byId[c.id] ?? 0) > 0);
      const vitrines = await Promise.all(
        folhas.map((c) => listProducts(db, { category: c.path, limit: 3 }))
      );
      const shelves: Record<string, ShelfItem[]> = {};
      folhas.forEach((c, i) => {
        shelves[c.id] = vitrines[i].items.map((p) => ({
          slug: p.slug,
          name: p.name,
          img: imageUrl(p.primary_image_path),
        }));
      });

      return {
        roots: raizes as RootCat[],
        counts: byId,
        shelves,
        promo: promo.items,
        fresh: fresh.items,
      };
    } catch {
      // Catálogo fora do ar não pode devolver erro na porta de entrada.
      return EMPTY;
    }
  },
  ["home-storefront"],
  { revalidate: 300, tags: ["catalog"] }
);

type Captain = { code: string; rate: number } | null;

/** A mesma escala, de volta: casado por IMO, que é a identidade do casco. */
export type BackAgain = { shipId: string; name: string; eta: string } | null;

type Crew =
  | { kind: "vessel"; v: VesselFacts; cap: Captain; credit: number; back: BackAgain }
  | { kind: "invite"; cap: Captain }
  | null;

type CrewRow = {
  ship_id: string | null;
  referral_code: string | null;
  vessel_imo: string | null;
  ships: {
    name: string; eta: string; berth: string | null; ata: string | null;
    imo: string | null; voyage: string | null; flag: string | null;
    cutoff_hours: number | null; delay_hours: number | null;
  } | null;
};

/** Perfil do usuário logado — só o que a tira do navio precisa. */
async function loadCrew(): Promise<Crew> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Berço, IMO, viagem, bandeira, ATA e atraso já estavam no banco e
    // não apareciam em lugar nenhum da loja. São eles que transformam a
    // tira num painel de escala de verdade.
    const { data } = await supabase
      .from("profiles")
      .select(
        "ship_id, referral_code, vessel_imo, ships(name, eta, berth, ata, imo, voyage, flag, cutoff_hours, delay_hours)"
      )
      .eq("id", user.id)
      .maybeSingle();

    const row = data as CrewRow | null;

    // A faixa sai de referral_rate, não de uma constante na tela: quem
    // já indicou cinco pedidos ganha 6% e a home tem de dizer 6%, senão
    // o programa mente para justamente quem mais indica.
    let cap: Captain = null;
    if (row?.referral_code) {
      const { data: rate } = await supabase.rpc("referral_rate", { p_user: user.id });
      cap = { code: row.referral_code, rate: Number(rate ?? 5) };
    }
    // ship_id sem ships é raro de verdade: a RLS devolve o próprio navio
    // MESMO inativo (um comentário antigo aqui dizia o contrário, e por
    // isso o caso "já zarpou" nunca caía neste ramo — o painel mostrava
    // a escala morta como "Closed" para sempre). Quem trata a escala
    // encerrada agora é o VesselPanel, com estado próprio; este ramo
    // fica só para navio de fato apagado do banco.
    if (!row?.ship_id || !row.ships) return { kind: "invite", cap };
    const s = row.ships;

    // O crédito só é buscado quando vai aparecer: com a escala
    // encerrada, ele é o número grande do cartão — o motivo de voltar.
    // Mesma régua do banco (rotação e crédito de desvio): o navio
    // esteve e foi, coalesce(ata, eta) + 48h.
    let credit = 0;
    let back: BackAgain = null;
    if (callState({ eta: s.eta, ata: s.ata, cutoff_hours: s.cutoff_hours }) === "sailed") {
      const { data: creditos } = await supabase
        .from("credits")
        .select("amount_usd")
        .eq("user_id", user.id);
      credit = (creditos ?? []).reduce((t, c) => t + Number(c.amount_usd), 0);

      // O casco tem identidade — o IMO. A escala morreu, mas se o MESMO
      // navio já reapareceu no line-up com outra viagem, o app reconhece
      // e oferece o re-vínculo antes que a pessoa vá procurar. Só entra
      // escala com janela ainda aberta: sugerir uma já fechada seria
      // repetir o beco sem saída que esta fase existe para eliminar.
      const imo = row.vessel_imo ?? s.imo;
      if (imo) {
        const { data: volta } = await supabase
          .from("ships")
          .select("id, name, eta, ata, cutoff_hours")
          .eq("imo", imo)
          .neq("id", row.ship_id)
          .gt("eta", new Date().toISOString())
          .order("eta", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (volta && canOrder(callState(volta))) {
          back = { shipId: volta.id, name: volta.name, eta: volta.eta };
        }
      }
    }

    return {
      kind: "vessel",
      cap,
      credit,
      back,
      v: {
        name: s.name, berth: s.berth, eta: s.eta, ata: s.ata,
        imo: s.imo, voyage: s.voyage, flag: s.flag,
        // 24h é o corte padrão da operação quando o navio não traz o seu.
        cutoffHours: s.cutoff_hours ?? 24,
        delayHours: s.delay_hours,
      },
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const [store, crew] = await Promise.all([loadStorefront(), loadCrew()]);

  // Fora do cache da vitrine de propósito: a lista de desejos é de
  // cada pessoa, e um cache compartilhado mostraria o coração de
  // outro marinheiro. As faixas são cacheadas; o estado do coração,
  // não.
  const wished = await wishedProductIds([...store.promo, ...store.fresh].map((p) => p.id));

  // Categoria vazia não entra na vitrine. "Promo · 0 items" convida o
  // toque e entrega uma página em branco — pior que não oferecer. Elas
  // continuam no drawer, que é onde se navega a estrutura inteira.
  // Retaguarda: se NENHUMA tiver produto, mostra todas, senão a home
  // fica sem porta de entrada enquanto o catálogo não chega.
  const withStock = store.roots.filter((c) => (store.counts[c.id] ?? 0) > 0);
  const shown = withStock.length > 0 ? withStock : store.roots;

  return (
    <main className="pg-home">
      <section className="homehero">
        <p className="kicker">At Gangway · Porto de Santos</p>
        <h1>Delivered to your gangway at Porto de Santos</h1>
        <p className="lead">
          Pre-order before you dock, pay a {DEPOSIT_PCT}% deposit, collect at the gangway.
        </p>
          {/* Chamadas do herói: só aparecem no desktop. No celular a
              tela já é curta e a grade de categorias vem logo abaixo. */}
          <div className="herocta">
            <Link href="/shop" className="btn" prefetch={false}>
              Shop all supplies
            </Link>
            <Link href="/ports" className="btn ghost" prefetch={false}>
              Port line-up &amp; cut-offs
            </Link>
          </div>

          {/* A faixa que fecha o herói.
              Com o painel do navio ao lado, o herói fica com 8 das 12
              colunas e o texto ocupava pouco mais de metade: sobrava um
              gradiente vazio do tamanho de um card. Encher com desenho
              seria desperdiçar o lugar mais visto da loja — estas três
              são as perguntas que a tripulação faz antes de pedir
              qualquer coisa, e nenhuma estava respondida acima da
              dobra. */}
          <dl className="herofacts">
            <div>
              <dt>Where</dt>
              <dd>At your berth, gangway hand-over</dd>
            </div>
            <div>
              <dt>Deposit</dt>
              <dd>{DEPOSIT_PCT}% now, balance on delivery</dd>
            </div>
            <div>
              <dt>Cut-off</dt>
              <dd>Set by your port line-up</dd>
            </div>
          </dl>
      </section>

      {/* Ordem do DOM = ordem de leitura, e ela vinha errada: estes três
          blocos ficavam DEPOIS da grade de categorias no código e eram
          puxados para cima por grid-row no desktop. O resultado era a
          faixa do Captain caindo entre o título "Categories" e a própria
          grade — colada nela, como se fizesse parte da seção. No celular,
          onde não há grade, apareciam mesmo depois das categorias.

          Agora a ordem do código é a ordem da página em qualquer
          largura, e o CSS não precisa mais remendar posição. */}
      {!crew && <HeroSteps />}

      {crew?.kind === "vessel" && (
        <VesselPanel v={crew.v} credit={crew.credit} back={crew.back} />
      )}

      {/* Logo abaixo do painel da escala, que é o bloco que a pessoa
          logada de fato olha ao entrar. Antes do catálogo de propósito:
          depois das faixas de produto ninguém rola até aqui. */}
      {crew?.cap && (
        <CaptainStrip
          code={crew.cap.code}
          rate={crew.cap.rate}
          link={`${SITE_URL}/r/${crew.cap.code}`}
        />
      )}

      {/* Título e grade dentro da MESMA <section>, como já estavam as
          faixas de promoção e novidades. É o que faz o título ficar
          preso ao conteúdo dele: o vão entre blocos é o compasso da
          página, e dentro da seção o título usa a margem curta. Solto,
          o título era um filho direto do <main> e recebia o mesmo vão
          da grade — por isso parecia flutuar entre duas seções. */}
      <section>
        <h2 className="secttl">
          Categories
          <Link href="/shop" className="allx" prefetch={false}>
            Browse all ›
          </Link>
        </h2>

        {shown.length === 0 ? (
          <div className="empty">
            <div className="i" aria-hidden><IconCompass size={28} /></div>
            <p className="t">The shelves are being stocked</p>
            <p className="d">Check back shortly — supplies land before every call.</p>
          </div>
        ) : (
          <div className="deptgrid">
            {shown.map((c) => {
              const n = store.counts[c.id] ?? 0;
              return (
                <article key={c.id} className="dept">
                  <Link href={`/c/${c.slug}`} className="dept-top" prefetch={false}>
                    <CategoryIcon slug={c.slug} fallback={c.icon} size={22} />
                    <span className="nm">{c.name}</span>
                    {n > 0 && <span className="ct">{n === 1 ? "1 item" : `${n} items`}</span>}
                  </Link>

                  {/* Os corredores por extenso, com a contagem de cada um.
                      É o que a pessoa quer saber antes de clicar — e é o
                      que enche o cartão com informação em vez de com uma
                      seta. */}
                  {c.filhos.length > 0 && (
                    <ul className="dept-sub">
                      {c.filhos.map((f) => (
                        <li key={f.id}>
                          <Link href={`/c/${f.slug}`} prefetch={false}>
                            <span className="nm">{f.name}</span>
                            <span className="ct">{store.counts[f.id] ?? 0}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Coleção sem corredores: a prateleira entra no lugar da
                      lista. O cartão deixa de ser um rótulo com vazio e
                      passa a entregar a própria promessa do nome. */}
                  {c.filhos.length === 0 && (store.shelves[c.id]?.length ?? 0) > 0 && (
                    <ul className="dept-shelf">
                      {store.shelves[c.id].map((p) => (
                        <li key={p.slug}>
                          <Link href={`/p/${p.slug}`} prefetch={false}>
                            <span className="th">
                              {p.img ? (
                                <Image src={p.img} alt="" fill sizes="120px" style={{ objectFit: "contain" }} />
                              ) : (
                                <span aria-hidden><IconPackage size={20} /></span>
                              )}
                            </span>
                            <span className="nm">{p.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {crew?.kind === "invite" && (
        <Link href="/account" className="vstrip">
          <span className="ic" aria-hidden>
            ⚓
          </span>
          <span className="tx">
            <span className="lb">Your vessel</span>
            <span className="nm">No call scheduled — pick your next vessel</span>
          </span>
          <span className="eta">Update ›</span>
        </Link>
      )}

      {/* Faixa some inteira quando não há promoção: prateleira vazia
          com título é pior do que prateleira nenhuma. */}
      {store.promo.length > 0 && (
        <section>
          <h2 className="secttl">
            On promo now
            <Link href="/shop?badge=promo" className="allx" prefetch={false}>
              Browse all ›
            </Link>
          </h2>
          <div className="rail">
            {store.promo.map((p) => (
              // Nenhuma imagem com priority: no celular a grade de
              // categorias empurra as faixas para fora da primeira
              // tela, e priority em foto que ninguém vê rouba banda
              // do LCP real — que aqui é o texto do hero.
              <ProductCardView key={p.id} p={p} wished={wished.has(p.id)} sizes="(max-width: 620px) 92vw, (max-width: 767px) 46vw, (max-width: 1023px) 30vw, 360px" />
            ))}
          </div>
        </section>
      )}

      {store.fresh.length > 0 && (
        <section>
          <h2 className="secttl">
            New arrivals
            <Link href="/shop?sort=newest" className="allx" prefetch={false}>
              Browse all ›
            </Link>
          </h2>
          <div className="rail">
            {store.fresh.map((p) => (
              <ProductCardView key={p.id} p={p} wished={wished.has(p.id)} sizes="(max-width: 620px) 92vw, (max-width: 767px) 46vw, (max-width: 1023px) 30vw, 360px" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
