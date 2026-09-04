/**
 * Leitura da lista de desejos para as telas de catálogo.
 *
 * Existe porque o coração da grade nascia SEMPRE vazio: o cliente
 * marcava, navegava, voltava e via o coração apagado. Pior que a
 * confusão, o efeito prático — ele tocava de novo achando que não
 * tinha salvado, e o segundo toque REMOVE. O item entrava e saía
 * pelas mãos da própria pessoa, e a lista da conta ficava vazia.
 *
 * Mora aqui, e não em lib/catalog.ts, porque abre o cliente do
 * Supabase pelo cookie da sessão (next/headers) e catalog.ts é
 * importado por componentes de cliente — arrastar next/headers para
 * lá quebra o bundle do navegador.
 *
 * Pergunta só pelos ids já carregados, em vez de baixar a lista
 * inteira: numa vitrine de 24 cards a consulta tem o tamanho da
 * página, não o do histórico da pessoa.
 */

import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";

export async function wishedProductIds(productIds: string[]): Promise<Set<string>> {
  const empty = new Set<string>();
  if (productIds.length === 0) return empty;

  const supabase = await createClient();
  const user = await sessionUser(supabase);
  // Visitante deslogado: nem vai ao banco, e o coração nasce vazio de
  // verdade — o próprio toque manda para o login.
  if (!user) return empty;

  const { data, error } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("user_id", user.id)
    .in("product_id", productIds);

  // Falhou a leitura: mostra o coração vazio em vez de derrubar a
  // vitrine inteira. Ninguém perde a compra por causa do favorito.
  if (error) return empty;

  return new Set((data ?? []).map((r) => r.product_id as string));
}

/**
 * Quantos favoritos a pessoa tem — só o número, para o selo do ♡ no
 * cabeçalho.
 *
 * Sem ele a lista era invisível até alguém abrir a página: o carrinho
 * mostrava "1" ao lado e o coração não mostrava nada, o que lê como
 * lista vazia.
 *
 * `head: true` não traz linha nenhuma, só a contagem — e a RLS já
 * limita ao dono, então visitante deslogado recebe zero sem consulta
 * de sessão.
 */
export async function wishCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("wishlists")
      .select("product_id", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    // Contador é enfeite: nunca pode derrubar o cabeçalho do site.
    return 0;
  }
}

/**
 * Contagem E ids da lista, numa consulta só — o que o cabeçalho semeia
 * no navegador uma vez por visita.
 *
 * Substitui o par `wishCount()` + `wishedProductIds()` que rodava em
 * TODA página de catálogo. O motivo não é economizar uma consulta: é
 * que as duas liam cookie, e ler cookie numa página impede a Vercel de
 * guardar essa página pronta. A vitrine passa a ser pré-renderizada, e
 * o estado de quem está olhando chega por fora.
 *
 * `count: "exact"` devolve o total REAL mesmo com `.limit()` aplicado,
 * então o selo continua certo para quem tem mais de 500 favoritos —
 * apenas os corações além disso nascem vazios, e o próprio toque
 * corrige. A RLS já limita ao dono; sem sessão a consulta nem sai.
 */
export async function resumoDaLista(): Promise<{ count: number; ids: string[] }> {
  const vazio = { count: 0, ids: [] as string[] };
  try {
    const supabase = await createClient();
    const user = await sessionUser(supabase);
    if (!user) return vazio;

    const { data, count, error } = await supabase
      .from("wishlists")
      .select("product_id", { count: "exact" })
      .eq("user_id", user.id)
      .limit(500);

    if (error) return vazio;
    return { count: count ?? 0, ids: (data ?? []).map((r) => r.product_id as string) };
  } catch {
    // Lista de desejos é enfeite: nunca pode derrubar o cabeçalho.
    return vazio;
  }
}
