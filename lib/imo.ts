/**
 * Validação de número IMO — o dígito verificador que a OMI embute.
 *
 * O IMO tem sete dígitos e o sétimo é soma de conferência: cada um dos
 * seis primeiros multiplicado por 7,6,5,4,3,2, e o último algarismo da
 * soma tem de ser o sétimo dígito. "9074729": 9·7+0·6+7·5+4·4+7·3+2·2
 * = 139 → termina em 9 ✓.
 *
 * Por que validar: o IMO existe para tirar ambiguidade — seis "MAERSK"
 * na lista só se distinguem por ele. Um IMO DIGITADO ERRADO é pior que
 * nenhum: aponta com confiança para o navio errado, e navio errado é
 * entrega no berço errado. O dígito verificador pega exatamente o erro
 * de quem copia o número do costado: um algarismo trocado ou dois
 * transpostos quase sempre quebram a soma.
 *
 * Vive em lib/ porque as duas pontas validam: o formulário (para dar o
 * erro na hora, com o campo ainda na tela) e a RPC no banco (porque
 * cliente nenhum é confiável). A mesma regra existe em SQL como
 * public.imo_checksum_ok — mudou aqui, muda lá.
 */

/** Só os dígitos, ou null se vazio. É o normalizador das duas RPCs. */
export function normalizeImo(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** true se tem 7 dígitos e a soma de conferência fecha. */
export function imoChecksumOk(raw: string | null | undefined): boolean {
  const imo = normalizeImo(raw);
  if (!imo || imo.length !== 7) return false;
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Number(imo[i]) * (7 - i);
  return sum % 10 === Number(imo[6]);
}
