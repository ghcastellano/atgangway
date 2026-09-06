"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconAnchor } from "@/components/Icon";
import { safeNext } from "@/lib/format";

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
  const destino = next === "/admin" || next.startsWith("/admin/") ? next : "/admin";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"login" | "reset" | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("login");
    setErro(null);
    setInfo(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) {
        setErro(/invalid/i.test(error.message) ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente novamente em instantes.");
        return;
      }
      router.push(destino);
      router.refresh();
    } catch {
      setErro("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function esqueci() {
    if (busy) return;
    if (!email.trim()) {
      setErro("Digite o e-mail da conta para receber o link de redefinição.");
      return;
    }
    setBusy("reset");
    setErro(null);
    setInfo(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });
      if (error) setErro("Não foi possível solicitar o link agora. Tente novamente em instantes.");
      else setInfo(`Se ${email.trim()} tiver uma conta, o link de redefinição chega em instantes.`);
    } catch {
      setErro("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="adm-login">
      <form onSubmit={entrar} className="adm-login-card" aria-labelledby="titulo-login" aria-busy={Boolean(busy)}>
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

        <button className="adm-btn primario grande" type="submit" disabled={Boolean(busy)} aria-busy={busy === "login"}>
          {busy === "login" ? <span className="adm-spin" aria-hidden /> : null}
          {busy === "login" ? "Entrando…" : "Entrar"}
        </button>

        <div className="adm-login-links">
          <button type="button" className="adm-link" onClick={esqueci} disabled={Boolean(busy)} aria-busy={busy === "reset"}>
            {busy === "reset" ? "Enviando link…" : "Esqueci a senha"}
          </button>
          <Link href="/">Voltar à loja</Link>
        </div>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="adm-login" />}>
      <LoginPainel />
    </Suspense>
  );
}
