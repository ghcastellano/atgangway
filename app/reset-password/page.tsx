"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN } from "@/lib/format";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // .catch obrigatório: sem ele uma rede ruim vira rejeição sem dono
    // e a tela fica no estado "verificando" para sempre.
    supabase.auth
      .getUser()
      .then(({ data }) => setHasSession(!!data.user))
      .catch(() => setHasSession(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < PASSWORD_MIN) {
      setErr(`Password needs at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/account");
      router.refresh();
    }, 1400);
  }

  return (
    <main>
      <Breadcrumb trail={[{ label: "Login", href: "/login" }, { label: "New password" }]} />

      <div className="hero-mini">
        <p className="kicker">Reset</p>
        <h2>Set a new password.</h2>
        <p>{`Fresh line, fresh knot. Minimum ${PASSWORD_MIN} characters.`}</p>
      </div>
      <div className="stack">
        {hasSession === null ? (
          <div className="spin" />
        ) : !hasSession ? (
          <>
            <p className="alert">
              This page only works right after opening the reset link from your email. Request a
              new link and try again.
            </p>
            <p className="linkline">
              <Link href="/forgot-password">Request new link</Link>
            </p>
          </>
        ) : done ? (
          <p className="note">Password updated — taking you to your account…</p>
        ) : (
          <form onSubmit={submit} className="stack" style={{ padding: 0 }}>
            <div className="field">
              <label htmlFor="pw1">New password</label>
              <input
                id="pw1"
                type="password"
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw2">Repeat new password</label>
              <input
                id="pw2"
                type="password"
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </div>
            {err && <p className="alert">{err}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
