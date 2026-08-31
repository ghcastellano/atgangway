import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { createClient } from "@/lib/supabase/server";
import { imageUrl } from "@/lib/catalog";
import CheckoutClient from "./CheckoutClient";
import { currentFxRate } from "@/lib/fxrate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout" };

/** Linha do perfil com os vínculos resolvidos pelo PostgREST. */
type ProfileRow = {
  full_name: string | null;
  whatsapp: string | null;
  ship_id: string | null;
  vessel_name: string | null;
  vessel_flag: string | null;
  crew_ranks: { name: string } | null;
  ports: { name: string } | null;
  ships: { name: string; flag: string | null; image_path: string | null } | null;
};

/**
 * Checkout na estrutura do Sunny: não é formulário de endereço, é um
 * cartão de CONFIRMAÇÃO do que já está no perfil. Quem embarca digita
 * os dados uma vez no cadastro; repetir isso a cada pedido, num teclado
 * de celular e no wifi do navio, é onde o carrinho morre.
 *
 * Consequência: campo faltando não vira input aqui — vira aviso vermelho
 * com link para /account. O pedido só sai quando o perfil fecha.
 *
 * O cartão é Server Component de propósito: é texto vindo do banco, sem
 * gesto nenhum. Só o resumo e o botão (que dependem do carrinho, que
 * mora no localStorage) atravessam para o cliente.
 */
export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/checkout");

  const { data } = await supabase
    .from("profiles")
    .select(
      `full_name, whatsapp, ship_id, vessel_name, vessel_flag,
       crew_ranks!profiles_rank_slug_fkey(name),
       ports!profiles_port_id_fkey(name),
       ships!profiles_ship_id_fkey(name, flag, image_path)`
    )
    .eq("id", user.id)
    .maybeSingle();

  const row = (data ?? null) as ProfileRow | null;

  // O navio pode vir nulo mesmo com ship_id preenchido: a RLS de ships
  // só devolve os do line-up (active), e navio cadastrado pela própria
  // tripulação nasce inativo. Por isso o perfil guarda nome e bandeira
  // desnormalizados — são eles que sustentam a tela nesse caso.
  const shipRow = row?.ships ?? null;

  const name = row?.full_name?.trim() ?? "";
  const rank = row?.crew_ranks?.name?.trim() ?? "";
  const vessel = (shipRow?.name ?? row?.vessel_name ?? "").trim();
  const flag = (shipRow?.flag ?? row?.vessel_flag ?? "").trim();
  const port = row?.ports?.name?.trim() ?? "";
  const email = user.email ?? "";
  const phone = row?.whatsapp?.trim() ?? "";
  const shipPhoto = imageUrl(shipRow?.image_path);

  // Bloqueia o pagamento só no que quebra de verdade: navio e porto (a
  // entrega não acontece sem eles), telefone (o placeOrder valida o
  // formato no servidor e recusaria o pedido) e nome (é quem assina na
  // prancha). Rank é recomendado — não segura ninguém.
  const missing = { name: !name, vessel: !vessel, port: !port, phone: !phone };
  const blocked = Object.values(missing).some(Boolean);

  // Cotação só para a referência em real de quem paga em PIX — a
  // cobrança do Stripe é em dólar. Null quando o PTAX está velho
  // demais: aí a tela simplesmente não mostra número em real.
  const fxRate = await currentFxRate();


  return (
    <main className="pg-checkout">
      <Breadcrumb trail={[{ label: "Shopping Cart", href: "/cart" }, { label: "Checkout" }]} />

      <h1 className="secttl left">Checkout</h1>

      <section className="sumcard framed" aria-labelledby="pd">
        <h3 id="pd">Personal details</h3>

        <dl style={{ margin: 0 }}>
          <Fact label="Name" value={name} required />
          <Fact label="Rank" value={rank} />

          <div className={`factrow${vessel ? "" : " missing"}`}>
            <dt>Vessel</dt>
            <dd>
              {vessel ? (
                <span className="factship">
                  {/* Foto de navio segue a regra da casa: fundo branco e
                      contain, para não recortar o casco no enquadramento. */}
                  <span className="ph" style={shipPhoto ? { background: "#FFFFFF" } : undefined}>
                    {shipPhoto ? (
                      <Image
                        src={shipPhoto}
                        alt=""
                        fill
                        sizes="52px"
                        style={{ objectFit: "contain" }}
                      />
                    ) : (
                      <span aria-hidden>⚓</span>
                    )}
                  </span>
                  <span>
                    {vessel.toUpperCase()}
                    {flag && ` [${flag.toUpperCase()}]`}
                  </span>
                </span>
              ) : (
                <Missing field="Vessel" />
              )}
            </dd>
          </div>

          <Fact label="Port" value={port} required />
          <Fact label="Email" value={email} required />
          <Fact label="Telephone" value={phone} required />
        </dl>

        {/* Sem a regra .factfoot no CSS ainda, cai no .finehint e continua
            legível — só perde o fio que o separa do último campo. */}
        <p className="finehint factfoot">
          Need to change these details?{" "}
          <Link className="alink" href="/account">
            👤 Update your profile
          </Link>
        </p>
      </section>

      <CheckoutClient
        fxRate={fxRate}
        blocked={blocked}
        shipId={row?.ship_id ?? null}
        contactName={name}
        contactWhatsapp={phone}
      />
    </main>
  );
}

/** Rótulo cinza em cima, valor em negrito embaixo — ou o aviso vermelho. */
function Fact({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div className={`factrow${value ? "" : " missing"}${value || required ? "" : " soft"}`}>
      <dt>{label}</dt>
      <dd>{value || <Missing field={label} required={required} />}</dd>
    </div>
  );
}

/**
 * "Rank is required" seria mentira: o botão continua clicável sem ele.
 * Muda a palavra E a cor: quatro linhas vermelhas iguais fazem o
 * cadastro parecer uma parede, e o que era recomendação vira bloqueio
 * aos olhos de quem só quer pagar.
 */
function Missing({ field, required = true }: { field: string; required?: boolean }) {
  return (
    <>
      {field} is {required ? "required" : "recommended"}.{" "}
      <Link href="/account">Please update your profile.</Link>
    </>
  );
}
