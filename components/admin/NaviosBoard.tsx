"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publicarNavio, salvarNavio } from "@/app/admin/actions";
import { callState, canOrder } from "@/lib/callstate";
import { etaToLocalInput } from "@/lib/format";
import { delayLabel, type Ship } from "@/lib/types";
import { quando, relativo } from "@/lib/painel";
import { useToast } from "./Toast";
import AdminDrawer from "./AdminDrawer";

/**
 * Navios: três pilhas com a mesma régua do checkout e da rotação no
 * banco (lib/callstate) — fila de revisão (sincronizado, ainda não
 * publicado), publicados e vendendo, publicados com janela fechada.
 *
 * Publicar/esconder é um toque, otimista, com o botão dizendo que
 * trabalha. Editar abre a escala num painel — o formulário só existe
 * para quem o abriu (a versão antiga desenhava 120 formulários).
 */
type Pilha = "fila" | "vendendo" | "fechadas";

const aberta = (s: Ship) => canOrder(callState({ eta: s.eta, ata: s.ata, cutoff_hours: s.cutoff_hours }));

export default function NaviosBoard({ inicial }: { inicial: Ship[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ships, setShips] = useState<Ship[]>(inicial);
  const [pilha, setPilha] = useState<Pilha>("fila");
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
    troca({ ...s, active });
    ocupa(s.id, true);
    start(async () => {
      try {
        const r = await publicarNavio(s.id, active);
        if (!r.ok) {
          troca(antes);
          toast(r.error, { tom: "erro" });
          return;
        }
        troca(r.row);
        toast(active ? `${s.name} publicado no line-up` : `${s.name} escondido`, {
          acao: { rotulo: "Desfazer", onClick: () => publicar(r.row, !active) },
        });
      } catch {
        troca(antes);
        toast("Não foi possível confirmar a alteração. Recarregue o line-up antes de repetir.", { tom: "erro", ms: 8000 });
        router.refresh();
      } finally {
        ocupa(s.id, false);
      }
    });
  }

  const q = busca.trim().toLowerCase();
  const pilhas = useMemo(() => {
    const filtro = (s: Ship) => !q || s.name.toLowerCase().includes(q) || (s.berth ?? "").toLowerCase().includes(q);
    return {
      fila: ships.filter((s) => !s.active && aberta(s) && filtro(s)),
      vendendo: ships.filter((s) => s.active && aberta(s) && filtro(s)),
      fechadas: ships.filter((s) => s.active && !aberta(s) && filtro(s)),
    };
  }, [ships, q]);

  const lista = pilhas[pilha];

  return (
    <div className="adm-page">
      <section className="adm-kpis" aria-label="Resumo do line-up">
        <div className={`adm-kpi ${pilhas.fila.length ? "amber" : ""}`}><b>{pilhas.fila.length}</b><span>na fila de revisão</span></div>
        <div className="adm-kpi teal"><b>{pilhas.vendendo.length}</b><span>publicados e vendendo</span></div>
        <div className="adm-kpi"><b>{pilhas.fechadas.length}</b><span>publicados com corte passado</span></div>
        <div className="adm-kpi"><b>{ships.filter((s) => Number(s.delay_hours ?? 0) >= 2).length}</b><span>com atraso ≥ 2 h</span></div>
      </section>

      <div className="adm-toolbar">
        <div className="adm-chips" role="group" aria-label="Pilha">
          {([["fila", "Fila de revisão"], ["vendendo", "Vendendo"], ["fechadas", "Corte passado"]] as [Pilha, string][]).map(([k, r]) => (
            <button key={k} type="button" aria-pressed={pilha === k} className={pilha === k ? "on" : ""} onClick={() => setPilha(k)}>
              {r} <small>{pilhas[k].length}</small>
            </button>
          ))}
        </div>
        <div className="adm-toolbar-right">
          <input className="adm-busca" type="search" placeholder="Buscar navio ou berço" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar navios" />
          <button type="button" className="adm-btn primario" onClick={() => setEditando("novo")}>+ Escala à mão</button>
        </div>
      </div>

      {pilha === "fila" && lista.length === 0 && !q && (
        <p className="adm-muted">Nada aguardando com janela aberta. O line-up do porto sincroniza de hora em hora e cai aqui para você publicar.</p>
      )}

      {lista.length === 0 ? (
        <div className="adm-vazio"><b>{q ? "Nenhum navio com essa busca." : "Nada nesta pilha."}</b></div>
      ) : (
        <div className="adm-lista">
          {lista.map((s) => {
            const busy = ocupados.has(s.id);
            const atraso = delayLabel(s);
            const corte = new Date(new Date(s.eta).getTime() - s.cutoff_hours * 3600e3);
            return (
              <div key={s.id} className={`adm-linha ${s.active ? "" : "off"}`}>
                <div>
                  <div className="nm">
                    {s.name}
                    {atraso && <em className="adm-tag warn">{atraso.startsWith("DELAYED") ? `atraso ${atraso.slice(8)}` : `adiantado ${atraso.slice(6)}`}</em>}
                  </div>
                  <div className="sub">
                    ETA {quando(s.eta)} ({relativo(s.eta)}) · corte {quando(corte)} {aberta(s) ? `(${relativo(corte)})` : "— fechado"}
                    {s.berth ? ` · berço ${s.berth}` : ""}
                  </div>
                </div>
                <div className="acoes">
                  <button type="button" className="adm-btn ghost small" onClick={() => setEditando(s)}>Editar</button>
                  <button
                    type="button"
                    className={`adm-btn small ${s.active ? "ghost" : "primario"}`}
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => publicar(s, !s.active)}
                  >
                    {busy ? <span className="adm-spin" aria-hidden /> : null}
                    {busy ? "…" : s.active ? "Esconder" : "Publicar"}
                  </button>
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

function FormNavio({ ship, onClose, onSaved }: { ship: Ship | null; onClose: () => void; onSaved: (row: Ship, novo: boolean) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();


  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErro(null);
    start(async () => {
      try {
        const r = await salvarNavio(fd);
        if (!r.ok) setErro(r.error);
        else onSaved(r.row, !ship);
      } catch {
        setErro("Não foi possível confirmar o salvamento. Confira o line-up antes de repetir para evitar uma escala duplicada.");
      }
    });
  }

  return (
    <AdminDrawer labelledBy="nav-titulo" onClose={onClose}>
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
          <p className="adm-muted">72 h de corte = a tripulação pode pedir até 3 dias antes de atracar. Escala com corte passado some da loja sozinha.</p>
          <div className="adm-form-acoes">
            <button type="submit" className="adm-btn primario" disabled={pending} aria-busy={pending}>
              {pending ? <span className="adm-spin" aria-hidden /> : null}
              {pending ? "Salvando…" : ship ? "Salvar alterações" : "Cadastrar escala"}
            </button>
            <button type="button" className="adm-btn ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
    </AdminDrawer>
  );
}
