"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import PhoneInput from "@/components/PhoneInput";
import SearchSelect, { type SelectOption } from "@/components/SearchSelect";
import VesselSearch, { type VesselValue } from "@/components/VesselSearch";
import { COUNTRIES } from "@/lib/countries";

import { createClient } from "@/lib/supabase/client";
import AccountRail from "@/components/AccountRail";
import EsqueletoConta from "@/components/EsqueletoConta";
import AccountTabs from "@/components/AccountTabs";
import { missingProfileFields } from "@/lib/profile";
import { saveProfile } from "./actions";

/**
 * "My Account Information" na estrutura do Sunny: um formulário só, com
 * exatamente os campos que o checkout confirma — e, embaixo, os cartões
 * de atalho das outras seções da conta.
 *
 * A tela inteira é cliente, ao contrário do resto da loja. Não é
 * preferência: VesselSearch, SearchSelect e PhoneInput são campos com
 * estado, e o valor de um deles (o navio) sai de uma busca no servidor.
 * Um formulário partido em ilhas custaria mais round-trips do que a
 * consulta única que a montagem faz aqui — é a mesma escolha do /signup.
 */

const DEPARTMENT: Record<string, string> = {
  deck: "Deck",
  engine: "Engine",
  catering: "Catering",
  other: "Other",
};

