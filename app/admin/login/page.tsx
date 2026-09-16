"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconAnchor } from "@/components/Icon";
import { safeNext } from "@/lib/format";
import { signInFailure } from "@/lib/authmsg";

/**
 * A porta do painel. Só e-mail e senha — sem Google, sem cadastro:
 * quem entra aqui é a equipe, e a equipe é a lista de e-mails
 * autorizados no banco (admin_emails / profiles.role). Uma conta de
 * cliente até consegue autenticar, mas o layout do painel a barra na
 * porta seguinte, com nome e sobrenome.
 */
function LoginPainel() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/admin");
  const destino = next.startsWith("/admin") ? next : "/admin";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setBusy(false);
      setErro(signInFailure(error) === "invalid" ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    router.push(destino);
    router.refresh();
  }

  async function esqueci() {
    if (!email.trim()) {
      setErro("Digite o e-mail da conta para receber o link de redefinição.");
      return;
    }
    setBusy(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setBusy(false);
    if (error) setErro(error.message);
    else setInfo(`Se ${email.trim()} for uma conta da equipe, o link de redefinição chega em instantes.`);
  }

  return (
    <main className="adm-login sup-escura">
      <form onSubmit={entrar} className="adm-login-card" aria-labelledby="titulo-login">
        <div className="adm-login-brand">
          <IconAnchor className="mark" size={26} />
          <div>
            <p className="kicker">At Gangway · Porto de Santos</p>
            <h1 id="titulo-login">Painel da operação</h1>
          </div>
        </div>

        {erro && <p className="adm-alerta erro" role="alert">{erro}</p>}
        {info && <p className="adm-alerta ok" role="status">{info}</p>}

        <label className="adm-field">
          <span>E-mail</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="help@atgangway.com"
            autoFocus
          />
        </label>

        <label className="adm-field">
          <span>Senha</span>
          <div className="adm-senha">
            <input
              type={ver ? "text" : "password"}
              name="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button type="button" className="adm-link" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
              {ver ? "ocultar" : "mostrar"}
            </button>
          </div>
        </label>

        <button className="adm-btn primario grande" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? <span className="adm-spin" aria-hidden /> : null}
          {busy ? "Entrando…" : "Entrar"}
        </button>

        <div className="adm-login-links">
          <button type="button" className="adm-link" onClick={esqueci} disabled={busy}>
            Esqueci a senha
          </button>
          <Link href="/">Voltar à loja</Link>
        </div>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="adm-login sup-escura" />}>
      <LoginPainel />
    </Suspense>
  );
}
