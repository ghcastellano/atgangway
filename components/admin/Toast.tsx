"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Aviso curto no canto: "Pedido #AG-1042 → Depósito recebido".
 *
 * É o retorno que faltava em cada ação do painel. O botão já mostra o
 * spinner enquanto a ação viaja; o toast fecha o ciclo dizendo que deu
 * certo (ou não) — e carrega o Desfazer, que é o seguro contra o clique
 * errado sem exigir um "tem certeza?" em toda ação.
 */
type Toast = {
  id: number;
  texto: string;
  tom: "ok" | "erro" | "info";
  acao?: { rotulo: string; onClick: () => void };
};

type Ctx = {
  toast: (texto: string, opts?: { tom?: Toast["tom"]; acao?: Toast["acao"]; ms?: number }) => void;
  setToastHost: (host: HTMLDivElement | null) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const [toastHost, setToastHost] = useState<HTMLDivElement | null>(null);
  const seq = useRef(0);

  const toast = useCallback<Ctx["toast"]>((texto, opts) => {
    const id = ++seq.current;
    const t: Toast = { id, texto, tom: opts?.tom ?? "ok", acao: opts?.acao };
    setLista((l) => [...l.slice(-2), t]);
    const ms = opts?.ms ?? (opts?.acao ? 7000 : 4000);
    setTimeout(() => setLista((l) => l.filter((x) => x.id !== id)), ms);
  }, []);

  const value = useMemo(() => ({ toast, setToastHost }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastHost ? createPortal(renderToasts(), toastHost) : renderToasts()}
    </ToastContext.Provider>
  );

  function renderToasts() {
    return <div className="adm-toasts" role="status" aria-live="polite" aria-atomic="false">
        {lista.map((t) => (
          <div key={t.id} className={`adm-toast ${t.tom}`}>
            <span>{t.texto}</span>
            {t.acao && (
              <button
                type="button"
                onClick={() => {
                  t.acao?.onClick();
                  setLista((l) => l.filter((x) => x.id !== t.id));
                }}
              >
                {t.acao.rotulo}
              </button>
            )}
          </div>
        ))}
      </div>;
  }
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa do <ToastProvider>");
  return ctx;
}
