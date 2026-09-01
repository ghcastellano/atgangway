import { createClient } from "@/lib/supabase/server";
import { etaToLocalInput, hoursUntil, orderCloseAt } from "@/lib/format";
import { callState, canOrder } from "@/lib/callstate";
import type { Ship } from "@/lib/types";
import { santosTime } from "@/lib/format";
import { delayLabel } from "@/lib/types";
import { saveShip, toggleShipActive } from "../actions";
import BotaoAcao from "@/components/admin/BotaoAcao";

export const dynamic = "force-dynamic";

function ShipForm({ ship }: { ship?: Ship }) {
  return (
    <form action={saveShip} className="adm-form">
      {ship && <input type="hidden" name="id" value={ship.id} />}
      <div className="field">
        <label>Vessel name</label>
        <input name="name" required defaultValue={ship?.name ?? ""} placeholder="MSC LORENA" />
      </div>
      <div className="form2">
        <div className="field">
          <label>Berth</label>
          <input name="berth" defaultValue={ship?.berth ?? ""} placeholder="39" />
        </div>
        <div className="field">
          <label>Cutoff — h antes do ETA (72 = 3 dias)</label>
          <input
            name="cutoff_hours"
            type="number"
            min={1}
            max={240}
            defaultValue={ship?.cutoff_hours ?? 72}
          />
        </div>
      </div>
      <div className="field">
        <label>ETA — hora de Santos</label>
        <input
          name="eta"
          type="datetime-local"
          required
          defaultValue={ship ? etaToLocalInput(ship.eta) : ""}
        />
      </div>
      <label className="checkline">
        <input type="checkbox" name="active" defaultChecked={ship ? ship.active : true} />
        Visible in the line-up
      </label>
      <BotaoAcao ocupado="Salvando…">{ship ? "Save changes" : "+ Add vessel"}</BotaoAcao>
    </form>
  );
}

/** Linha compacta: nome, quando atraca, quando fecha o pedido. */
function LinhaNavio({ ship }: { ship: Ship }) {
  const closeH = hoursUntil(orderCloseAt(ship.eta, ship.cutoff_hours));
  return (
    <div className="nm">
      {ship.name}
      {delayLabel(ship) && <b className="delay-tag">{delayLabel(ship)}</b>}
      <span className="meta" style={{ display: "block", fontWeight: 400 }}>
        ETA {santosTime(ship.eta)} ·{" "}
        {closeH > 0 ? `fecha em ${closeH}h` : "pedidos fechados"}
        {ship.berth ? ` · berço ${ship.berth}` : ""}
      </span>
    </div>
  );
}

export default async function AdminShips() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ships")
    .select("id, name, berth, eta, cutoff_hours, active, delay_hours, eta_source, last_synced_at")
    .order("eta", { ascending: true });
  const ships = (data ?? []) as Ship[];

  /* A régua única de lib/callstate decide as três pilhas — a mesma do
     checkout, do carrinho e da rotação no banco.

     A página abria com 122 escalas publicadas e desenhava um FORMULÁRIO
     INTEIRO para cada uma: ~850 campos no HTML, todos montados a cada
     clique, porque a server action revalida a rota toda. Era essa a
     lentidão relatada — não a rede nem o banco, mas o tamanho da
     árvore que precisa ser reconstruída para trocar um booleano.

     Agora publicado vira LINHA, e o formulário só existe no HTML de
     quem o abriu; e escala com ETA no passado sai da lista principal
     para um <details> — continua acessível, para de custar. */
  const live = ships.filter((s) => s.active);
  const vendendo = live.filter((s) => canOrder(callState({ eta: s.eta, cutoff_hours: s.cutoff_hours })));
  const passadas = live.filter((s) => !vendendo.includes(s));

  const naFila = ships.filter((s) => !s.active);
  const queue = naFila.filter((s) =>
    canOrder(callState({ eta: s.eta, cutoff_hours: s.cutoff_hours }))
  );
  const vencidas = naFila.length - queue.length;

  return (
    <main className="pb-nav">
      <p className="subhead">Line-up do porto · fila de revisão ({queue.length})</p>
      {queue.length === 0 ? (
        <p className="finehint" style={{ margin: "0 18px 8px" }}>
          Nada aguardando com janela aberta. O sync roda de hora em hora.
          {vencidas > 0 && ` (${vencidas} escala${vencidas === 1 ? "" : "s"} vencida${vencidas === 1 ? "" : "s"} fora da lista.)`}
        </p>
      ) : (
        <div className="cart-list">
          {queue.slice(0, 60).map((s) => (
            <div key={s.id} className="queue-row">
              <div>
                <div className="nm">
                  {s.name}
                  {delayLabel(s) && <b className="delay-tag">{delayLabel(s)}</b>}
                </div>
                <div className="meta">
                  ETA {santosTime(s.eta)} · em {hoursUntil(s.eta)}h
                  {s.berth ? ` · berço ${s.berth}` : ""}
                </div>
              </div>
              <form action={toggleShipActive}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value="1" />
                <BotaoAcao ocupado="Publicando…">Publicar</BotaoAcao>
              </form>
            </div>
          ))}
        </div>
      )}
      {queue.length > 60 && (
        <p className="finehint" style={{ margin: "8px 18px" }}>
          Mostrando 60 de {queue.length} com janela aberta — publique os que
          interessam. Escala que vence sai da fila sozinha.
        </p>
      )}

      <p className="subhead">Publicados e vendendo ({vendendo.length})</p>
      <div className="cart-list">
        {vendendo.map((s) => (
          <div key={s.id} className="queue-row">
            <LinhaNavio ship={s} />
            <div className="linha-acoes">
              <form action={toggleShipActive}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value="0" />
                <BotaoAcao className="btn small ghost" ocupado="Escondendo…">
                  Esconder
                </BotaoAcao>
              </form>
            </div>
            <details className="adm-edit">
              <summary>Editar escala</summary>
              <ShipForm ship={s} />
            </details>
          </div>
        ))}
      </div>

      {passadas.length > 0 && (
        <details className="adm-edit" style={{ margin: "10px 18px" }}>
          <summary>
            {passadas.length} publicada{passadas.length === 1 ? "" : "s"} com janela
            já fechada
          </summary>
          <div className="cart-list">
            {passadas.map((s) => (
              <div key={s.id} className="queue-row">
                <LinhaNavio ship={s} />
                <form action={toggleShipActive}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value="0" />
                  <BotaoAcao className="btn small ghost" ocupado="Escondendo…">
                    Esconder
                  </BotaoAcao>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="subhead">Cadastrar navio à mão</p>
      <ShipForm />
    </main>
  );
}
