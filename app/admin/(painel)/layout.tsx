import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import type { Notificacao } from "@/components/admin/Sino";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { ehAdmin } from "@/lib/admin";
import { supabaseConfigured } from "@/lib/env";
import { signOut } from "@/app/account/actions";

export const dynamic = "force-dynamic";

/**
 * A porta do painel. Sessão pelo JWT (local), papel pelo perfil (uma
 * consulta), notificações não lidas (uma consulta, em paralelo). Quem
 * não é da equipe vê quem é e por onde sair — não um erro genérico.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    return (
      <main className="adm-login">
        <p className="adm-alerta erro">Backend não configurado — veja o README para provisionar o Supabase.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) redirect("/admin/login?next=/admin");

  const [admin, notifs] = await Promise.all([
    ehAdmin(supabase, user.id),
    supabase
      .from("admin_notifications")
      .select("id, kind, severity, title, body, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!admin) {
    return (
      <main className="adm-login">
        <div className="adm-login-card">
          <p className="kicker">Acesso restrito</p>
          <h1>Esta área é da equipe.</h1>
          <p className="adm-muted">
            Você está conectado como <b className="mono">{user.email}</b>, e esta conta não tem acesso ao
            painel. Se deveria ter, peça ao responsável para incluir o e-mail na lista da equipe.
          </p>
          <div className="adm-login-links">
            <Link href="/">← Voltar à loja</Link>
            <form action={signOut}>
              <button type="submit" className="adm-link">Sair desta conta</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AdminShell email={user.email ?? ""} notificacoes={(notifs.data ?? []) as Notificacao[]}>
      {children}
    </AdminShell>
  );
}
