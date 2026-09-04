"use client";

import { useRef, useState, useTransition } from "react";
import { entregar } from "@/app/admin/actions";
import type { Pedido } from "@/lib/painel";

/**
 * Entregar com foto-comprovante, tirada na escada.
 *
 * A foto encolhe no navegador antes de subir (3G de porto, 4 MB de
 * iPhone → ~250 KB a 1600 px). HEIC que o canvas não decodifica sobe
 * original — o bucket aceita.
 */
async function encolher(file: File, max = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900_000) return file;
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ? new File([blob], "comprovante.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function EntregaFoto({
  pedido,
  onDone,
  onErro,
}: {
  pedido: Pedido;
  onDone: (row: Pedido) => void;
  onErro: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const small = await encolher(raw);
    setFile(small);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(small);
    });
  }

  function confirmar() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", pedido.id);
      if (file) fd.set("photo", file, file.name);
      const r = await entregar(fd);
      if (r.ok) onDone(r.row);
      else onErro(r.error);
    });
  }

  return (
    <div className="adm-entrega">
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={escolher} hidden />
      {preview ? (
        <button type="button" className="adm-foto" onClick={() => input.current?.click()} aria-label="Trocar a foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Comprovante do pedido ${pedido.code}`} />
          <span>trocar</span>
        </button>
      ) : (
        <button type="button" className="adm-btn ghost" onClick={() => input.current?.click()} disabled={pending}>
          📷 Foto da entrega
        </button>
      )}
      <button type="button" className="adm-btn primario" onClick={confirmar} disabled={pending} aria-busy={pending}>
        {pending ? <span className="adm-spin" aria-hidden /> : null}
        {pending ? "Registrando…" : file ? "Entregue, com foto" : "Entregue"}
      </button>
    </div>
  );
}
