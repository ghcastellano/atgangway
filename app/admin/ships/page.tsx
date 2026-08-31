import { createClient } from "@/lib/supabase/server";
import { etaToLocalInput, hoursUntil, orderCloseAt } from "@/lib/format";
import type { Ship } from "@/lib/types";
import { santosTime } from "@/lib/format";
import { delayLabel } from "@/lib/types";
import { saveShip, toggleShipActive } from "../actions";

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
      <button className="btn small" type="submit">
        {ship ? "Save changes" : "+ Add vessel"}
      </button>
    </form>
  );
}

export default async function AdminShips() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ships")
    .select("id, name, berth, eta, cutoff_hours, active, delay_hours, eta_source, last_synced_at")
    .order("eta", { ascending: true });
  const ships = (data ?? []) as Ship[];

  const live = ships.filter((s) => s.active);
  const queue = ships.filter((s) => !s.active);

  return (
    <main className="pb-nav">
      <p className="subhead">
        Line-up do porto · fila de revisão ({queue.length})
      </p>
      {queue.length === 0 ? (
        <p className="finehint" style={{ margin: "0 18px 8px" }}>
          Nada aguardando. O sync roda de hora em hora.
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
                <button className="btn small" type="submit">
                  Publicar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      {queue.length > 60 && (
        <p className="finehint" style={{ margin: "8px 18px" }}>
          Mostrando 60 de {queue.length} — publique os que interessam; o resto some
          sozinho quando a escala passa.
        </p>
      )}

      <p className="subhead">Publicados para o cliente ({live.length})</p>
      {live.map((s) => {
        const closeH = hoursUntil(orderCloseAt(s.eta, s.cutoff_hours));
        return (
          <div key={s.id}>
            <p className="subhead" style={{ paddingTop: 6 }}>
              {s.name} — {closeH > 0 ? `fecha em ${closeH}h` : "pedidos fechados"}
              {delayLabel(s) ? ` · ${delayLabel(s)}` : ""}
            </p>
            <ShipForm ship={s} />
            <form action={toggleShipActive} style={{ margin: "0 16px 14px" }}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value="0" />
              <button className="btn small ghost" type="submit">
                Esconder do app
              </button>
            </form>
          </div>
        );
      })}

      <p className="subhead">Cadastrar navio à mão</p>
      <ShipForm />
    </main>
  );
}
