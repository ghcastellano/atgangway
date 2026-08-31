"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import GoogleButton from "@/components/GoogleButton";
import PhoneInput from "@/components/PhoneInput";
import SearchSelect, { type SelectOption } from "@/components/SearchSelect";
import VesselSearch, { createVessel, type VesselValue } from "@/components/VesselSearch";
import { COUNTRIES } from "@/lib/countries";
import { PASSWORD_MIN, safeNext } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const DEPARTMENT: Record<string, string> = {
  deck: "Deck",
  engine: "Engine",
  catering: "Catering",
  other: "Other",
};

/**
 * Nacionalidade vai para o perfil como código ISO (PH, IN, UA…): é o
 * que não muda quando alguém reescreve o nome do país na lista.
 * A ordem é a de lib/countries — as nações que mais embarcam primeiro,
 * que é o que encurta a busca de quem está preenchendo.
 */
const NATIONALITIES: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name}`,
}));

type PortRow = { id: string; name: string; country_code: string };

const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = [
  "var(--danger)",
  "var(--danger)",
  "var(--amber)",
  "var(--amber)",
  "var(--teal)",
];

/**
 * Medidor de força, como o do Sunny. Comprimento pesa mais que
 * "complexidade": senha longa vence senha curta cheia de símbolo. O
 * mínimo é o do Supabase Auth (PASSWORD_MIN), não um número daqui.
 */
function passwordScore(pw: string): number {
  if (pw.length < PASSWORD_MIN) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const Req = () => (
  <span aria-hidden style={{ color: "var(--danger)" }}>
    {" *"}
  </span>
);

function Eye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pweye"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? "🙈" : "👁"}
    </button>
  );
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [vessel, setVessel] = useState<VesselValue | null>(null);
  const [rank, setRank] = useState("");
  const [nationality, setNationality] = useState("");
  const [portId, setPortId] = useState("");
  const [terms, setTerms] = useState(false);

  const [ranks, setRanks] = useState<SelectOption[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [halfSaved, setHalfSaved] = useState(false);

  // crew_ranks é leitura pública e muda uma vez por ano: uma consulta na
  // montagem basta — não vale um Server Component só para servir 20 linhas.
  useEffect(() => {
    let alive = true;
    const db = createClient();
    Promise.all([
      db.from("crew_ranks").select("slug, name, department").order("sort_order"),
      db.from("ports").select("id, name, country_code").eq("active", true).order("sort_order"),
    ]).then(([rankRows, portRows]) => {
      if (!alive) return;
      setRanks(
        (rankRows.data ?? []).map((r) => ({
          value: r.slug as string,
          label: r.name as string,
          group: DEPARTMENT[r.department as string] ?? (r.department as string),
        }))
      );
      setPorts((portRows.data ?? []) as PortRow[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const score = passwordScore(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < PASSWORD_MIN) {
      setErr(`Password needs at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setErr("The two passwords don't match.");
      return;
    }
    if (!phone) {
      setErr("Please enter a telephone number we can reach on WhatsApp.");
      return;
    }
    if (!vessel) {
      setErr("Please find your vessel, or create it.");
      return;
    }
    // Rank e nacionalidade NÃO barram mais o cadastro: nenhum fluxo
    // posterior os exige (o checkout libera sem eles — lib/profile.ts é
    // a régua), e a alfândega precisa deles antes da ENTREGA, não antes
    // de criar conta. Campo obrigatório que nada usa é atrito puro na
    // porta de entrada.
    // O porto faltava aqui, e era o furo: o cadastro terminava "completo"
    // sem ele, e o checkout barrava o pagamento com "Port is required" —
    // todo cliente novo batia nessa parede pelo menos uma vez.
    if (!portId) {
      setErr("Please choose the port where we meet your vessel.");
      return;
    }
    // O botão continua habilitado sem o aceite de propósito: botão
    // desligado não conta a quem usa leitor de tela o que falta.
    if (!terms) {
      setErr("Please accept the terms and conditions.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const fullName = `${first.trim()} ${last.trim()}`.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Os campos também vão no metadata: se a confirmação de email
        // estiver ligada não existe sessão agora, e sem isto o que foi
        // preenchido morreria entre o cadastro e o primeiro login.
        data: {
          full_name: fullName,
          whatsapp: phone,
          rank_slug: rank || null,
          nationality: nationality || null,
          vessel_name: vessel.name,
          vessel_imo: vessel.imo,
          port_id: portId,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    if (!data.session) {
      setBusy(false);
      setSent(true);
      return;
    }

    // create_vessel exige auth.uid(): o navio inventado no formulário só
    // pode nascer agora, com a sessão na mão.
    let shipId = vessel.id;
    if (!shipId) {
      try {
        shipId = await createVessel(vessel);
      } catch {
        // Sem id o perfil ainda guarda nome e IMO — o staff concilia.
      }
    }

    const { error: perr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        whatsapp: phone,
        // opcionais: vazio grava null, não ""
        rank_slug: rank || null,
        nationality: nationality || null,
        ship_id: shipId,
        port_id: portId,
        vessel_name: vessel.name,
        vessel_imo: vessel.imo,
        vessel_flag: vessel.flag,
        profile_completed_at: new Date().toISOString(),
      })
      .eq("id", data.session.user.id);

    setBusy(false);
    if (perr) {
      setHalfSaved(true);
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (sent) {
    return (
      <main className="pg-form">
        <div className="okwrap">
          <div className="okring">✉️</div>
          <h2>Confirm your email</h2>
          <p>
            We sent a confirmation link to <span className="mono">{email}</span>.
          </p>
        </div>
        <div className="stack" style={{ marginTop: 18 }}>
          <p className="note">
            Open the link on this phone to activate your account. No email in 5 minutes? Check
            spam / junk — ship Wi-Fi can be slow.
          </p>
          <p className="linkline">
            Already confirmed?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`}>Login here</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pg-form">
      <Breadcrumb trail={[{ label: "Register to shop" }]} />
      <h1 className="secttl">Register to shop</h1>

      <form onSubmit={submit} className="stack cadgrid">
        <div className="field">
          <label htmlFor="email">
            Email
            <Req />
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@ship.com"
          />
        </div>

        <div className="field par">
          <label htmlFor="password">
            Password
            <Req />
          </label>
          {/* O olho fica num .field só dele para centrar no input: dentro
              do campo inteiro ele subiria para cima do rótulo. */}
          <div className="field haseye">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              required
              minLength={PASSWORD_MIN}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`min. ${PASSWORD_MIN} characters`}
            />
            <Eye shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
          <div className="pwmeter">
            <span className="pwbar">
              <i style={{ width: `${(score / 4) * 100}%`, background: STRENGTH_COLOR[score] }} />
            </span>
            <span className="pwlabel" aria-live="polite">
              Password Strength: {STRENGTH[score]}
            </span>
          </div>
        </div>

        <div className="field par">
          <label htmlFor="confirm">
            Confirm Password
            <Req />
          </label>
          <div className="field haseye">
            <input
              id="confirm"
              type={showPw2 ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repeat the password"
            />
            <Eye shown={showPw2} onToggle={() => setShowPw2((v) => !v)} />
          </div>
        </div>

        <div className="field par">
          <label htmlFor="first">
            First Name
            <Req />
          </label>
          <input
            id="first"
            required
            autoComplete="given-name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="As on your seaman's book"
          />
        </div>

        <div className="field par">
          <label htmlFor="last">
            Last Name
            <Req />
          </label>
          <input
            id="last"
            required
            autoComplete="family-name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>

        <PhoneInput
          value={phone}
          onChange={setPhone}
          required
          label="Telephone number"
          countryHint={nationality}
        />

        {/* deferCreate: aqui ainda não há sessão, então o navio novo fica
            em texto e nasce depois do signUp. */}
        <VesselSearch value={vessel} onChange={setVessel} required deferCreate />

        {/* <select> nativo, como na conta: são três portos, e no celular
            o nativo vira a roda do sistema. */}
        <div className="field par">
          <label htmlFor="port">
            Home port
            <Req />
          </label>
          <select id="port" value={portId} onChange={(e) => setPortId(e.target.value)}>
            <option value="">{ports.length ? "Select your home port" : "Loading ports…"}</option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.country_code.toUpperCase()}]
              </option>
            ))}
          </select>
          <p className="finehint">Where we meet your vessel — it sets your delivery date.</p>
        </div>

        <SearchSelect
          label="Rank"
          options={ranks}
          value={rank}
          onChange={setRank}
          placeholder={ranks.length ? "Search your rank" : "Loading ranks…"}
        />

        <SearchSelect
          label="Nationality"
          options={NATIONALITIES}
          value={nationality}
          onChange={setNationality}
          placeholder="Search your country"
        />
        <p className="finehint">
          Rank and nationality are optional — they speed up port customs
          paperwork, and you can add them any time in My Account.
        </p>

        <label className="switch">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span className="track" />
          <span className="lbl">I accept the terms and conditions</span>
        </label>

        {err && <p className="alert">{err}</p>}
        {halfSaved && (
          <>
            <p className="alert">
              Your account is ready, but we couldn&apos;t save your crew details. Add them from My
              Account before your first order.
            </p>
            <Link className="btn ghost" href={next}>
              Continue
            </Link>
          </>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create an Account"}
        </button>
      </form>

      <div className="stack">
        {/* Google entra depois do botão principal: quem já tem conta
            Google entra por ali, mas o caminho que preenche navio, rank e
            nacionalidade — o que o checkout lê — é o formulário. */}
        <div className="divider">or</div>
        <GoogleButton next={next} />
        <p className="linkline">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Login here</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="spin" />}>
      <SignupInner />
    </Suspense>
  );
}
