"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string; group?: string };

/**
 * Select com busca, como o do cadastro do Sunny (Rank e Nationality).
 *
 * O <select> nativo continua sendo a melhor escolha para lista curta —
 * no celular vira a roda do sistema. Aqui a lista passa de cem itens
 * (nacionalidade) e sem digitar não se acha nada, então vale o custo
 * de um combobox próprio.
 *
 * Teclado é requisito, não enfeite: metade dos cadastros sai do desktop
 * do agente marítimo, onde tudo é Tab e seta.
 */

/** Sem acento e em minúscula — quem digita "turkiye" tem de achar "Türkiye". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const shown = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return options;
    return options.filter(
      (o) => fold(o.label).includes(needle) || fold(o.group ?? "").startsWith(needle)
    );
  }, [options, q]);

  useEffect(() => setActive(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Mantém a opção percorrida por seta visível dentro do painel rolável.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(o: SelectOption) {
    onChange(o.value);
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (shown.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + shown.length) % shown.length);
      return;
    }
    if (e.key === "Enter") {
      // Fechado, o Enter pertence ao formulário — não roubamos o submit.
      if (!open) return;
      e.preventDefault();
      const o = shown[active];
      if (o) pick(o);
      return;
    }
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setQ("");
      setOpen(false);
      return;
    }
    if (e.key === "Tab") setOpen(false);
  }

  return (
    <div className="field">
      <label htmlFor={`${uid}-in`}>
        {label}
        {required && (
          <span aria-hidden style={{ color: "var(--danger)" }}> *</span>
        )}
      </label>

      <div className="typeahead" ref={box}>
        <input
          id={`${uid}-in`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${uid}-o${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={open ? q : selected?.label ?? ""}
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
          <div className="ta-panel" id={`${uid}-list`} role="listbox" ref={panel}>
            {shown.length === 0 && <p className="ta-hint">No matches.</p>}
            {shown.map((o, i) => (
              <Fragment key={o.value}>
                {o.group && o.group !== shown[i - 1]?.group && (
                  <div className="ta-group">{o.group}</div>
                )}
                <button
                  type="button"
                  id={`${uid}-o${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="ta-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
                  {o.value === value && <span className="sub">✓</span>}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {hint && <p className="finehint">{hint}</p>}
    </div>
  );
}
