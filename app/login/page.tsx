"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import GoogleButton from "@/components/GoogleButton";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/format";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setNeedsConfirm(true);
        setErr("Your email isn't confirmed yet — open the link we sent you, or resend it below.");
      } else if (/invalid/i.test(error.message)) {
        setErr("Wrong email or password. Forgot it? Reset below.");
      } else {
        setErr(error.message);
      }
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function resendConfirmation() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setErr(null);
      setInfo(`Confirmation email resent to ${email} — check spam/junk too.`);
    }
  }

  return (
    <main>
      <Breadcrumb trail={[{ label: "Login" }]} />
      <h1 className="secttl">Login</h1>

      <form onSubmit={submit} className="stack">
        {urlError && <p className="alert">{urlError}</p>}

        <div className="field">
          <label htmlFor="email">Email</label>
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

        <div className="field">
          <label htmlFor="password">Password</label>
          {/* O olho fica num .field só dele para centrar no input. */}
          <div className="field haseye">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              required
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="pweye"
              onClick={() => setShowPw((v) => !v)}
              aria-pressed={showPw}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* O switch "Stay logged in" saiu: nunca mudou comportamento (a
            persistência é decidida na criação do client do Supabase) e um
            controle que não controla nada é pior que nenhum — quem o
            desligava num computador de passadiço achava que estava seguro. */}
        <p className="linkline" style={{ textAlign: "left" }}>
          <Link href={`/forgot-password?next=${encodeURIComponent(next)}`}>
            Forgot Your Password?
          </Link>
        </p>

        {err && <p className="alert">{err}</p>}
        {info && <p className="note">{info}</p>}
        {needsConfirm && (
          <button
            type="button"
            className="btn ghost"
            onClick={resendConfirmation}
            disabled={busy || !email}
          >
            Resend confirmation email
          </button>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Login"}
        </button>
      </form>

      <div className="stack">
        <div className="divider">or</div>
        <GoogleButton next={next} />
        <p className="linkline">
          Don&apos;t have an account?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>Register here</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="spin" />}>
      <LoginInner />
    </Suspense>
  );
}
