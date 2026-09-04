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
    <form id="bulkform" action={bulkCatalogAction} className="adm-card adm-form bulkbar">
      {categoryPath && (
        <input type="hidden" name="category_path" value={scope === "category" ? categoryPath : ""} />
      )}

      <div className="adm-form-acoes">
        <button className="adm-btn ghost small" name="action" value="activate" type="submit">
          Publicar
        </button>
        <button className="adm-btn ghost small" name="action" value="deactivate" type="submit">
          Despublicar
        </button>
        <button className="adm-btn ghost small" name="action" value="clear_badge" type="submit">
          Tirar selo
        </button>
      </div>

      {categoryPath && (
        <div className="adm-form-acoes">
          <label className="check">
            <input
              type="checkbox"
              checked={scope === "category"}
              onChange={(e) => setScope(e.target.checked ? "category" : "selected")}
            />
            Aplicar a TODA a categoria {categoryName} ({categoryTotal} itens), não só aos marcados
          </label>
        </div>
      )}

      <div className="adm-form-acoes">
        <input
          className="adm-busca" style={{ maxWidth: 260 }}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="digite EXCLUIR para liberar"
          aria-label="Confirmação de exclusão"
        />
        <button className="adm-btn perigo small" name="action" value="delete" type="submit" disabled={!armed}>
          Excluir {scope === "category" ? `categoria (${categoryTotal})` : "marcados"}
        </button>
      </div>
      <p className="adm-muted" style={{ margin: 0 }}>
        {rows.length} nesta página. Exclusão remove produto, variantes e fotos — não tem desfazer.
      </p>
    </form>
  );
}
