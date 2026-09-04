"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "./Toast";

/** Um aviso vindo pela URL (?ok=…) vira toast e sai da URL. */
export default function Aviso({ texto }: { texto: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    toast(texto);
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, [texto, toast, router, path]);
  return null;
}
