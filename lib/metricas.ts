/**
 * Métricas de operação — os números que a Vercel guarda por nós.
 *
 * `metric()` do @vercel/functions fala por IPC com o runtime da Vercel:
 *
 *   const ipc = globalThis[Symbol.for("@vercel/rusty-runtime-ipc")];
 *   ipc?.sendMetric?.(name, value, tags);
 *
 * Fora desse runtime — `npm run dev`, `npm test`, build local — ela não
 * faz absolutamente nada: nenhuma requisição, nenhum custo, nenhum erro.
 * É por isso que dá para instrumentar o caminho quente sem medo.
 *
 * DUAS REGRAS, porque métrica mal desenhada custa dinheiro e não informa:
 *
 * 1. Tag é rótulo, não identificador. `resultado: "ok" | "erro"` tem dois
 *    valores; `pedido: "AG-1204"` tem infinitos. Cardinalidade alta é o
 *    jeito clássico de transformar observabilidade em fatura — e um
 *    gráfico com dez mil séries não se lê. Nada de id, nome de navio,
 *    e-mail ou caminho com parâmetro aqui dentro.
 *
 * 2. Só se mede o que muda uma decisão. Duração da consulta que a gente
 *    acabou de pôr em cache, valor do pedido, navio que atrasou, e-mail
 *    que não saiu. O resto é ruído bonito.
 */
import { metric } from "@vercel/functions";

/** Tags aceitas: sempre um conjunto fechado de valores. */
export type Tags = Record<string, string>;

/**
 * Registra um número. Nunca lança: observabilidade que derruba o pedido
 * é pior que a falta dela.
 */
export function medir(nome: string, valor: number, tags?: Tags): void {
  try {
    if (Number.isFinite(valor)) metric(nome, valor, tags);
  } catch {
    // runtime sem IPC, ou versão futura com outra assinatura — segue.
  }
}

/**
 * Cronometra uma promessa e registra a duração em milissegundos, com o
 * desfecho como tag. Devolve o valor original — envolver uma chamada
 * com isto não muda o que ela retorna nem engole o erro dela.
 *
 *   const r = await cronometrar("pedido.rpc_ms", () => supabase.rpc(...));
 */
export async function cronometrar<T>(
  nome: string,
  fn: () => Promise<T>,
  tags?: Tags
): Promise<T> {
  const inicio = Date.now();
  try {
    const r = await fn();
    medir(nome, Date.now() - inicio, { ...tags, desfecho: "ok" });
    return r;
  } catch (e) {
    medir(nome, Date.now() - inicio, { ...tags, desfecho: "excecao" });
    throw e;
  }
}
