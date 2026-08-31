"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/format";

function ForgotInner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main>
      <Breadcrumb
        trail={[
          { label: "Login", href: `/login?next=${encodeURIComponent(next)}` },
          { label: "Reset password" },
        ]}
      />

      {sent ? (
        <>
          <div className="okwrap">
            <div className="okring">🔑</div>
            <h2>Check your inbox</h2>
            <p>
              If an account exists for <span className="mono">{email}</span>, a reset link is on
              its way.
            </p>
          </div>
          <div className="stack" style={{ marginTop: 18 }}>
            <p className="note">
              Open the link on this phone and set a new password. Check spam / junk too.
            </p>
            <p className="linkline">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="hero-mini">
            <p className="kicker">Forgot password</p>
            <h2>Happens at sea.</h2>
            <p>Tell us your email and we&apos;ll send a link to set a new one.</p>
          </div>
          <div className="stack">
            <form onSubmit={submit} className="stack" style={{ padding: 0 }}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ship.com"
                />
              </div>
              {err && <p className="alert">{err}</p>}
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="linkline">
              Remembered it? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </p>
          </div>
        </>
      )}
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="spin" />}>
      <ForgotInner />
    </Suspense>
  );
}
