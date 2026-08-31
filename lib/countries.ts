/**
 * Códigos de discagem para o seletor de WhatsApp.
 *
 * A lista começa pelas nações que mais fornecem tripulação à marinha
 * mercante (Filipinas, Índia, China, Indonésia, Rússia, Ucrânia…) —
 * são os nomes que o app precisa achar primeiro. O resto vem em
 * ordem alfabética.
 */
export type Country = { code: string; name: string; dial: string; flag: string };

export const COUNTRIES: Country[] = [
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", dial: "+380", flag: "🇺🇦" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { code: "MM", name: "Myanmar", dial: "+95", flag: "🇲🇲" },
  { code: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { code: "BG", name: "Bulgaria", dial: "+359", flag: "🇧🇬" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "HR", name: "Croatia", dial: "+385", flag: "🇭🇷" },
  { code: "CY", name: "Cyprus", dial: "+357", flag: "🇨🇾" },
  { code: "CZ", name: "Czechia", dial: "+420", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "EE", name: "Estonia", dial: "+372", flag: "🇪🇪" },
  { code: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "GE", name: "Georgia", dial: "+995", flag: "🇬🇪" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { code: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { code: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { code: "IS", name: "Iceland", dial: "+354", flag: "🇮🇸" },
  { code: "IR", name: "Iran", dial: "+98", flag: "🇮🇷" },
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "KZ", name: "Kazakhstan", dial: "+7", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "LV", name: "Latvia", dial: "+371", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "LR", name: "Liberia", dial: "+231", flag: "🇱🇷" },
  { code: "LT", name: "Lithuania", dial: "+370", flag: "🇱🇹" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "MT", name: "Malta", dial: "+356", flag: "🇲🇹" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "PA", name: "Panama", dial: "+507", flag: "🇵🇦" },
  { code: "PE", name: "Peru", dial: "+51", flag: "🇵🇪" },
  { code: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "RO", name: "Romania", dial: "+40", flag: "🇷🇴" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
];

export const DEFAULT_COUNTRY = "BR";

/** Fusos que identificam país sem ambiguidade útil para tripulação. */
const TZ_TO_COUNTRY: Record<string, string> = {
  "Asia/Manila": "PH",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Shanghai": "CN",
  "Asia/Jakarta": "ID",
  "Asia/Yangon": "MM",
  "Asia/Ho_Chi_Minh": "VN",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Moscow": "RU",
  "Europe/Istanbul": "TR",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Singapore": "SG",
  "Asia/Dubai": "AE",
  "America/Sao_Paulo": "BR",
  "Europe/Athens": "GR",
  "Europe/Lisbon": "PT",
  "Europe/Madrid": "ES",
  "Europe/Bucharest": "RO",
  "Europe/Warsaw": "PL",
  "Europe/Riga": "LV",
  "Europe/Vilnius": "LT",
  "Europe/Tallinn": "EE",
  "Europe/Zagreb": "HR",
  "Europe/Sofia": "BG",
};

/**
 * Adivinha o país do tripulante sem pedir nada: primeiro a região da
 * língua do navegador (pt-BR → BR), depois o fuso do aparelho. Só cai
 * no padrão se as duas pistas falharem.
 */
export function detectCountry(): string {
  const known = new Set(COUNTRIES.map((c) => c.code));

  try {
    const langs = [
      ...(navigator.languages ?? []),
      navigator.language,
    ].filter(Boolean) as string[];
    for (const l of langs) {
      const region = l.split(/[-_]/)[1]?.toUpperCase();
      if (region && known.has(region)) return region;
    }
  } catch {
    // navigator indisponível — segue para o fuso
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byTz = TZ_TO_COUNTRY[tz];
    if (byTz && known.has(byTz)) return byTz;
  } catch {
    // sem Intl — usa o padrão
  }

  return DEFAULT_COUNTRY;
}

export const dialOf = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.dial ?? "+55";

/** E.164 simplificado: dial + dígitos, 8 a 15 dígitos no total. */
export function buildPhone(countryCode: string, local: string): string | null {
  const dial = dialOf(countryCode).replace(/\D/g, "");
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  const full = dial + digits;
  if (full.length < 8 || full.length > 15) return null;
  return "+" + full;
}

/**
 * Separa um E.164 salvo em país + parte local.
 *
 * Casa pelo prefixo MAIS LONGO, e é por isso que existe uma função em
 * vez de um find: "+380…" da Ucrânia começa com "+38", e um find
 * ingênuo devolveria o primeiro da lista que casasse. Onde dois países
 * dividem o mesmo DDI (+7 Rússia e Cazaquistão, +1 EUA e Canadá) a
 * ordem da lista decide — e a lista começa pelas nações que mais
 * embarcam, que é a aposta certa aqui.
 */
export function splitE164(e164: string): { code: string; local: string } | null {
  const raw = (e164 ?? "").trim();
  if (!raw.startsWith("+")) return null;
  const digits = "+" + raw.slice(1).replace(/\D/g, "");

  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length) best = c;
  }
  if (!best) return null;
  return { code: best.code, local: digits.slice(best.dial.length) };
}

/**
 * De onde sai o DDI mostrado, em ordem de prioridade. Pura de
 * propósito: a regra é o que importa, e ela precisa de teste.
 *
 *   número salvo > escolha manual > nacionalidade > aparelho
 *
 * A nacionalidade entra em terceiro porque é palpite: russo embarcado
 * costuma carregar chip brasileiro. Ela ajuda quem ainda não digitou e
 * sai do caminho de quem digitou.
 */
export function resolveDialCountry(input: {
  savedE164?: string | null;
  manualPick?: string | null;
  nationality?: string | null;
  deviceCountry?: string | null;
}): string {
  const known = (code: string | null | undefined) =>
    code && COUNTRIES.some((c) => c.code === code.toUpperCase())
      ? code.toUpperCase()
      : null;

  const fromSaved = input.savedE164 ? splitE164(input.savedE164)?.code : null;
  return (
    fromSaved ??
    known(input.manualPick) ??
    known(input.nationality) ??
    known(input.deviceCountry) ??
    "BR"
  );
}
