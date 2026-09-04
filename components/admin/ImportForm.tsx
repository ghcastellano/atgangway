"use client";

import { useActionState, useState } from "react";
import { runCatalogImport, type ImportReport } from "@/app/admin/catalog/actions";
import { usd } from "@/lib/money";

/**
 * Importação em dois tempos: ensaio e aplicação.
 *
 * O ensaio roda exatamente o mesmo código da aplicação — só não grava.
 * Isso importa: "prévia" que usa outro caminho mente na hora errada,
 * que é quando você confia nela para apertar o botão.
 */
export default function ImportForm() {
  const [report, action, pending] = useActionState<ImportReport | null, FormData>(
    runCatalogImport,
    null
  );
  const [file, setFile] = useState<string>("");

  return (
    <>
      <form action={action} className="adm-form">
        <div className="adm-field">
          <label htmlFor="file">Arquivo CSV</label>
          <input
            id="file"
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            required
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
          />
          {file && <p className="adm-muted">{file}</p>}
        </div>

        <div className="adm-form-acoes">
          <button className="adm-btn ghost" type="submit" name="apply" value="0" disabled={pending}>
            {pending ? "Lendo…" : "Ensaiar (não grava)"}
          </button>
          <button className="adm-btn primario" type="submit" name="apply" value="1" disabled={pending}>
            {pending ? "Gravando…" : "Aplicar"}
          </button>
        </div>
      </form>

      {report && (
        <div className="impreport">
          {report.message && (
            <p className={report.ok ? "note" : "alert"}>{report.message}</p>
          )}

          {report.totals && (
            <>
              <p className="finehint" style={{ margin: 0 }}>
                {report.applied ? "Aplicado:" : "Ensaio — nada foi gravado:"}
              </p>
              <div className="impgrid">
                <div><b style={{ color: "var(--teal)" }}>{report.totals.create}</b><span>criar</span></div>
                <div><b style={{ color: "var(--amber)" }}>{report.totals.update}</b><span>atualizar</span></div>
                <div><b>{report.totals.unchanged}</b><span>iguais</span></div>
                <div><b style={{ color: report.totals.invalid ? "var(--danger)" : undefined }}>
                  {report.totals.invalid}</b><span>inválidas</span></div>
              </div>
            </>
          )}

          {report.duplicates && report.duplicates.length > 0 && (
            <p className="alert">
              SKU repetido no arquivo (o último venceu): {report.duplicates.slice(0, 10).join(", ")}
              {report.duplicates.length > 10 ? ` e mais ${report.duplicates.length - 10}` : ""}
            </p>
          )}

          {report.sample && report.sample.length > 0 && (
            <ul className="impissues">
              {report.sample.map((s, i) => (
                <li key={i}>
                  <b>{s.kind === "create" ? "novo" : "muda"}</b> {s.sku} — {s.name} · {usd(s.price)}
                </li>
              ))}
            </ul>
          )}

          {report.issues && report.issues.length > 0 && (
            <>
              <p className="finehint" style={{ margin: 0 }}>Avisos por linha:</p>
              <ul className="impissues">
                {report.issues.map((it, i) => (
                  <li key={i}>
                    <b>linha {it.line}</b> · {it.field}: {it.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
