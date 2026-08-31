"use client";

import { useRef, useState, useTransition } from "react";
import { markDelivered } from "@/app/admin/actions";

/**
 * Foto da entrega tirada na prancha.
 *
 * Encolhe no navegador antes de subir: quem está no cais está em 3G
 * de porto, e uma foto de iPhone tem 4 MB. 1600px a 0,82 de qualidade
 * fica em ~250 KB, legível para provar entrega e rápida de mandar.
 * Se o navegador não souber decodificar (HEIC em Android, por
 * exemplo), sobe o original — o bucket aceita.
 */
async function shrink(file: File, max = 1600, quality = 0.82): Promise<File> {
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

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    );
    return blob ? new File([blob], "proof.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function DeliveryProof({ orderId, code }: { orderId: string; code: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const small = await shrink(raw);
    setFile(small);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(small);
    });
  }

  function submit() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", orderId);
      if (file) fd.set("photo", file, file.name);
      await markDelivered(fd);
    });
  }

  return (
    <div className="proof">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={pick}
        hidden
      />

      {preview ? (
        <button type="button" className="proof-thumb" onClick={() => input.current?.click()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Comprovante do pedido ${code}`} />
          <span>trocar</span>
        </button>
      ) : (
        <button type="button" className="btn small ghost" onClick={() => input.current?.click()}>
          📸 Foto da entrega
        </button>
      )}

      <button type="button" className="btn small" onClick={submit} disabled={pending}>
        {pending ? "Enviando…" : file ? "✓ Entregue com foto" : "✓ Entregue"}
      </button>
    </div>
  );
}
