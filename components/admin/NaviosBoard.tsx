"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { publicarNavio, salvarNavio } from "@/app/admin/actions";
import { SAILED_AFTER_HOURS, callState } from "@/lib/callstate";
import { etaToLocalInput } from "@/lib/format";
import { delayLabel, type Ship } from "@/lib/types";
import {
  PILHA_PT,
  PUBLISH_HORIZON_DAYS,
  deveriaTerPublicado,
  pilhaDaEscala,
  publicaEm,
  quando,
  relativo,
  type Pilha,
} from "@/lib/painel";
import { useToast } from "./Toast";

/**
 * Navios: cinco pilhas, com a régua única de lib/painel + lib/callstate.
 *
 *   publica sozinho — sincronizada, ETA além dos 14 dias; a rotação
 *                     publica de hora em hora quando entrar no horizonte
 *   vendendo        — publicada, janela aberta
 *   corte passado   — publicada, corte fechado; some da loja sozinha
 *   fora de cena    — zarpou (a rotação aposentou) ou entrou no line-up
 *                     tarde demais para vender
 *   escondidas      — a equipe escondeu; a rotação respeita
 *
 * Eram três, chamadas "fila de revisão / vendendo / corte passado", e a
 * primeira mentia: dizia "cai aqui para você publicar" quando a rotação
 * já publicava sozinha. As aposentadas não caíam em pilha nenhuma e
 * sumiam da tela em silêncio. O único contador vermelho é a anomalia
 * de verdade: escala que deveria estar publicada e não está — o cron
 * parou.
 *
 * Publicar/esconder é um toque, otimista, com o botão dizendo que
 * trabalha. Editar abre a escala num painel — o formulário só existe
 * para quem o abriu.
 */
const ORDEM: Pilha[] = ["vendendo", "espera", "fechadas", "fora", "escondidas"];

