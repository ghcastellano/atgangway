"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mudarStatus, salvarSobra } from "@/app/admin/actions";
import { SAILED_AFTER_HOURS } from "@/lib/callstate";
import { STATUS_PT, STATUS_TOM, brlUsd, cents, dia, quando, relativo, type Sobra } from "@/lib/painel";
import { useToast } from "./Toast";
import { useConfirmar } from "./Confirmar";

/**
 * Não entregues: mercadoria comprada para um navio que não veio.
 *
 * Cada cartão responde às quatro perguntas da operação: de quem é
 * (cliente, com WhatsApp e e-mail), o que ficou (itens e valor), o que
 * já foi feito com o dinheiro (crédito lançado, saldo do cliente) e
 * onde/quando entregar (a próxima escala conhecida do cliente, pelo
 * navio do perfil). O plano se escreve no próprio cartão.
 *
 * Duas situações entram aqui:
 *   creditado — o cron ou a equipe já devolveu o depósito como crédito;
 *               a mercadoria continua no estoque esperando a próxima
 *               escala. Quando o cliente fizer o pedido novo, o crédito
 *               abate o depósito sozinho; aqui marca-se "resolvida" e
 *               anota-se em qual pedido a mercadoria saiu.
 *   em aberto — em separação ou na escada, e o navio já foi. O cron NÃO
 *               credita sozinho estes (mercadoria comprada é decisão de
 *               gente): ou "Creditar depósito" aqui, ou entrega na
 *               próxima escala sem creditar.
 */
type Aba = "pendentes" | "resolvidas";

const whats = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
const subtotal = (s: Sobra) => cents(s.subtotal_cents, s.subtotal_usd);
const deposito = (s: Sobra) => cents(s.deposit_cents, s.deposit_usd);
const itens = (s: Sobra) => s.order_items.reduce((n, i) => n + i.qty, 0);
const creditoDoDesvio = (s: Sobra) => s.credits.find((c) => c.kind === "deviation") ?? null;
const emAberto = (s: Sobra) => s.status === "preparing" || s.status === "at_gangway";
const usd = (n: number) => brlUsd(Math.round(n * 100));

