/**
 * Promessa de entrega a partir da grade do porto.
 *
 * É o modelo que o Sunny usa e que a tripulação já entende: o prazo
 * não vem do ETA de um navio, vem de uma matriz
 *   (porto, janela em que o pedido chegou) → dia de entrega,
 * mais a permanência mínima que o navio precisa ter no porto.
 *
 * Por que isso escala e o ETA por navio não: a grade é uma promessa
 * que vale para qualquer navio que atracar naquele porto, inclusive
 * os que não estão no line-up. Ninguém precisa curar escala para o
 * cliente conseguir comprar.
 *
 * Tudo aqui é puro — nada de fetch, nada de Date.now() escondido. A
 * hora "agora" entra por parâmetro para o teste poder fixar o
 * relógio, que é a única forma de testar regra de fuso sem sorte.
 */

export type PortRule = {
  id?: string;
  label?: string | null;
  window_start: string; // 'HH:MM' ou 'HH:MM:SS', hora local do porto
  window_end: string;
  order_weekdays?: number[] | null; // 0=domingo … 6=sábado
  delivery_offset_days: number;
  delivery_weekdays?: number[] | null; // rota fixa; vence o offset
  vessel_must_stay_until?: string | null;
  min_stay_hours?: number | null;
  active?: boolean;
  sort_order?: number;
};

export type DeliveryPromise = {
  rule: PortRule;
  /** Data prometida, 'YYYY-MM-DD' na data local do porto. */
  deliveryDate: string;
  /** Quantos dias à frente — 0 = hoje, 1 = amanhã. */
  daysAhead: number;
  /** Instante em que esta janela fecha (UTC). Alimenta a urgência. */
  cutoffAt: Date;
  vesselMustStayUntil: string | null;
  minStayHours: number | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Partes da data no fuso do porto, sem depender do fuso do servidor. */
export function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(date).map((x) => [x.type, x.value])
  ) as Record<string, string>;

  const WEEKDAY: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // Intl devolve 24 para meia-noite em algumas engines
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAY[p.weekday] ?? 0,
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

/**
 * "Este horário local, neste fuso" → instante UTC.
 *
 * Faz duas passadas: a primeira estima o deslocamento, a segunda
 * confere com o deslocamento que vale naquele instante. É o que
 * mantém a conta certa na virada do horário de verão — Santos não
 * tem mais, mas Roterdã e Hamburgo têm, e a grade é para os dois.
 */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime()
  );
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // "Que instante UTC mostra este relógio de parede neste fuso?"
  // Subtrai o deslocamento e confere com o deslocamento que vale no
  // instante encontrado: as duas contas só divergem na virada do
  // horário de verão, e é ali que a segunda passada salva a data.
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  const off = offsetMs(new Date(target), timeZone);
  let utc = target - off;
  const settled = offsetMs(new Date(utc), timeZone);
  if (settled !== off) utc = target - settled;
  return new Date(utc);
}

/** 'HH:MM[:SS]' → minutos desde a meia-noite. */
export function minutesOfDay(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ""));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    iso: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  };
}

/**
 * Escolhe a regra que vale agora e devolve a promessa.
 *
 * Devolve null quando nenhuma janela cobre o momento — caso real: um
 * porto que só opera de segunda a sexta e o pedido cai no domingo. A
 * UI mostra a próxima janela em vez de inventar uma data.
 */
export function resolveDelivery(
  rules: PortRule[],
  now: Date,
  timeZone = "America/Sao_Paulo"
): DeliveryPromise | null {
  const local = zonedParts(now, timeZone);
  const nowMin = local.hour * 60 + local.minute;

  const candidates = rules
    .filter((r) => r.active !== false)
    .filter((r) => (r.order_weekdays ?? [0, 1, 2, 3, 4, 5, 6]).includes(local.weekday))
    .filter((r) => {
      const start = minutesOfDay(r.window_start);
      const end = minutesOfDay(r.window_end);
      // 23:59 no banco significa "até o fim do dia": inclusivo.
      const endInclusive = end >= 23 * 60 + 59 ? 24 * 60 : end;
      return nowMin >= start && nowMin < endInclusive;
    })
    .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));

  const rule = candidates[0];
  if (!rule) return null;

  let target = addDays(local.year, local.month, local.day, rule.delivery_offset_days);

  // Rota fixa vence o offset: avança até cair num dia de rota.
  const routeDays = rule.delivery_weekdays;
  if (routeDays && routeDays.length) {
    for (let i = 0; i < 14 && !routeDays.includes(target.weekday); i++) {
      target = addDays(target.year, target.month, target.day, 1);
    }
  }

  const endMin = minutesOfDay(rule.window_end);
  const cutoffAt = zonedTimeToUtc(
    local.year,
    local.month,
    local.day,
    Math.floor(endMin / 60),
    endMin % 60,
    timeZone
  );

  const daysAhead = Math.round(
    (Date.UTC(target.year, target.month - 1, target.day) -
      Date.UTC(local.year, local.month - 1, local.day)) /
      86400000
  );

  return {
    rule,
    deliveryDate: target.iso,
    daysAhead,
    cutoffAt,
    vesselMustStayUntil: rule.vessel_must_stay_until ?? null,
    minStayHours: rule.min_stay_hours ?? null,
  };
}

/** Texto curto da promessa, em inglês, para o topo da loja. */
export function promiseLabel(p: DeliveryPromise | null): string {
  if (!p) return "Next delivery window opens soon";
  if (p.daysAhead === 0) return "Delivered today";
  if (p.daysAhead === 1) return "Delivered tomorrow";
  return `Delivered in ${p.daysAhead} days`;
}

/** Horas inteiras até a janela fechar — é o que vira contagem regressiva. */
export function hoursToCutoff(p: DeliveryPromise | null, now: Date): number {
  if (!p) return 0;
  return Math.max(0, Math.round((p.cutoffAt.getTime() - now.getTime()) / 3600e3));
}
