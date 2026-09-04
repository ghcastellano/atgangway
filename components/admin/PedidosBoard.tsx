"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { desfazerStatus, mudarStatus } from "@/app/admin/actions";
import type { OrderStatus } from "@/lib/types";
import { delayLabel } from "@/lib/types";
import {
  ABERTOS,
  PROXIMO,
  STATUS_PT,
  STATUS_TOM,
  brlUsd,
  cents,
  dia,
  quando,
  relativo,
  type Pedido,
} from "@/lib/painel";
import { useToast } from "./Toast";
import { useConfirmar } from "./Confirmar";
import EntregaFoto from "./EntregaFoto";

/**
 * O board de pedidos.
 *
 * Uma tabela (cartões no celular), um painel de detalhe e ações que
 * ADMITEM que foram clicadas: o status muda na hora (otimista), o botão
 * mostra que está trabalhando, a action confirma com a linha real e um
 * aviso curto diz o que aconteceu — com Desfazer. Cancelar e creditar,
 * que não voltam com um clique, pedem confirmação antes.
 */
type Filtro = "abertos" | "awaiting_deposit" | "preparing" | "at_gangway" | "encerrados";

const FILTROS: { k: Filtro; rotulo: string; teste: (p: Pedido) => boolean }[] = [
  { k: "abertos", rotulo: "Abertos", teste: (p) => ABERTOS.includes(p.status) },
  { k: "awaiting_deposit", rotulo: "Aguardando depósito", teste: (p) => p.status === "awaiting_deposit" },
  { k: "preparing", rotulo: "Em separação", teste: (p) => p.status === "deposit_paid" || p.status === "preparing" },
  { k: "at_gangway", rotulo: "Na escada", teste: (p) => p.status === "at_gangway" },
  { k: "encerrados", rotulo: "Encerrados", teste: (p) => !ABERTOS.includes(p.status) },
];

const totalItens = (p: Pedido) => p.order_items.reduce((s, i) => s + i.qty, 0);
const subtotal = (p: Pedido) => cents(p.subtotal_cents, p.subtotal_usd);
const deposito = (p: Pedido) => cents(p.deposit_cents, p.deposit_usd);
const saldo = (p: Pedido) => cents(p.balance_cents, p.balance_usd);
const whats = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;

