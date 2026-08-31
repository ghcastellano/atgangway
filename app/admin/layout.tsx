import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import AdminTabs from "@/components/AdminTabs";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { signOut } from "@/app/account/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    return (
      <>
        <TopBar title="Vessel Ops" backHref="/" chip={false} />
        <main className="stack" style={{ paddingTop: 20 }}>
          <p className="alert">Backend not configured yet — see README to provision Supabase.</p>
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return (
      <>
        <TopBar title="Staff access" backHref="/" chip={false} />
        <main>
          <div className="hero-mini">
            <p className="kicker">Staff only</p>
            <h2>This deck is crew-restricted.</h2>
            <p>
              You&apos;re signed in as <span className="mono">{user.email}</span> — this account
              doesn&apos;t have staff access. If you should have it, ask the owner to add your email
              to the staff list.
            </p>
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            <a className="btn ghost" href="/">
              ← Back to the shop
            </a>
            <form action={signOut}>
              <button className="btn danger" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {/* marcador p/ o CSS alargar o shell do painel em telas grandes */}
      <span className="admin-wide" hidden />
      <TopBar title="Vessel Ops" backHref="/" chip={false} />
      <AdminTabs />
      {children}
    </>
  );
}