export default function NaviosBoard({ inicial }: { inicial: Ship[] }) {
  const { toast } = useToast();
  const [ships, setShips] = useState<Ship[]>(inicial);
  const [pilha, setPilha] = useState<Pilha>("vendendo");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Ship | null | "novo">(null);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  useEffect(() => setShips(inicial), [inicial]);

  const troca = (row: Ship) =>
    setShips((l) => (l.some((s) => s.id === row.id) ? l.map((s) => (s.id === row.id ? row : s)) : [...l, row]));
  const ocupa = (id: string, on: boolean) =>
    setOcupados((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function publicar(s: Ship, active: boolean) {
    const antes = s;
    troca({ ...s, active, hidden_at: active ? null : new Date().toISOString() });
    ocupa(s.id, true);
    start(async () => {
      const r = await publicarNavio(s.id, active);
      ocupa(s.id, false);
      if (!r.ok) {
        troca(antes);
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(r.row);
      toast(active ? `${s.name} publicado no line-up` : `${s.name} escondido — a rotação não republica`, {
        acao: { rotulo: "Desfazer", onClick: () => publicar(r.row, !active) },
      });
    });
  }

  const q = busca.trim().toLowerCase();
  const pilhas = useMemo(() => {
    const agora = new Date();
    const filtro = (s: Ship) => !q || s.name.toLowerCase().includes(q) || (s.berth ?? "").toLowerCase().includes(q);
    const out: Record<Pilha, Ship[]> = { espera: [], vendendo: [], fechadas: [], fora: [], escondidas: [] };
    for (const s of ships) if (filtro(s)) out[pilhaDaEscala(s, agora)].push(s);
    return out;
  }, [ships, q]);

  const naoPublicadas = ships.filter((s) => deveriaTerPublicado(s));
  const lista = pilhas[pilha];

  return (
    <div className="adm-page">
      <section className="adm-kpis" aria-label="Resumo do line-up">
        <div className="adm-kpi teal"><b>{pilhas.vendendo.length}</b><span>publicados e vendendo</span></div>
        <div className="adm-kpi"><b>{pilhas.espera.length}</b><span>publicam sozinhos (ETA &gt; {PUBLISH_HORIZON_DAYS} d)</span></div>
        <div className={`adm-kpi ${naoPublicadas.length ? "danger" : ""}`}>
          <b>{naoPublicadas.length}</b>
          <span>{naoPublicadas.length ? "o cron não publicou — confira o line-up" : "sem escala presa: o cron está em dia"}</span>
        </div>
        <div className="adm-kpi"><b>{ships.filter((s) => Number(s.delay_hours ?? 0) >= 2).length}</b><span>com atraso ≥ 2 h</span></div>
      </section>

      <div className="adm-toolbar">
        <div className="adm-chips" role="tablist" aria-label="Pilha">
          {ORDEM.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={pilha === k} className={pilha === k ? "on" : ""} onClick={() => setPilha(k)}>
              {PILHA_PT[k]} <small>{pilhas[k].length}</small>
            </button>
          ))}
        </div>
        <div className="adm-toolbar-right">
          <input className="adm-busca" type="search" placeholder="Buscar navio ou berço" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar navios" />
          <button type="button" className="adm-btn primario" onClick={() => setEditando("novo")}>+ Escala à mão</button>
        </div>
      </div>

      {lista.length === 0 && !q && <p className="adm-muted">{VAZIO[pilha]}</p>}

      {lista.length === 0 ? (
        <div className="adm-vazio"><b>{q ? "Nenhum navio com essa busca." : "Nada nesta pilha."}</b></div>
      ) : (
        <div className="adm-lista">
          {lista.map((s) => {
            const busy = ocupados.has(s.id);
            const atraso = delayLabel(s);
            return (
              <div key={s.id} className={`adm-linha ${s.active ? "" : "off"}`}>
                <div>
                  <div className="nm">
                    {s.name}
                    {atraso && <em className="adm-tag warn">{atraso.startsWith("DELAYED") ? `atraso ${atraso.slice(8)}` : `adiantado ${atraso.slice(6)}`}</em>}
                    {deveriaTerPublicado(s) && <em className="adm-tag warn">não publicada pelo cron</em>}
                  </div>
                  <div className="sub">{linha(s, pilha)}{s.berth ? ` · berço ${s.berth}` : ""}</div>
                </div>
                <div className="acoes">
                  <button type="button" className="adm-btn ghost small" onClick={() => setEditando(s)}>Editar</button>
                  {pilha !== "fora" && (
                    <>
                      {pilha === "espera" && (
                        <button type="button" className="adm-btn ghost small" disabled={busy} onClick={() => publicar(s, false)}>
                          Esconder
                        </button>
                      )}
                      <button
                        type="button"
                        className={`adm-btn small ${s.active ? "ghost" : "primario"}`}
                        disabled={busy}
                        aria-busy={busy}
                        onClick={() => publicar(s, !s.active)}
                      >
                        {busy ? <span className="adm-spin" aria-hidden /> : null}
                        {busy ? "…" : s.active ? "Esconder" : pilha === "espera" ? "Publicar agora" : "Publicar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <FormNavio
          ship={editando === "novo" ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={(row, novo) => {
            troca(row);
            setEditando(null);
            toast(novo ? `${row.name} cadastrado` : `${row.name} atualizado`);
          }}
        />
      )}
    </div>
  );
}

const VAZIO: Record<Pilha, string> = {
  espera: `Nada esperando. Escalas com ETA a mais de ${PUBLISH_HORIZON_DAYS} dias ficam aqui até a rotação publicar — de hora em hora, sozinha.`,
  vendendo: "Nenhuma escala vendendo agora. O line-up do porto sincroniza de hora em hora e publica sozinho o que estiver a menos de 14 dias.",
  fechadas: "Nenhuma escala com corte passado.",
  fora: "Nada fora de cena nos últimos 3 dias.",
  escondidas: "Nenhuma escala escondida pela equipe.",
};

/** A segunda linha de cada escala, dita do jeito da pilha em que ela está. */
function linha(s: Ship, pilha: Pilha): string {
  const eta = new Date(s.eta);
  const corte = new Date(eta.getTime() - s.cutoff_hours * 3600e3);
  const base = `ETA ${quando(eta)} (${relativo(eta)})`;
  switch (pilha) {
    case "espera":
      return `${base} · publica sozinho ${relativo(publicaEm(eta))}`;
    case "vendendo":
      return `${base} · corte ${quando(corte)} (${relativo(corte)})`;
    case "fechadas":
      return callState(s) === "sailed"
        ? `${base} · zarpou · sai da loja na próxima rotação`
        : `${base} · corte fechado ${relativo(corte)}`;
    case "fora": {
      const foi = new Date(new Date(s.ata ?? s.eta).getTime() + SAILED_AFTER_HOURS * 3600e3);
      return callState(s) === "sailed"
        ? `${base} · fora de cena ${relativo(foi)}`
        : `${base} · corte ${quando(corte)} passou sem publicar`;
    }
    case "escondidas":
      return `${base} · escondida ${relativo(s.hidden_at)}`;
  }
}

function FormNavio({ ship, onClose, onSaved }: { ship: Ship | null; onClose: () => void; onSaved: (row: Ship, novo: boolean) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErro(null);
    start(async () => {
      const r = await salvarNavio(fd);
      if (!r.ok) setErro(r.error);
      else onSaved(r.row, !ship);
    });
  }

  return (
    <>
      <button className="adm-veu" aria-label="Fechar" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="nav-titulo">
        <header className="adm-drawer-head">
          <div>
            <p className="kicker">Escala</p>
            <h2 id="nav-titulo">{ship ? ship.name : "Nova escala"}</h2>
          </div>
          <button type="button" className="adm-iconbtn" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <form className="adm-drawer-body adm-form" onSubmit={submit} style={{ paddingTop: 16 }}>
          {ship && <input type="hidden" name="id" value={ship.id} />}
          {erro && <p className="adm-alerta erro" role="alert">{erro}</p>}
          <label className="adm-field">
            <span>Nome do navio</span>
            <input name="name" required defaultValue={ship?.name ?? ""} placeholder="MSC LORENA" autoFocus={!ship} />
          </label>
          <div className="grid2">
            <label className="adm-field">
              <span>Berço</span>
              <input name="berth" defaultValue={ship?.berth ?? ""} placeholder="39" />
            </label>
            <label className="adm-field">
              <span>Corte (horas antes do ETA)</span>
              <input name="cutoff_hours" type="number" min={1} max={240} defaultValue={ship?.cutoff_hours ?? 72} />
            </label>
          </div>
          <label className="adm-field">
            <span>ETA — hora de Santos</span>
            <input name="eta" type="datetime-local" required defaultValue={ship ? etaToLocalInput(ship.eta) : ""} />
          </label>
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={ship ? ship.active : true} />
            Visível no line-up da loja
          </label>
          <p className="adm-muted">
            72 h de corte = a tripulação pode pedir até 3 dias antes de atracar. Escala com corte passado some da loja sozinha.
            Desmarcar &ldquo;visível&rdquo; esconde a escala, e a rotação automática não a republica.
          </p>
          <div className="adm-form-acoes">
            <button type="submit" className="adm-btn primario" disabled={pending} aria-busy={pending}>
              {pending ? <span className="adm-spin" aria-hidden /> : null}
              {pending ? "Salvando…" : ship ? "Salvar alterações" : "Cadastrar escala"}
            </button>
            <button type="button" className="adm-btn ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </aside>
    </>
  );
}
