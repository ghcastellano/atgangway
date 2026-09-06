"use client";

import { usePathname } from "next/navigation";

export default function SkipToContent() {
  const path = usePathname();
  return (
    <button
      type="button"
      className="skip-link"
      onClick={() => {
        const main = document.querySelector("main");
        if (!main) return;
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: "start" });
      }}
    >
      {path === "/admin" || path.startsWith("/admin/") ? "Pular para o conteúdo" : "Skip to content"}
    </button>
  );
}
