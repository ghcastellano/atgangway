/**
 * O que se escreve sobre um navio — fora de componente, para dar para
 * testar sem navegador.
 *
 * O padrão de rótulo é o do Sunny, que o tripulante já conhece:
 * `BOW CEDAR [MH] (9087013)` — nome, bandeira entre colchetes, IMO entre
 * parênteses. Só o que existe entra: um navio que o line-up trouxe sem
 * IMO vira `BOW CEDAR [MH]`, e sem nada vira só o nome.
 */
export type NavioRotulavel = {
  name: string;
  imo?: string | null;
  flag?: string | null;
};

export function tituloNavio(n: NavioRotulavel): string {
  const partes = [n.name.trim().toUpperCase()];
  const flag = n.flag?.trim();
  if (flag) partes.push(`[${flag.toUpperCase()}]`);
  const imo = n.imo?.trim();
  if (imo) partes.push(`(${imo})`);
  return partes.join(" ");
}

/**
 * Nacionalidade como a CODESP escreve → código ISO de duas letras.
 *
 * O line-up de Santos traz a bandeira como gentílico em português
 * ("LIBERIANA", "I.MARSHALL", "SINGAPURENSE"). Guardar isso cru seria
 * mostrar `[I.MARSHALL]` para um tripulante que só conhece MH. O que
 * o mapa não conhece vira null — antes sem bandeira que com lixo —
 * e cai no log do cron para entrar aqui na próxima.
 */
const BANDEIRAS: Record<string, string> = {
  LIBERIANA: "LR",
  IMARSHALL: "MH", MARSHALL: "MH", ILHASMARSHALL: "MH",
  SINGAPURENSE: "SG", SINGAPURA: "SG",
  PANAMENHA: "PA", PANAMA: "PA",
  BRASILEIRA: "BR",
  HONGKONG: "HK",
  PORTUGUESA: "PT", MADEIRA: "PT",
  MALTESA: "MT", MALTA: "MT",
  CIPRIOTA: "CY", CHIPRE: "CY",
  DINAMARQUESA: "DK",
  NORUEGUESA: "NO",
  BAHAMENSE: "BS", BAHAMAS: "BS",
  CHINESA: "CN",
  GREGA: "GR",
  BARBADOS: "BB", BARBADIANA: "BB",
  FRANCESA: "FR",
  TAILANDESA: "TH",
  ANTIGUANA: "AG", ANTIGUA: "AG",
  GIBRALTAR: "GI",
  TURCA: "TR",
  INDIANA: "IN",
  QUATARIANA: "QA", CATARIANA: "QA", CATAR: "QA",
  GRANDCAYMANA: "KY", CAYMAN: "KY", ILHASCAYMAN: "KY",
  SANMARINO: "SM",
  COREANA: "KR", SULCOREANA: "KR",
  ITALIANA: "IT",
  BERMUDAS: "BM", BERMUDIANA: "BM",
  ALEMA: "DE",
  HOLANDESA: "NL", NEERLANDESA: "NL",
  BELGA: "BE",
  BRITANICA: "GB", INGLESA: "GB",
  AMERICANA: "US", NORTEAMERICANA: "US",
  JAPONESA: "JP",
  ARGENTINA: "AR",
  URUGUAIA: "UY",
  CHILENA: "CL",
  ESPANHOLA: "ES",
  SUECA: "SE",
  FINLANDESA: "FI",
  RUSSA: "RU",
  INDONESIA: "ID",
  MALAIA: "MY", MALASIA: "MY",
  VIETNAMITA: "VN",
  FILIPINA: "PH",
  TAIWANESA: "TW",
  VANUATU: "VU", VANUATUENSE: "VU",
  TUVALU: "TV", TUVALUANA: "TV",
  ILHASCOOK: "CK",
  ILHADEMAN: "IM",
  CURACAO: "CW",
  LUXEMBURGUESA: "LU",
  SUICA: "CH",
  IRLANDESA: "IE",
  ISRAELENSE: "IL",
  EMIRADOS: "AE", EMIRATENSE: "AE",
  SAUDITA: "SA",
  KUWAITIANA: "KW",
  OMANI: "OM", OMANENSE: "OM",
  NIGERIANA: "NG",
  SULAFRICANA: "ZA",
  EGIPCIA: "EG",
  MEXICANA: "MX",
  CANADENSE: "CA",
  PERUANA: "PE",
  COLOMBIANA: "CO",
  VENEZUELANA: "VE",
  CUBANA: "CU",
  POLONESA: "PL",
  CROATA: "HR",
  BULGARA: "BG",
  ROMENA: "RO",
  UCRANIANA: "UA",
  TOGOLESA: "TG",
  CAMARONESA: "CM",
  SERRALEOA: "SL",
  COMORES: "KM", COMORIANA: "KM",
  TANZANIANA: "TZ",
  MOLDAVA: "MD",
  ESTONIANA: "EE",
  LETA: "LV",
  LITUANA: "LT",
  FAROE: "FO", ILHASFAROE: "FO",
  SAOVICENTE: "VC",
  STKITTS: "KN", SAOCRISTOVAO: "KN",
  BELIZENHA: "BZ", BELIZE: "BZ",
  HONDURENHA: "HN",
  JAMAICANA: "JM",
  PARAGUAIA: "PY",
  BOLIVIANA: "BO",
  AUSTRALIANA: "AU",
  NEOZELANDESA: "NZ",
  PAQUISTANESA: "PK",
  BANGLADESH: "BD",
  SRILANKA: "LK",
  IRANIANA: "IR",
  PALAU: "PW", PALAUANA: "PW",
  SIERRALEONE: "SL",
  GABONESA: "GA",
  MONGOL: "MN",
  CAMBOJANA: "KH",
};

export function bandeiraIso(nacionalidade: string | null | undefined): string | null {
  if (!nacionalidade) return null;
  const chave = nacionalidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!chave) return null;
  // Já veio como ISO (cadastro feito à mão, ou fonte que dá o código).
  if (chave.length === 2 && Object.values(BANDEIRAS).includes(chave)) return chave;
  return BANDEIRAS[chave] ?? null;
}
