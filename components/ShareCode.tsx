"use client";

import { useState } from "react";

export default function ShareCode({ code, link }: { code: string; link: string }) {
  const [label, setLabel] = useState("Share on WhatsApp");

  /* DUAS mensagens, e não uma, porque os dois caminhos de saída são
     diferentes.

     O Web Share tem campo próprio para o endereço: `text` é o corpo e
     `url` é o link canônico, e o WhatsApp CONCATENA os dois. Mandar uma
     frase que já termina no link mais o mesmo link em `url` fazia o
     endereço sair duas vezes seguidas na conversa — que é como um
     recado de tripulante para tripulante perde a credibilidade.

     Já o wa.me não tem campo separado: ali o link precisa estar dentro
     do texto, ou a mensagem chega sem ele. Daí a frase seca para um
     lado e a frase com link para o outro. */
  const frase =
    `Order from Vessel Supplier with my code ${code} — delivered at the gangway ` +
    `in Santos.`;
  const comLink = `${frase} ${link}`;

  async function share() {
    // Web Share abre o WhatsApp direto no celular; no desktop cai no copiar.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vessel Supplier", text: frase, url: link });
        return;
      } catch (e) {
        /* Desistir NÃO é falhar. O catch pegava os dois casos e seguia
           para o fallback, então quem fechava a folha de compartilhamento
           via "Copied! ✓" e um link no clipboard que não pediu. AbortError
           é o cancelamento; só o resto justifica tentar outro caminho. */
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(comLink);
      setLabel("Copied! ✓");
      setTimeout(() => setLabel("Share on WhatsApp"), 1800);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(comLink)}`, "_blank");
    }
  }

  return (
    <button className="share" onClick={share}>
      {label}
    </button>
  );
}