export default function PedidosBoard({ inicial }: { inicial: Pedido[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirmar, Dialogo } = useConfirmar();
  const [pedidos, setPedidos] = useState<Pedido[]>(inicial);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const [refrescando, startRefresh] = useTransition();

  // O servidor mandou dados novos (router.refresh, navegação de volta):
  // eles vencem o que a tela acumulou.
  useEffect(() => setPedidos(inicial), [inicial]);

  const troca = (row: Pedido) => setPedidos((l) => l.map((p) => (p.id === row.id ? row : p)));
  const ocupa = (id: string, on: boolean) =>
    setOcupados((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  /** Muda o status — otimista, com desfazer no aviso. */
  function agir(p: Pedido, to: OrderStatus) {
    const antes = p;
    troca({ ...p, status: to, previous_status: p.status, status_changed_at: new Date().toISOString() });
    ocupa(p.id, true);
    start(async () => {
      const r = await mudarStatus(p.id, to);
      ocupa(p.id, false);
      if (!r.ok) {
        troca(antes);
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(r.row);
      toast(`#${p.code} → ${STATUS_PT[to]}`, {
        acao: { rotulo: "Desfazer", onClick: () => desfazer(r.row) },
      });
    });
  }

  function desfazer(p: Pedido) {
    if (!p.previous_status) return;
    const antes = p;
    troca({ ...p, status: p.previous_status, previous_status: null });
    ocupa(p.id, true);
    start(async () => {
      const r = await desfazerStatus(p.id);
      ocupa(p.id, false);
      if (!r.ok) {
        troca(antes);
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(r.row);
      toast(`#${p.code} voltou para ${STATUS_PT[r.row.status]}`, { tom: "info" });
    });
  }

  async function cancelar(p: Pedido) {
    const ok = await confirmar({
      titulo: `Cancelar o pedido #${p.code}?`,
      texto: p.status === "awaiting_deposit"
        ? "O cliente ainda não pagou; nada precisa ser devolvido."
        : `O depósito de ${brlUsd(deposito(p))} já foi pago. Cancelar aqui NÃO estorna no Stripe — faça o estorno lá.`,
      confirmar: "Cancelar pedido",
      cancelar: "Voltar",
      perigo: true,
    });
    if (ok) agir(p, "cancelled");
  }

  async function creditar(p: Pedido) {
    const ok = await confirmar({
      titulo: `Creditar o depósito de #${p.code}?`,
      texto: `O navio desviou e a entrega não acontece. ${brlUsd(deposito(p))} viram crédito na conta do cliente para a próxima escala.`,
      confirmar: "Creditar",
      cancelar: "Voltar",
    });
    if (ok) agir(p, "credited");
  }

  const q = busca.trim().toLowerCase();
  const filtroAtual = FILTROS.find((f) => f.k === filtro)!;
  const lista = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          filtroAtual.teste(p) &&
          (!q ||
            p.code.toLowerCase().includes(q) ||
            (p.ships?.name ?? p.vessel_name ?? "").toLowerCase().includes(q) ||
            (p.contact_name ?? "").toLowerCase().includes(q) ||
            p.order_items.some((i) => i.name.toLowerCase().includes(q)))
      ),
    [pedidos, filtroAtual, q]
  );

  const abertos = pedidos.filter((p) => ABERTOS.includes(p.status));
  const kpi = {
    abertos: abertos.length,
    aguardando: abertos.filter((p) => p.status === "awaiting_deposit").length,
    emCaixa: abertos.filter((p) => p.status !== "awaiting_deposit").reduce((s, p) => s + deposito(p), 0),
    naEscada: abertos.filter((p) => p.status === "at_gangway").reduce((s, p) => s + saldo(p), 0),
  };

  const sel = aberto ? pedidos.find((p) => p.id === aberto) ?? null : null;

  return (
    <div className="adm-page">
      <section className="adm-kpis" aria-label="Resumo">
        <div className="adm-kpi"><b>{kpi.abertos}</b><span>pedidos abertos</span></div>
        <div className={`adm-kpi ${kpi.aguardando ? "amber" : ""}`}><b>{kpi.aguardando}</b><span>aguardando depósito</span></div>
        <div className="adm-kpi"><b>{brlUsd(kpi.emCaixa)}</b><span>depósitos em caixa</span></div>
        <div className="adm-kpi teal"><b>{brlUsd(kpi.naEscada)}</b><span>a receber na escada</span></div>
      </section>

      <div className="adm-toolbar">
        <div className="adm-chips" role="tablist" aria-label="Filtro de status">
          {FILTROS.map((f) => {
            const n = pedidos.filter(f.teste).length;
            return (
              <button
                key={f.k}
                type="button"
                role="tab"
                aria-selected={filtro === f.k}
                className={filtro === f.k ? "on" : ""}
                onClick={() => setFiltro(f.k)}
              >
                {f.rotulo} <small>{n}</small>
              </button>
            );
          })}
        </div>
        <div className="adm-toolbar-right">
          <input
            className="adm-busca"
            type="search"
            placeholder="Buscar pedido, navio, cliente ou item"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar pedidos"
          />
          <button
            type="button"
            className="adm-iconbtn"
            title="Atualizar"
            aria-label="Atualizar a lista"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refrescando}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={refrescando ? "adm-girando" : ""}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="adm-vazio">
          <b>{q ? "Nada com essa busca." : filtro === "abertos" ? "Convés limpo — nenhum pedido aberto." : "Nada por aqui."}</b>
          <p>{filtro === "abertos" && !q ? "Novos pedidos aparecem aqui assim que a tripulação fecha o carrinho." : "Troque o filtro ou limpe a busca."}</p>
        </div>
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table pedidos">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Navio</th>
                <th>Itens</th>
                <th className="num">Valor</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th className="acao"><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const prox = PROXIMO[p.status];
                const busy = ocupados.has(p.id);
                const nav = p.ships?.name ?? p.vessel_name ?? "—";
                const atraso = p.ships ? delayLabel({ delay_hours: p.ships.delay_hours }) : null;
                const nItens = totalItens(p);
                return (
                  <tr
                    key={p.id}
                    className={`${aberto === p.id ? "sel" : ""} ${busy ? "busy" : ""}`}
                    onClick={() => setAberto(p.id)}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setAberto(p.id))}
                    aria-label={`Abrir pedido ${p.code}`}
                  >
                    <td data-l="Pedido">
                      <b className="mono">#{p.code}</b>
                      <small>{dia(p.created_at)}</small>
                    </td>
                    <td data-l="Navio">
                      <b>{nav}</b>
                      <small>
                        {p.ships ? `berço ${p.ships.berth ?? p.vessel_berth ?? "—"} · ETA ${quando(p.ships.eta)}` : p.vessel_berth ? `berço ${p.vessel_berth}` : "sem escala"}
                        {atraso && <em className="adm-tag warn">{atraso.startsWith("DELAYED") ? `atraso ${atraso.slice(8)}` : `adiantado ${atraso.slice(6)}`}</em>}
                      </small>
                    </td>
                    <td data-l="Itens">
                      <b>{nItens} {nItens === 1 ? "item" : "itens"}</b>
                      <small className="clamp">{p.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</small>
                    </td>
                    <td data-l="Valor" className="num">
                      <b>{brlUsd(subtotal(p))}</b>
                      <small>dep. {brlUsd(deposito(p))} · saldo {brlUsd(saldo(p))}</small>
                    </td>
                    <td data-l="Status">
                      <span className={`adm-pill ${STATUS_TOM[p.status]}`}>{STATUS_PT[p.status]}</span>
                    </td>
                    <td data-l="Atualizado">
                      <small title={quando(p.status_changed_at ?? p.created_at)}>{relativo(p.status_changed_at ?? p.created_at)}</small>
                    </td>
                    <td className="acao" onClick={(e) => e.stopPropagation()}>
                      {p.status === "at_gangway" ? (
                        <button type="button" className="adm-btn primario small" onClick={() => setAberto(p.id)}>
                          Entregar…
                        </button>
                      ) : prox ? (
                        <button
                          type="button"
                          className="adm-btn small"
                          disabled={busy}
                          aria-busy={busy}
                          onClick={() => agir(p, prox.to)}
                        >
                          {busy ? <span className="adm-spin" aria-hidden /> : null}
                          {busy ? prox.ocupado : prox.rotulo}
                        </button>
                      ) : (
                        <button type="button" className="adm-btn ghost small" onClick={() => setAberto(p.id)}>
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <Detalhe
          p={sel}
          busy={ocupados.has(sel.id)}
          onClose={() => setAberto(null)}
          onAgir={agir}
          onDesfazer={desfazer}
          onCancelar={cancelar}
          onCreditar={creditar}
          onEntregue={(row) => {
            troca(row);
            toast(`#${row.code} entregue${row.delivery_photo_path ? " com foto" : ""}`);
          }}
          onErro={(m) => toast(m, { tom: "erro" })}
        />
      )}
      {Dialogo}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Detalhe({
  p, busy, onClose, onAgir, onDesfazer, onCancelar, onCreditar, onEntregue, onErro,
}: {
  p: Pedido;
  busy: boolean;
  onClose: () => void;
  onAgir: (p: Pedido, to: OrderStatus) => void;
  onDesfazer: (p: Pedido) => void;
  onCancelar: (p: Pedido) => void;
  onCreditar: (p: Pedido) => void;
  onEntregue: (row: Pedido) => void;
  onErro: (m: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const prox = PROXIMO[p.status];
  const sub = subtotal(p);
  const dep = deposito(p);
  const sal = saldo(p);
  const credito = Math.round(Number(p.credit_applied_usd ?? 0) * 100);
  const nav = p.ships?.name ?? p.vessel_name ?? "—";
  const corte = p.ships ? new Date(new Date(p.ships.eta).getTime() - (p.ships.cutoff_hours ?? 24) * 3600e3) : null;
  const podeCancelar = p.status !== "at_gangway" && ABERTOS.includes(p.status);
  const podeCreditar = ABERTOS.includes(p.status) && p.status !== "awaiting_deposit";

  return (
    <>
      <button className="adm-veu" aria-label="Fechar detalhe" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="det-titulo">
        <header className="adm-drawer-head">
          <div>
            <p className="kicker">Pedido</p>
            <h2 id="det-titulo" className="mono">#{p.code}</h2>
          </div>
          <span className={`adm-pill ${STATUS_TOM[p.status]}`}>{STATUS_PT[p.status]}</span>
          <button type="button" className="adm-iconbtn" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="adm-drawer-body">
          <section className="adm-bloco">
            <h3>Navio e escala</h3>
            <dl className="adm-dl">
              <div><dt>Navio</dt><dd>{nav}</dd></div>
              <div><dt>Berço</dt><dd>{p.ships?.berth ?? p.vessel_berth ?? "—"}</dd></div>
              <div><dt>ETA</dt><dd>{p.ships ? `${quando(p.ships.eta)} (${relativo(p.ships.eta)})` : "—"}</dd></div>
              <div><dt>Corte dos pedidos</dt><dd>{corte ? quando(corte) : "—"}</dd></div>
              {p.ships?.delay_hours ? (
                <div><dt>Atraso</dt><dd className={Number(p.ships.delay_hours) >= 2 ? "warn" : ""}>{Number(p.ships.delay_hours) > 0 ? "+" : ""}{Math.round(Number(p.ships.delay_hours))} h</dd></div>
              ) : null}
              <div><dt>Entrega prevista</dt><dd>{p.delivery_date ? dia(p.delivery_date + "T12:00:00Z") : "—"}</dd></div>
            </dl>
          </section>

          <section className="adm-bloco">
            <h3>Itens <small>{totalItens(p)}</small></h3>
            <table className="adm-itens">
              <tbody>
                {p.order_items.map((i, k) => {
                  const unit = i.unit_price_cents ?? Math.round(Number(i.unit_price_usd) * 100);
                  return (
                    <tr key={k}>
                      <td className="qty">{i.qty}×</td>
                      <td>
                        <b>{i.name}</b>
                        {i.sku && <small className="mono">{i.sku}</small>}
                      </td>
                      <td className="num">
                        <b>{brlUsd(unit * i.qty)}</b>
                        {i.qty > 1 && <small>{brlUsd(unit)} cada</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <dl className="adm-totais">
              <div><dt>Subtotal</dt><dd>{brlUsd(sub)}</dd></div>
              <div><dt>Depósito (30%)</dt><dd>{brlUsd(dep)}</dd></div>
              {credito > 0 && <div><dt>Crédito aplicado</dt><dd>− {brlUsd(credito)}</dd></div>}
              <div className="forte"><dt>Saldo na escada</dt><dd>{brlUsd(sal)}</dd></div>
              {p.payment_method && <div><dt>Pagamento</dt><dd>{p.payment_method}</dd></div>}
            </dl>
          </section>

          <section className="adm-bloco">
            <h3>Contato a bordo</h3>
            <dl className="adm-dl">
              <div><dt>Nome</dt><dd>{p.contact_name ?? "—"}{p.contact_rank ? ` · ${p.contact_rank}` : ""}</dd></div>
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  {p.contact_whatsapp ? (
                    <a className="adm-link" href={whats(p.contact_whatsapp)} target="_blank" rel="noreferrer">
                      {p.contact_whatsapp} ↗
                    </a>
                  ) : "—"}
                </dd>
              </div>
              {p.note && <div className="largo"><dt>Observação do cliente</dt><dd className="nota">{p.note}</dd></div>}
            </dl>
          </section>

          <section className="adm-bloco">
            <h3>Linha do tempo</h3>
            <ol className="adm-timeline">
              <li><b>Pedido criado</b><time>{quando(p.created_at)}</time></li>
              {p.status_changed_at && p.status_changed_at !== p.created_at && (
                <li><b>{STATUS_PT[p.status]}</b><time>{quando(p.status_changed_at)}</time></li>
              )}
              {p.delivered_at && <li><b>Entregue a bordo{p.delivery_photo_path ? " · com foto" : ""}</b><time>{quando(p.delivered_at)}</time></li>}
            </ol>
          </section>
        </div>

        <footer className="adm-drawer-foot">
          {p.status === "at_gangway" ? (
            <EntregaFoto pedido={p} onDone={onEntregue} onErro={onErro} />
          ) : prox ? (
            <button type="button" className="adm-btn primario" disabled={busy} aria-busy={busy} onClick={() => onAgir(p, prox.to)}>
              {busy ? <span className="adm-spin" aria-hidden /> : null}
              {busy ? prox.ocupado : prox.rotulo}
            </button>
          ) : null}
          <div className="adm-drawer-sec">
            {p.previous_status && (
              <button type="button" className="adm-btn ghost" disabled={busy} onClick={() => onDesfazer(p)}>
                ↩ Desfazer · voltar para {STATUS_PT[p.previous_status]}
              </button>
            )}
            {podeCreditar && (
              <button type="button" className="adm-btn ghost" disabled={busy} onClick={() => onCreditar(p)}>
                Creditar (navio desviou)
              </button>
            )}
            {podeCancelar && (
              <button type="button" className="adm-btn perigo ghost" disabled={busy} onClick={() => onCancelar(p)}>
                Cancelar pedido
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}
