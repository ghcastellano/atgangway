
export const usd = (v: number) => "USD " + v.toFixed(2);

/** Horas inteiras (>= 0) entre agora e uma data futura. */
export const hoursUntil = (iso: string | Date) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600e3));

/** Momento em que os pedidos fecham para um navio. */
export const orderCloseAt = (eta: string | Date, cutoffHours: number) =>
  new Date(new Date(eta).getTime() - cutoffHours * 3600e3);

export const orderWindowOpen = (eta: string | Date, cutoffHours: number) =>
  orderCloseAt(eta, cutoffHours).getTime() > Date.now();

/** Nome curto do navio para o chip (última palavra — "CMA CGM MELODY" → "MELODY"). */
export const shortShipName = (name: string) => name.trim().split(/\s+/).slice(-1)[0];


/** Mínimo de senha — precisa bater com password_min_length no Supabase Auth. */
export const PASSWORD_MIN = 8;

/** Sanitiza o parâmetro ?next= — só caminhos internos. */
export const safeNext = (v: string | null | undefined, fallback = "/shop") => {
  // Redireciono pós-login só pode ser um caminho INTERNO. Barra dupla é
  // URL protocol-relative (//evil.com → outro site), e barra invertida é
  // a mesma coisa disfarçada: o navegador trata "/\evil.com" como
  // "//evil.com". A versão anterior barrava a primeira e deixava a
  // segunda passar. Recusa qualquer controle ou barra invertida no
  // valor, e exige começo em "/" que não seja "//".
  if (!v || !v.startsWith("/") || v.startsWith("//")) return fallback;
  if (/[\\\t\r\n]/.test(v)) return fallback;
  return v;
};

export const santosTime = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** timestamptz → valor de <input type="datetime-local"> no fuso de Santos. */
export function etaToLocalInput(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Valor de <input type="datetime-local"> (hora de Santos, UTC-3 fixo) → ISO UTC. */
export function localInputToIso(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString();
}

/** 'YYYY-MM-DD' (data local do porto) → "03 Oct". */
export function diaCurto(d: string): string {
  return new Date(`${d}T12:00:00-03:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