/** Nacionalidade é código ISO no banco — o rótulo pode ser reescrito, ele não. */
const NATIONALITIES: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name}`,
}));

type PortRow = { id: string; name: string; country_code: string };

type ProfileRow = {
  full_name: string | null;
  rank_slug: string | null;
  nationality: string | null;
  whatsapp: string | null;
  port_id: string | null;
  ship_id: string | null;
  vessel_name: string | null;
  vessel_imo: string | null;
  vessel_flag: string | null;
  role: string | null;
  ships: { name: string; imo: string | null; flag: string | null; eta: string | null; ata: string | null } | null;
};

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [callOver, setCallOver] = useState(false);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [rank, setRank] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [vessel, setVessel] = useState<VesselValue | null>(null);
  const [portId, setPortId] = useState("");

  const [ranks, setRanks] = useState<SelectOption[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        router.replace("/login?next=/account");
        return;
      }

      // As três consultas são independentes: em série custariam três
      // idas ao satélite para montar uma tela só.
      const [profile, rankRows, portRows] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `full_name, rank_slug, nationality, whatsapp, port_id, ship_id,
             vessel_name, vessel_imo, vessel_flag, role,
             ships!profiles_ship_id_fkey(name, imo, flag, eta, ata)`
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("crew_ranks").select("slug, name, department").order("sort_order"),
        supabase
          .from("ports")
          .select("id, name, country_code")
          .eq("active", true)
          .order("sort_order"),
      ]);
      if (!alive) return;

      const p = (profile.data ?? null) as ProfileRow | null;

      setEmail(user.email ?? "");
      setIsAdmin(p?.role === "admin");

      // O banco guarda um nome só. O primeiro token vira First Name e todo
      // o resto vai para Last Name — assim juntar de volta devolve
      // exatamente o que estava lá, que é o que a prancha de embarque usa.
      const parts = (p?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
      setFirst(parts[0] ?? "");
      setLast(parts.slice(1).join(" "));

      setRank(p?.rank_slug ?? "");
      setNationality(p?.nationality ?? "");
      // O campo nasce com o número salvo, como qualquer outro campo do
      // formulário. O PhoneInput aceita a semeadura atrasada.
      setPhone(p?.whatsapp ?? "");
      setPortId(p?.port_id ?? "");

      // O navio pode vir nulo mesmo com ship_id: a RLS de ships só devolve
      // os do line-up, e casco cadastrado pela tripulação nasce inativo.
      // Nome, IMO e bandeira desnormalizados no perfil sustentam a tela.
      const shipName = (p?.ships?.name ?? p?.vessel_name ?? "").trim();
      // Mesma régua da rotação no banco: o navio esteve e foi.
      const fim = p?.ships?.ata ?? p?.ships?.eta;
      setCallOver(Boolean(fim && new Date(fim).getTime() + 48 * 3600e3 < Date.now()));
      setVessel(
        shipName
          ? {
              id: p?.ship_id ?? null,
              name: shipName,
              imo: p?.ships?.imo ?? p?.vessel_imo ?? null,
              flag: p?.ships?.flag ?? p?.vessel_flag ?? null,
            }
          : null
      );

      setRanks(
        (rankRows.data ?? []).map((r) => ({
          value: r.slug as string,
          label: r.name as string,
          group: DEPARTMENT[r.department as string] ?? (r.department as string),
        }))
      );
      setPorts((portRows.data ?? []) as PortRow[]);

      // Quem chega aqui vindo do Google cai num formulário vazio sem
      // saber por quê. O aviso nasce com a tela, não só depois de salvar.
      setMissing(missingProfileFields(p));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setMissing([]);

    // O formulário é noValidate: a bolha nativa do navegador barrava o
    // envio sem deixar recado nenhum na tela. No celular ela aparece
    // fora do campo de visão e some sozinha — a pessoa apertava Save e
    // nada acontecia. Aqui o recado fica na tela, e o campo que falta
    // recebe o foco.
    const blanks: { value: string; id: string; message: string }[] = [
      { value: first.trim(), id: "first", message: "First name is required." },
      { value: last.trim(), id: "last", message: "Last name is required." },
    ];
    const blank = blanks.find((f) => !f.value);
    if (blank) {
      setErr(blank.message);
      document.getElementById(blank.id)?.focus();
      return;
    }

    setBusy(true);

    const res = await saveProfile({
      firstName: first,
      lastName: last,
      rankSlug: rank,
      nationality,
      whatsapp: phone,
      portId,
      shipId: vessel?.id ?? null,
      vesselName: vessel?.name ?? "",
      vesselImo: vessel?.imo ?? null,
      vesselFlag: vessel?.flag ?? null,
    });

    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setSaved(true);
    // Salvar cadastro parcial é permitido de propósito — quem ainda não
    // sabe o navio precisa poder guardar o resto. O que o checkout vai
    // cobrar depois vira aviso aqui, não trava.
    setMissing(res.missing);

    // O cabeçalho e o checkout leem o perfil no servidor.
    router.refresh();
  }

  // Mesmo esqueleto do loading.tsx desta rota, e de propósito: a tela
  // de espera do servidor e a do cliente têm de ter a MESMA forma,
  // senão a página troca de silhueta no meio do carregamento — que é o
  // salto que se queria eliminar, só que uma etapa adiante.
  if (loading) return <EsqueletoConta forma="formulario" linhas={6} />;

  return (
    <main className="pg-acct">
      <Breadcrumb trail={[{ label: "My Account" }]} />

      <h1 className="secttl left">My Account Information</h1>
      <div className="acct-main">
      {/* O espaçamento está na folha (30-formularios-e-pedidos.css),
          junto da regra de desktop que trata este mesmo parágrafo. */}
      <p className="finehint">
        Signed in as <span className="mono">{email}</span>
      </p>

      {/* noValidate: a validação é nossa. Ver o comentário em submit(). */}
      <form onSubmit={submit} className="stack" noValidate>
        <div className="field">
          <label htmlFor="first">First Name</label>
          <input
            id="first"
            required
            autoComplete="given-name"
            enterKeyHint="next"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="As on your seaman's book"
          />
        </div>

        <div className="field">
          <label htmlFor="last">Last Name</label>
          <input
            id="last"
            required
            autoComplete="family-name"
            enterKeyHint="next"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>

        <SearchSelect
          label="Rank"
          options={ranks}
          value={rank}
          onChange={setRank}
          placeholder="Search your rank"
        />

        <SearchSelect
          label="Nationality"
          options={NATIONALITIES}
          value={nationality}
          onChange={setNationality}
          placeholder="Search your country"
        />

        {/* O campo mostra o número salvo, como todo campo de edição. O
            aviso "Currently saved" que vivia aqui era muleta da época em
            que o PhoneInput perdia a corrida com o carregamento do
            perfil e montava vazio — campo vazio com o valor real num
            rodapé lê como cadastro perdido. */}
        <PhoneInput
          value={phone}
          onChange={setPhone}
          required
          label="Telephone"
          countryHint={nationality}
        />

        {/* A escala do navio salvo acabou: é AQUI que a pessoa conserta, e
            o campo sozinho não conta que precisa. Aviso, não bloqueio —
            quem embarca de novo no mesmo casco daqui a um mês não deve
            brigar com o formulário. Some assim que outro navio é
            escolhido, porque o convite já foi aceito. */}
        {callOver && vessel?.id && (
          <p className="finehint" style={{ color: "var(--amber-hi)" }}>
            {vessel.name}&apos;s call at Santos is over — pick the vessel you&apos;re on now.
          </p>
        )}
        <VesselSearch
          value={vessel}
          onChange={(v) => {
            setVessel(v);
            setCallOver(false);
          }}
        />

        {/* <select> nativo: são três portos, e no celular o nativo vira a
            roda do sistema — mais rápida que qualquer combobox nosso. */}
        <div className="field">
          <label htmlFor="port">Home port</label>
          <select id="port" value={portId} onChange={(e) => setPortId(e.target.value)}>
            <option value="">Select your home port</option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.country_code.toUpperCase()}]
              </option>
            ))}
          </select>
          <p className="finehint">
            Where we meet your vessel. The delivery date comes from this port&apos;s grid.
          </p>
        </div>

        {err && (
          <p className="alert" role="alert">
            {err}
          </p>
        )}
        {saved ? (
          <p className="note" role="status">
            {missing.length === 0
              ? "Your details are saved — the store is open to you."
              : `Saved. Still missing your ${missing.join(", ")} — the store stays locked until they're filled.`}
          </p>
        ) : (
          missing.length > 0 && (
            <p className="note">
              We need your {missing.join(", ")} before you can browse and order. Your vessel and
              home port are what set your delivery date — without them we don&apos;t know which
              ship to meet, or when.
            </p>
          )
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <p className="finehint">
          Checkout confirms these details instead of asking again. They are asked once, here,
          because a delivery to a gangway needs a ship, a berth and a way to reach you.
        </p>
      </form>
      </div>

      {/* O Sign Out e o contato saíram daqui para dentro do AccountRail.
          Passados como children, eles existiam só nesta tela — e por
          isso /orders, /wishlist e /captain terminavam sem saída de
          sessão. Menu igual nas quatro telas exige que o menu seja dono
          das próprias partes. */}
      <AccountRail current="/account" isAdmin={isAdmin} />
      <AccountTabs />

    </main>
  );
}
