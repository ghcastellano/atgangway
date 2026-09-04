"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Tem certeza?" só para o que não volta com um clique: cancelar um
 * pedido, creditar um desvio, excluir catálogo. Tudo o que tem Desfazer
 * passa direto — confirmação em toda ação vira ruído que a mão aprende
 * a dispensar sem ler.
 *
 * <dialog> nativo: foco preso, Esc fecha, fundo bloqueado, sem
 * biblioteca. Devolve uma Promise para o chamador escrever
 * `if (!(await confirmar({...}))) return;` e seguir.
 */
export type Pergunta = {
  titulo: string;
  texto?: string;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
};

export function useConfirmar() {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<Pergunta | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((pergunta: Pergunta) => {
    setQ(pergunta);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (q && !d.open) d.showModal();
    if (!q && d.open) d.close();
  }, [q]);

  const fecha = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setQ(null);
  };

  const Dialogo = (
    <dialog
      ref={ref}
      className="adm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        fecha(false);
      }}
      onClick={(e) => {
        // clique no fundo escurecido fecha; dentro do cartão, não
        if (e.target === ref.current) fecha(false);
      }}
    >
      {q && (
        <div className="adm-dialog-card">
          <h2>{q.titulo}</h2>
          {q.texto && <p>{q.texto}</p>}
          <div className="adm-dialog-acoes">
            <button type="button" className="adm-btn ghost" onClick={() => fecha(false)} autoFocus>
              {q.cancelar ?? "Voltar"}
            </button>
            <button type="button" className={`adm-btn ${q.perigo ? "perigo" : "primario"}`} onClick={() => fecha(true)}>
              {q.confirmar ?? "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return { confirmar, Dialogo };
}
