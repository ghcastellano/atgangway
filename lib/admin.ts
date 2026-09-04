import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import type { Database } from "@/lib/database.types";

/**
 * O client do painel: só nasce para quem é da equipe.
 *
 * Toda action do admin abria o client, buscava o usuário e lia o papel
 * — o mesmo trecho copiado em dois arquivos. Aqui ele mora uma vez, e a
 * sessão é a verificação local do JWT (lib/supabase/session), sem a
 * viagem ao Auth. A RLS continua sendo a tranca de verdade no banco;
 * isto decide cedo, com uma mensagem, em vez de deixar a action falhar
 * em silêncio.
 */
export async function requireAdmin(): Promise<SupabaseClient<Database> | null> {
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) return null;
  return (await ehAdmin(supabase, user.id)) ? supabase : null;
}

/**
 * "Esta pessoa é da equipe?" — uma pergunta, um lugar.
 *
 * A consulta já existia escrita à mão no layout do /admin, e as telas de
 * conta simplesmente não a faziam: passavam isAdmin=false por omissão e
 * o item "Staff panel" sumia do menu ao navegar de /account para
 * /orders. Regra de autorização repetida em N arquivos é regra que
 * diverge; regra ESQUECIDA em N arquivos é a versão silenciosa disso.
 *
 * Não substitui a checagem de acesso: quem protege o /admin continua
 * sendo o layout dele, e antes disso a RLS no banco. Esta função serve
 * para DECIDIR O QUE MOSTRAR — esconder um link que a pessoa não pode
 * usar, e mostrar o que ela pode.
 */
export async function ehAdmin(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}
