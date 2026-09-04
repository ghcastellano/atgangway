"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { marcarNotificacoesLidas } from "@/app/admin/notificacoes";
import { relativo } from "@/lib/painel";

/**
 * O sino: atrasos de navio e outros avisos da operação.
 *
 * A contagem é o que aparece; a lista abre no toque. Marcar como lido
 * é otimista — a bolinha some na hora, a action confirma depois.
 */
export type Notificacao = {
  id: string;
  kind: string;
  severity: "info" | "warn" | "danger";
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

export default function Sino({ inicial }: { inicial: Notificacao[] }) {
  const [lista, setLista] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const naoLidas = lista.filter((n) => !n.read_at).length;

  useEffect(() => setLista(inicial), [inicial]);

  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAberto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  function lerTodas() {
    const ids = lista.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    const agora = new Date().toISOString();
    setLista((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: agora })));
    start(async () => {
      await marcarNotificacoesLidas(ids);
    });
  }

  return (
    <div className="adm-sino" ref={box}>
      <button
        type="button"
        className="adm-iconbtn"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {naoLidas > 0 && <span className="adm-badge">{naoLidas}</span>}
      </button>

      {aberto && (
        <div className="adm-pop adm-notifs" role="dialog" aria-label="Notificações">
          <div className="adm-pop-head">
            <b>Notificações</b>
            {naoLidas > 0 && (
              <button type="button" className="adm-link" onClick={lerTodas}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {lista.length === 0 ? (
            <p className="adm-vazio-mini">Nenhum aviso. O line-up sincroniza de hora em hora.</p>
          ) : (
            <ul>
              {lista.map((n) => (
                <li key={n.id} className={`${n.severity} ${n.read_at ? "" : "nova"}`}>
                  <i aria-hidden />
                  <div>
                    <b>{n.title}</b>
                    {n.body && <p>{n.body}</p>}
                    <time dateTime={n.created_at}>{relativo(n.created_at)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