export default function SobrasBoard({ inicial }: { inicial: Sobra[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirmar, Dialogo } = useConfirmar();
  const [sobras, setSobras] = useState<Sobra[]>(inicial);
  const [aba, setAba] = useState<Aba>("pendentes");
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  useEffect(() => setSobras(inicial), [inicial]);

  const troca = (id: string, patch: Partial<Sobra>) =>
    setSobras((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const ocupa = (id: string, on: boolean) =>
    setOcupados((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const { pendentes, resolvidas } = useMemo(
    () => ({
      pendentes: sobras.filter((s) => !s.leftover_resolved_at),
      resolvidas: sobras.filter((s) => s.leftover_resolved_at),
    }),
    [sobras]
  );
  const lista = aba === "pendentes" ? pendentes : resolvidas;

  const kpi = {
    pendentes: pendentes.length,
    parado: pendentes.reduce((n, s) => n + subtotal(s), 0),
    credito: pendentes.reduce((n, s) => n + Math.round((creditoDoDesvio(s)?.amount_usd ?? 0) * 100), 0),
    decidir: pendentes.filter(emAberto).length,
  };

  /** "Creditar depósito" no pedido em aberto: a mesma transição do
   *  board de pedidos; o crédito nasce do gatilho no banco. */
  async function creditar(s: Sobra) {
    const ok = await confirmar({
      titulo: `Creditar o depósito de #${s.code}?`,
      texto: `${brlUsd(deposito(s))} viram crédito na conta do cliente para a próxima escala. A mercadoria continua aqui, aguardando entrega.`,
      confirmar: "Creditar",
      cancelar: "Voltar",
    });
    if (!ok) return;
    ocupa(s.id, true);
    start(async () => {
      const r = await mudarStatus(s.id, "credited");
      ocupa(s.id, false);
      if (!r.ok) {
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(s.id, { status: r.row.status, previous_status: r.row.previous_status, status_changed_at: r.row.status_changed_at });
      toast(`#${s.code} creditado — ${brlUsd(deposito(s))} na conta do cliente`);
      // O crédito e o saldo vêm do banco (gatilho): recarrega a página
      // em vez de inventar a linha do razão no navegador.
      router.refresh();
    });
  }

  function salvarPlano(s: Sobra, note: string) {
    ocupa(s.id, true);
    start(async () => {
      const r = await salvarSobra(s.id, { note });
      ocupa(s.id, false);
      if (!r.ok) {
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(s.id, r.row);
      toast(`Plano de #${s.code} salvo`);
    });
  }

  async function resolver(s: Sobra, resolvida: boolean) {
    if (resolvida) {
      const ok = await confirmar({
        titulo: `Marcar #${s.code} como resolvida?`,
        texto: "A mercadoria foi entregue, reaproveitada ou baixada. Se ainda não anotou no plano o que aconteceu (ex.: \"entregue no pedido AG-1215\"), volte e anote antes.",
        confirmar: "Resolvida",
        cancelar: "Voltar",
      });
      if (!ok) return;
    }
    const antes = s;
    troca(s.id, { leftover_resolved_at: resolvida ? new Date().toISOString() : null });
    ocupa(s.id, true);
    start(async () => {
      const r = await salvarSobra(s.id, { resolvida });
      ocupa(s.id, false);
      if (!r.ok) {
        troca(s.id, antes);
        toast(r.error, { tom: "erro" });
        return;
      }
      troca(s.id, r.row);
      toast(resolvida ? `#${s.code} resolvida` : `#${s.code} reaberta`, {
        acao: { rotulo: "Desfazer", onClick: () => resolver({ ...s, ...r.row }, !resolvida) },
      });
    });
  }

  return (
    <div className="adm-page">
      <section className="adm-kpis" aria-label="Resumo">
        <div className="adm-kpi"><b>{kpi.pendentes}</b><span>pedidos com mercadoria parada</span></div>
        <div className="adm-kpi"><b>{brlUsd(kpi.parado)}</b><span>em mercadoria comprada</span></div>
        <div className="adm-kpi amber"><b>{brlUsd(kpi.credito)}</b><span>já devolvidos como crédito</span></div>
        <div className={`adm-kpi ${kpi.decidir ? "danger" : ""}`}>
          <b>{kpi.decidir}</b>
          <span>{kpi.decidir ? "navio já foi — decida: creditar ou entregar" : "nenhuma decisão pendente"}</span>
        </div>
      </section>

      <div className="adm-toolbar">
        <div className="adm-chips" role="tablist" aria-label="Situação">
          {([["pendentes", "Pendentes", pendentes.length], ["resolvidas", "Resolvidas", resolvidas.length]] as [Aba, string, number][]).map(([k, r, n]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? "on" : ""} onClick={() => setAba(k)}>
              {r} <small>{n}</small>
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="adm-vazio">
          <b>{aba === "pendentes" ? "Nenhuma mercadoria parada." : "Nada resolvido ainda."}</b>
          <p>
            {aba === "pendentes"
              ? "Pedidos entram aqui quando o navio some depois da compra: creditados em separação ou na escada, ou ainda abertos com o navio já ido."
              : "Quando uma sobra for entregue em outro pedido, reaproveitada ou baixada, marque-a como resolvida e ela vem para cá."}
          </p>
        </div>
      ) : (
        <div className="adm-sobras">
          {lista.map((s) => (
            <Cartao
              key={s.id}
              s={s}
              busy={ocupados.has(s.id)}
              onCreditar={creditar}
              onSalvarPlano={salvarPlano}
              onResolver={resolver}
            />
          ))}
        </div>
      )}
      {Dialogo}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Cartao({
  s, busy, onCreditar, onSalvarPlano, onResolver,
}: {
  s: Sobra;
  busy: boolean;
  onCreditar: (s: Sobra) => void;
  onSalvarPlano: (s: Sobra, note: string) => void;
  onResolver: (s: Sobra, resolvida: boolean) => void;
}) {
  const cred = creditoDoDesvio(s);
  const aberto = emAberto(s);
  const resolvida = Boolean(s.leftover_resolved_at);
  const nome = s.cliente?.full_name || s.contact_name || "—";
  const zap = s.contact_whatsapp || s.cliente?.whatsapp || null;
  const navio = s.ships?.name ?? s.vessel_name ?? "—";
  const foi = s.ships ? new Date(new Date(s.ships.ata ?? s.ships.eta).getTime() + SAILED_AFTER_HOURS * 3600e3) : null;
  const prox = s.cliente?.proxima ?? null;
  const proxVem = prox ? new Date(prox.eta).getTime() > Date.now() : false;

  return (
    <article className={`adm-sobra ${resolvida ? "ok" : ""}`} aria-label={`Sobra do pedido ${s.code}`}>
      <header className="adm-sobra-head">
        <div>
          <b className="mono">#{s.code}</b>
          <small>
            pedido de {dia(s.created_at)} · {itens(s)} {itens(s) === 1 ? "item" : "itens"} · {brlUsd(subtotal(s))}
            {resolvida ? ` · resolvida ${relativo(s.leftover_resolved_at)}` : ""}
          </small>
        </div>
        <span className={`adm-pill ${aberto ? "danger" : STATUS_TOM[s.status]}`}>
          {aberto ? `${STATUS_PT[s.status]} · navio já foi` : `${STATUS_PT[s.status]}${s.previous_status ? ` · estava ${STATUS_PT[s.previous_status].toLowerCase()}` : ""}`}
        </span>
      </header>

      <div className="adm-sobra-grid">
        <section>
          <h4>Para quem</h4>
          <b>{nome}</b>
          <small>
            {s.contact_rank ? `${s.contact_rank} · ` : ""}
            {zap ? <a href={whats(zap)} target="_blank" rel="noopener noreferrer">WhatsApp</a> : "sem WhatsApp"}
            {s.cliente?.email ? <> · <a href={`mailto:${s.cliente.email}`}>{s.cliente.email}</a></> : null}
          </small>
        </section>

        <section>
          <h4>Navio que falhou</h4>
          <b>{navio}</b>
          <small>
            {s.ships ? `ETA ${quando(s.ships.eta)}` : "sem escala"}
            {foi ? ` · fora de cena ${relativo(foi)}` : ""}
          </small>
        </section>

        <section className={cred ? "" : "warn"}>
          <h4>Crédito</h4>
          {cred ? (
            <>
              <b>{usd(cred.amount_usd)} devolvidos</b>
              <small>lançado {quando(cred.created_at)} · saldo do cliente hoje {usd(s.saldo_usd)}</small>
            </>
          ) : (
            <>
              <b>Ainda não creditado</b>
              <small>depósito de {brlUsd(deposito(s))} em caixa · saldo do cliente {usd(s.saldo_usd)}</small>
            </>
          )}
        </section>

        <section className={prox && proxVem ? "" : "warn"}>
          <h4>Onde e quando entregar</h4>
          {prox && proxVem ? (
            <>
              <b>{prox.name}</b>
              <small>
                ETA {quando(prox.eta)} ({relativo(prox.eta)}) · berço {prox.berth ?? "—"}
                {!prox.active ? " · escala ainda não publicada" : ""}
              </small>
            </>
          ) : (
            <>
              <b>Sem escala conhecida</b>
              <small>
                {s.cliente?.vessel_name ? `Perfil diz ${s.cliente.vessel_name}. ` : ""}
                Pergunte no WhatsApp quando o navio volta a Santos.
              </small>
            </>
          )}
        </section>
      </div>

      <details>
        <summary>O que ficou: {itens(s)} {itens(s) === 1 ? "item" : "itens"}</summary>
        <table className="adm-itens">
          <tbody>
            {s.order_items.map((i, k) => {
              const unit = i.unit_price_cents ?? Math.round(Number(i.unit_price_usd) * 100);
              return (
                <tr key={k}>
                  <td className="adm-qty">{i.qty}×</td>
                  <td>
                    <b>{i.name}</b>
                    {i.sku && <small className="mono">{i.sku}</small>}
                  </td>
                  <td className="num">{brlUsd(unit * i.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <form
        className="adm-sobra-plano"
        onSubmit={(e) => {
          e.preventDefault();
          onSalvarPlano(s, String(new FormData(e.currentTarget).get("note") ?? ""));
        }}
      >
        <label htmlFor={`plano-${s.id}`}>Plano — para quem, onde, quando, como</label>
        <textarea
          id={`plano-${s.id}`}
          name="note"
          defaultValue={s.leftover_note ?? ""}
          placeholder="Ex.: entregar no MSC SOFIA PAZ, berço 37, dia 22/09, junto com o pedido novo — combinado com o comissário pelo WhatsApp."
        />
        <div className="adm-form-acoes">
          <button type="submit" className="adm-btn small" disabled={busy} aria-busy={busy}>
            {busy ? <span className="adm-spin" aria-hidden /> : null}
            Salvar plano
          </button>
          {aberto && (
            <button type="button" className="adm-btn ghost small" disabled={busy} onClick={() => onCreditar(s)}>
              Creditar depósito
            </button>
          )}
          <button type="button" className="adm-btn ghost small" disabled={busy} onClick={() => onResolver(s, !resolvida)}>
            {resolvida ? "Reabrir" : "Marcar resolvida"}
          </button>
        </div>
      </form>
    </article>
  );
}
