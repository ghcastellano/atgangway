"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { imoChecksumOk, normalizeImo } from "@/lib/imo";
import { callState } from "@/lib/callstate";

export type VesselValue = {
  /** null enquanto o navio ainda não existe no banco (ver createVessel). */
  id: string | null;
  name: string;
  imo: string | null;
  flag: string | null;
};

type VesselRow = {
  id: string;
  name: string;
  imo: string | null;
  flag: string | null;
  image_path: string | null;
  verified: boolean;
  /** ETA da escala — ver `rotulo` abaixo. */
  eta: string | null;
  ata?: string | null;
  cutoff_hours?: number | null;
};

/**
 * O que escrever ao lado do nome na lista.
 *
 * Era `IMO ${imo}` ou, na falta dele, o literal "no IMO" — e como a
 * fonte do line-up do porto publica nome, ETA e berço mas NÃO o IMO,
 * as 253 escalas do banco estão sem ele. Ou seja: "no IMO" aparecia em
 * 100% das linhas. Rótulo que nunca varia não desambigua nada; só
 * parece defeito para quem está escolhendo o próprio navio.
 *
 * O que separa duas linhas para quem está a bordo é a data de atracação.
 * O IMO continua aparecendo quando existe — aí ele é a identidade do
 * casco e vale mais que a data.
 */
function rotulo(r: VesselRow): string {
  if (r.imo) return `IMO ${r.imo}${r.flag ? ` · ${r.flag}` : ""}`;
  if (!r.eta) return r.flag ?? "";
  const d = new Date(r.eta);
  const quando = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  // A RPC só devolve escala com janela aberta (mesma régua do banco);
  // "closing" é a mesma máquina de estados do painel do navio.
  const fase = callState({ eta: r.eta, ata: r.ata, cutoff_hours: r.cutoff_hours });
  return `due ${quando}${fase === "closing" ? " · last call" : ""}${r.flag ? ` · ${r.flag}` : ""}`;
}

/** A RPC só busca a partir de 3 caracteres — repetimos aqui para não bater à toa. */
const MIN_QUERY = 3;
/** ~300ms: o tempo entre teclas de quem digita nome de navio, sem passar por lento. */
const DEBOUNCE_MS = 300;

/**
 * Cria o navio de verdade. Fica fora do componente porque o cadastro
 * precisa chamá-la DEPOIS do signup: create_vessel exige auth.uid(),
 * e no formulário de cadastro ainda não existe sessão.
 */
