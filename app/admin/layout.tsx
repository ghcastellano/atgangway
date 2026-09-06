import type { Metadata } from "next";
import "@/app/styles/45-painel.css";

export const metadata: Metadata = {
  title: "Painel da operação",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root" lang="pt-BR">{children}</div>;
}
