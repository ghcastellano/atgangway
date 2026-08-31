"use client";

import { useState } from "react";
import { bulkCatalogAction } from "@/app/admin/catalog/actions";

/**
 * Ações em massa.
 *
 * Duas travas deliberadas, porque apagar catálogo não tem desfazer:
 *
 * 1. Excluir exige digitar EXCLUIR. Confirmação por clique some da
 *    memória em dois segundos; digitar não.
 * 2. "Toda a categoria" só aparece quando existe uma categoria
 *    filtrada, e mostra quantos itens vai atingir. Ação em massa sem
 *    contagem visível é como se apaga o catálogo inteiro sem querer.
 */
export default function BulkBar({
  rows,
  categoryPath,
  categoryName,
  categoryTotal,
}: {
  rows: { id: string; name: string }[];
  categoryPath: string | null;
  categoryName: string | null;
  categoryTotal: number;
}) {
  const [confirm, setConfirm] = useState("");
  const [scope, setScope] = useState<"selected" | "category">("selected");
  const armed = confirm.trim().toUpperCase() === "EXCLUIR";

  return (
    <form id="bulkform" action={bulkCatalogAction} className="bulkbar">
      {categoryPath && (
        <input type="hidden" name="category_path" value={scope === "category" ? categoryPath : ""} />
      )}

      <div className="bulkrow">
        <button className="btn small ghost" name="action" value="activate" type="submit">
          Publicar
        </button>
        <button className="btn small ghost" name="action" value="deactivate" type="submit">
          Despublicar
        </button>
        <button className="btn small ghost" name="action" value="clear_badge" type="submit">
          Tirar selo
        </button>
      </div>

      {categoryPath && (
        <div className="bulkrow">
          <label className="checkline" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={scope === "category"}
              onChange={(e) => setScope(e.target.checked ? "category" : "selected")}
            />
            Aplicar a TODA a categoria {categoryName} ({categoryTotal} itens), não só ao que está marcado
          </label>
        </div>
      )}

      <div className="bulkrow danger-row">
        <input
          className="bulkconfirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="digite EXCLUIR para liberar"
          aria-label="Confirmação de exclusão"
        />
        <button className="btn small danger" name="action" value="delete" type="submit" disabled={!armed}>
          Excluir {scope === "category" ? `categoria (${categoryTotal})` : "marcados"}
        </button>
      </div>
      <p className="finehint" style={{ margin: "2px 16px 0" }}>
        {rows.length} nesta página. Exclusão remove produto, variantes e fotos — não tem desfazer.
      </p>
    </form>
  );
}