export async function createVessel(v: VesselValue): Promise<string> {
  const { data, error } = await createClient().rpc("create_vessel", {
    p_name: v.name,
    p_imo: v.imo ?? undefined,
    p_flag: v.flag ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Busca de navio no padrão do Sunny: o campo é um typeahead que abre
 * com "+ Create a new Vessel" no topo e a dica dos 3 caracteres.
 *
 * O "criar" existe porque a frota do mundo não cabe em cadastro curado
 * — quem está a bordo de um navio que ainda não vimos precisa comprar
 * hoje, não depois que alguém do escritório cadastrar o casco.
 *
 * `deferCreate` é a diferença entre cadastro e perfil: no cadastro o
 * navio novo fica só como texto e nasce depois, quando há sessão.
 */
export default function VesselSearch({
  value,
  onChange,
  deferCreate = false,
  required,
}: {
  value: VesselValue | null;
  onChange: (v: VesselValue | null) => void;
  deferCreate?: boolean;
  required?: boolean;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<VesselRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImo, setNewImo] = useState("");
  const [busy, setBusy] = useState(false);

  // Acrescentar IMO a um navio que o line-up trouxe sem ele. Quem sabe o
  // número é quem está a bordo — está pintado no casco. A escrita é
  // estreita de propósito (a RPC só preenche nulo, nunca sobrescreve),
  // então oferecer isso a qualquer tripulante é seguro.
  const [imoOpen, setImoOpen] = useState(false);
  const [imoDraft, setImoDraft] = useState("");
  const [imoBusy, setImoBusy] = useState(false);

  async function claimImo() {
    if (!value?.id) return;
    const imo = normalizeImo(imoDraft);
    if (!imo || !imoChecksumOk(imo)) {
      setErr("That IMO fails its check digit — copy the 7 digits from the hull.");
      return;
    }
    setErr(null);
    setImoBusy(true);
    try {
      const { data, error } = await createClient().rpc("claim_vessel_imo", {
        p_ship: value.id,
        p_imo: imo,
      });
      const r = data as { ok: boolean; reason?: string; ship?: string; imo?: string } | null;
      if (error || !r) {
        setErr("Couldn't save the IMO — try again.");
      } else if (r.ok) {
        onChange({ ...value, imo: r.imo ?? imo });
        setImoOpen(false);
        setImoDraft("");
      } else if (r.reason === "imo_taken") {
        // O cenário que o IMO existe para pegar: o número pertence a
        // OUTRO casco — provavelmente a pessoa escolheu o navio errado.
        setErr(`IMO ${imo} belongs to ${r.ship} — if that's your vessel, pick it from the list instead.`);
      } else if (r.reason === "already_set") {
        onChange({ ...value, imo: r.imo ?? null });
        setImoOpen(false);
      } else {
        setErr("That IMO fails its check digit — copy the 7 digits from the hull.");
      }
    } finally {
      setImoBusy(false);
    }
  }

  const short = q.trim().length < MIN_QUERY;

  useEffect(() => {
    if (short) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await createClient()
        .rpc("search_vessels", { p_query: q.trim() })
        .abortSignal(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setLoading(false);
      if (error) {
        setErr("Vessel search is down — you can still create your vessel.");
        return;
      }
      setErr(null);
      setRows((data ?? []) as VesselRow[]);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, short]);

  useEffect(() => setActive(0), [rows, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(r: VesselRow) {
    onChange({ id: r.id, name: r.name, imo: r.imo, flag: r.flag });
    setQ("");
    setCreating(false);
    setOpen(false);
  }

  function startCreate() {
    // O que a pessoa já digitou vira o nome — ela não redigita.
    setNewName(q.trim());
    setNewImo("");
    setErr(null);
    setCreating(true);
    setOpen(false);
  }

  async function confirmCreate() {
    const name = newName.trim();
    const imo = normalizeImo(newImo);
    // Mesma regra da RPC: erro de servidor por nome curto é erro que dá
    // para evitar antes de gastar a viagem.
    if (name.length < 3) {
      setErr("Vessel name needs at least 3 characters.");
      return;
    }
    // O IMO tem dígito verificador; um algarismo trocado quase sempre
    // quebra a soma. Barrar aqui, com o campo na tela, é o que separa
    // "corrige e segue" de descobrir o número errado na prancha.
    if (imo && !imoChecksumOk(imo)) {
      setErr("That IMO fails its check digit — copy the 7 digits from the hull, or leave it blank.");
      return;
    }
    const draft: VesselValue = { id: null, name: name.toUpperCase(), imo, flag: null };
    setErr(null);

    if (deferCreate) {
      onChange(draft);
      setCreating(false);
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      const id = await createVessel(draft);
      onChange({ ...draft, id });
      setCreating(false);
      setOpen(false);
    } catch {
      setErr("Couldn't create the vessel — check the name and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      // índice 0 é sempre "+ Create a new Vessel"
      const total = rows.length + 1;
      setActive((i) => (i + step + total) % total);
      return;
    }
    if (e.key === "Enter") {
      if (!open) return; // fechado, o Enter é do formulário
      e.preventDefault();
      if (active === 0) startCreate();
      else {
        const r = rows[active - 1];
        if (r) pick(r);
      }
      return;
    }
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setCreating(false);
      setOpen(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={`${uid}-in`}>
        Your vessel
        {required && <span aria-hidden style={{ color: "var(--danger)" }}> *</span>}
      </label>

      <div className="typeahead" ref={box}>
        <input
          id={`${uid}-in`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Enter your imo or Vessel name to search"
          value={open ? q : value?.name ?? ""}
          onFocus={() => {
            setQ("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />

        {open && (
          <div className="ta-panel" id={`${uid}-list`} role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={active === 0}
              className="ta-opt create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={startCreate}
            >
              + Create a new Vessel
            </button>

            {short ? (
              <p className="ta-hint">Type 3 or more characters to search for vessels</p>
            ) : loading ? (
              <p className="ta-hint">Searching…</p>
            ) : rows.length === 0 ? (
              <p className="ta-hint">No vessel with an open order window — create it above.</p>
            ) : (
              rows.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={active === i + 1}
                  className="ta-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{r.name}</span>
                  <span className="sub">{rotulo(r)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Os dois campos ficam abaixo do campo de busca, não dentro do
          painel: uma listbox com formulário no meio não é navegável por
          leitor de tela, e no celular o painel cobriria o teclado. */}
      {creating && (
        <>
          <div className="field">
            <label htmlFor={`${uid}-nm`}>
              Vessel name
              <span aria-hidden style={{ color: "var(--danger)" }}> *</span>
            </label>
            <input
              id={`${uid}-nm`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="MV Ocean Trader"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-imo`}>IMO (optional)</label>
            <input
              id={`${uid}-imo`}
              inputMode="numeric"
              value={newImo}
              onChange={(e) => setNewImo(e.target.value)}
              placeholder="9123456"
              autoComplete="off"
            />
          </div>
          <div className="actions">
            <button type="button" className="btn small" onClick={confirmCreate} disabled={busy}>
              {busy ? "Adding…" : "Add vessel"}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setCreating(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {err && <p className="finehint" style={{ color: "var(--danger)" }}>{err}</p>}
      {value && !err && (
        <p className="finehint">
          {value.id ? (
            value.imo ? (
              `IMO ${value.imo}${value.flag ? ` · ${value.flag}` : ""}`
            ) : imoOpen ? null : (
              <>
                No IMO on file{value.flag ? ` · ${value.flag}` : ""} ·{" "}
                {/* Botão-texto, não campo aberto: a maioria não sabe o
                    número de cor, e um campo vazio permanente viraria
                    cobrança. Quem sabe, clica. */}
                <button
                  type="button"
                  className="alink"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    setImoDraft("");
                    setImoOpen(true);
                  }}
                >
                  add it
                </button>
              </>
            )
          ) : (
            "New vessel — we'll add it to the fleet when your account is created."
          )}
        </p>
      )}
      {value?.id && !value.imo && imoOpen && !err && (
        <div className="vs-create" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="field"
            style={{ maxWidth: 160 }}
            inputMode="numeric"
            maxLength={7}
            placeholder="IMO — 7 digits"
            value={imoDraft}
            onChange={(e) => setImoDraft(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                claimImo();
              }
            }}
            aria-label="IMO number"
            autoFocus
          />
          <button type="button" className="btn small" onClick={claimImo} disabled={imoBusy || imoDraft.length < 7}>
            {imoBusy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setImoOpen(false);
              setImoDraft("");
            }}
            disabled={imoBusy}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
