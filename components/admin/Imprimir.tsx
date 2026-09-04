"use client";

/** A lista de compras vai ao mercado impressa ou na tela do celular. */
export default function Imprimir() {
  return (
    <button type="button" className="adm-btn ghost small" onClick={() => window.print()}>
      🖨 Imprimir
    </button>
  );
}
