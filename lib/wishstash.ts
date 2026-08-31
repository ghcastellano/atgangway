/**
 * Fila de desejos marcados antes de existir sessão.
 *
 * Tocar no coração deslogado mandava para o login e perdia o item: a
 * pessoa entrava, voltava para a vitrine e o favorito não estava lá —
 * exatamente o que ela achava ter feito. Agora o id fica guardado no
 * aparelho e é gravado assim que a sessão aparece, valendo tanto para
 * login por e-mail quanto para o Google.
 *
 * Funções puras de string para string: o localStorage entra e sai como
 * texto, e assim dá para testar a fila sem navegador.
 */

export const WISH_KEY = "ms.wish.pending";

/** Teto de segurança: fila é intenção recente, não histórico. */
export const WISH_MAX = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê a fila, descartando lixo — armazenamento local é editável. */
export function readPending(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  for (const v of parsed) {
    if (typeof v === "string" && UUID.test(v)) seen.add(v);
    if (seen.size >= WISH_MAX) break;
  }
  return [...seen];
}

/**
 * Enfileira um id. Tocar duas vezes no mesmo coração deslogado é
 * arrependimento, não pedido em dobro: o segundo toque tira da fila.
 */
export function togglePending(raw: string | null | undefined, id: string): string {
  const list = readPending(raw);
  const at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1);
  else if (UUID.test(id) && list.length < WISH_MAX) list.push(id);
  return JSON.stringify(list);
}
